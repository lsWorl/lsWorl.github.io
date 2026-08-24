"""Educational completion-only SFT with Hugging Face Transformers.

This script intentionally constructs input_ids, attention_mask, and labels
without TRL so the masking rules remain visible. The tiny local dataset only
validates the training pipeline; it is not sufficient for a useful assistant.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import torch
from datasets import Dataset, DatasetDict
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    GenerationConfig,
    Trainer,
    TrainingArguments,
    set_seed,
)


MODEL_ID = "Qwen/Qwen2.5-0.5B"
MAX_LENGTH = 256
OUTPUT_ROOT = Path("outputs/sft-transformers")
CHECKPOINT_DIR = OUTPUT_ROOT / "checkpoints"
FINAL_DIR = OUTPUT_ROOT / "final"


TRAIN_EXAMPLES = [
    {
        "instruction": "用一句话解释什么是过拟合。",
        "response": "过拟合是模型过度记忆训练数据，导致在未见数据上泛化较差的现象。",
    },
    {
        "instruction": "梯度下降的作用是什么？",
        "response": "梯度下降通过沿损失函数负梯度方向更新参数，使模型损失逐步减小。",
    },
    {
        "instruction": "训练集和验证集分别有什么作用？",
        "response": "训练集用于更新模型参数，验证集用于选择超参数并监控泛化表现。",
    },
    {
        "instruction": "为什么分类训练时通常直接把 logits 交给交叉熵？",
        "response": "因为交叉熵内部会稳定地完成 log-softmax，不需要提前手动计算 softmax。",
    },
    {
        "instruction": "Attention Mask 的作用是什么？",
        "response": "Attention Mask 用于标记有效输入位置，并阻止模型关注 Padding 等无效位置。",
    },
    {
        "instruction": "给出两种缓解过拟合的方法。",
        "response": "可以增加正则化或数据增强，也可以使用早停并减少模型复杂度。",
    },
    {
        "instruction": "学习率太大会发生什么？",
        "response": "学习率过大可能让参数跨过较优区域，使损失震荡甚至发散。",
    },
    {
        "instruction": "什么是 Batch Size？",
        "response": "Batch Size 是一次前向和反向传播共同处理的样本数量。",
    },
    {
        "instruction": "为什么要固定随机种子？",
        "response": "固定随机种子有助于复现实验中的数据划分、初始化和采样结果。",
    },
    {
        "instruction": "什么是梯度累积？",
        "response": "梯度累积是在多次小批量反向传播后再更新参数，以模拟更大的有效批量。",
    },
    {
        "instruction": "Tokenizer 在语言模型中负责什么？",
        "response": "Tokenizer 负责把文本切分并映射为 token id，也负责把生成 id 解码回文本。",
    },
    {
        "instruction": "Causal Mask 为什么重要？",
        "response": "Causal Mask 防止当前位置看到未来 token，从而保持自回归预测条件。",
    },
]


VALIDATION_EXAMPLES = [
    {
        "instruction": "验证集与测试集有什么区别？",
        "response": "验证集用于开发阶段选择配置，测试集用于最终且尽量独立的效果评估。",
    },
    {
        "instruction": "为什么需要归一化层？",
        "response": "归一化层有助于稳定中间激活尺度，从而改善深层网络的训练稳定性。",
    },
    {
        "instruction": "什么是有效 Batch Size？",
        "response": "有效 Batch Size 是单设备批量、梯度累积步数与并行设备数的乘积。",
    },
    {
        "instruction": "模型训练完成后为什么还要单独评估生成结果？",
        "response": "因为较低的 token loss 不一定代表回答在事实、格式和指令遵循上都更好。",
    },
]


def build_dataset() -> DatasetDict:
    return DatasetDict(
        {
            "train": Dataset.from_list(TRAIN_EXAMPLES),
            "validation": Dataset.from_list(VALIDATION_EXAMPLES),
        }
    )


def format_prompt(instruction: str) -> str:
    return (
        "### Instruction:\n"
        f"{instruction.strip()}\n\n"
        "### Response:\n"
    )


def choose_dtype() -> torch.dtype:
    if not torch.cuda.is_available():
        return torch.float32
    if torch.cuda.is_bf16_supported():
        return torch.bfloat16
    return torch.float16


def truncate_prompt_and_answer(
    prompt_ids: list[int],
    answer_ids: list[int],
    max_length: int,
    bos_token_id: int | None,
    eos_token_id: int,
) -> tuple[list[int], list[int]]:
    """Prefer answer tokens and preserve BOS/EOS when truncation is needed."""

    if len(answer_ids) >= max_length:
        truncated_answer = answer_ids[:max_length]
        truncated_answer[-1] = eos_token_id
        return [], truncated_answer

    prompt_budget = max_length - len(answer_ids)
    if len(prompt_ids) <= prompt_budget:
        return prompt_ids, answer_ids

    has_bos = bool(prompt_ids and prompt_ids[0] == bos_token_id)
    if has_bos and prompt_budget > 1:
        prompt_ids = [prompt_ids[0]] + prompt_ids[-(prompt_budget - 1) :]
    else:
        prompt_ids = prompt_ids[-prompt_budget:]

    return prompt_ids, answer_ids


def make_tokenize_function(tokenizer: Any):
    if tokenizer.eos_token_id is None or tokenizer.eos_token is None:
        raise ValueError("The tokenizer must define an EOS token for SFT.")

    def tokenize_example(example: dict[str, str]) -> dict[str, list[int]]:
        prompt = format_prompt(example["instruction"])
        answer = example["response"].strip() + tokenizer.eos_token

        prompt_ids = tokenizer(
            prompt,
            add_special_tokens=True,
            truncation=False,
        )["input_ids"]
        answer_ids = tokenizer(
            answer,
            add_special_tokens=False,
            truncation=False,
        )["input_ids"]

        prompt_ids, answer_ids = truncate_prompt_and_answer(
            prompt_ids=prompt_ids,
            answer_ids=answer_ids,
            max_length=MAX_LENGTH,
            bos_token_id=tokenizer.bos_token_id,
            eos_token_id=tokenizer.eos_token_id,
        )

        input_ids = prompt_ids + answer_ids
        labels = [-100] * len(prompt_ids) + answer_ids.copy()

        if len(input_ids) != len(labels):
            raise AssertionError("input_ids and labels must have equal lengths.")
        if not any(label != -100 for label in labels):
            raise ValueError("Every SFT sample needs at least one target token.")

        return {
            "input_ids": input_ids,
            "attention_mask": [1] * len(input_ids),
            "labels": labels,
        }

    return tokenize_example


@dataclass
class CompletionOnlyCollator:
    pad_token_id: int
    pad_to_multiple_of: int | None = 8

    def __call__(self, features: list[dict[str, list[int]]]) -> dict[str, torch.Tensor]:
        max_length = max(len(item["input_ids"]) for item in features)

        if self.pad_to_multiple_of:
            multiple = self.pad_to_multiple_of
            max_length = ((max_length + multiple - 1) // multiple) * multiple

        batch_input_ids = []
        batch_attention_mask = []
        batch_labels = []

        for item in features:
            pad_length = max_length - len(item["input_ids"])
            batch_input_ids.append(
                item["input_ids"] + [self.pad_token_id] * pad_length
            )
            batch_attention_mask.append(
                item["attention_mask"] + [0] * pad_length
            )
            batch_labels.append(item["labels"] + [-100] * pad_length)

        return {
            "input_ids": torch.tensor(batch_input_ids, dtype=torch.long),
            "attention_mask": torch.tensor(
                batch_attention_mask,
                dtype=torch.long,
            ),
            "labels": torch.tensor(batch_labels, dtype=torch.long),
        }


def inspect_sample(tokenizer: Any, sample: dict[str, list[int]]) -> None:
    target_ids = [
        token_id
        for token_id, label in zip(sample["input_ids"], sample["labels"])
        if label != -100
    ]

    print("\n=== Tokenized sample ===")
    print("sequence length:", len(sample["input_ids"]))
    print("target tokens:", len(target_ids))
    print("full text:")
    print(tokenizer.decode(sample["input_ids"], skip_special_tokens=False))
    print("completion-only target:")
    print(tokenizer.decode(target_ids, skip_special_tokens=False))


def inspect_batch(batch: dict[str, torch.Tensor]) -> None:
    print("\n=== Collated batch ===")
    for name, tensor in batch.items():
        print(f"{name:>14}: shape={tuple(tensor.shape)}")
    print("target counts:", (batch["labels"] != -100).sum(dim=1).tolist())


@torch.no_grad()
def generate_answer(
    model: Any,
    tokenizer: Any,
    instruction: str,
    generation_config: GenerationConfig,
) -> str:
    model.eval()
    prompt = format_prompt(instruction)
    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
    output_ids = model.generate(
        **inputs,
        generation_config=generation_config,
    )
    prompt_length = inputs["input_ids"].shape[1]
    new_tokens = output_ids[0, prompt_length:]
    return tokenizer.decode(new_tokens, skip_special_tokens=True).strip()


def main() -> None:
    set_seed(42)
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)

    dataset = build_dataset()
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
    tokenizer.padding_side = "right"

    if tokenizer.pad_token_id is None:
        if tokenizer.eos_token_id is None:
            raise ValueError("Tokenizer has neither PAD nor EOS token.")
        tokenizer.pad_token = tokenizer.eos_token

    tokenize_example = make_tokenize_function(tokenizer)
    tokenized_dataset = dataset.map(
        tokenize_example,
        remove_columns=dataset["train"].column_names,
        desc="Building completion-only SFT features",
    )

    inspect_sample(tokenizer, tokenized_dataset["train"][0])

    collator = CompletionOnlyCollator(
        pad_token_id=tokenizer.pad_token_id,
        pad_to_multiple_of=8,
    )
    example_batch = collator(
        [
            tokenized_dataset["train"][0],
            tokenized_dataset["train"][1],
        ]
    )
    inspect_batch(example_batch)

    dtype = choose_dtype()
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = AutoModelForCausalLM.from_pretrained(MODEL_ID, dtype=dtype)
    model.to(device)

    total_params = sum(parameter.numel() for parameter in model.parameters())
    trainable_params = sum(
        parameter.numel()
        for parameter in model.parameters()
        if parameter.requires_grad
    )
    print(f"\ntotal parameters: {total_params:,}")
    print(f"trainable parameters: {trainable_params:,}")
    print(f"training dtype: {dtype}")
    print(f"device: {device}")

    # Verify that the exact batch contract produces a scalar Causal LM loss.
    model.eval()
    forward_batch = {
        name: tensor.to(device)
        for name, tensor in example_batch.items()
    }
    with torch.no_grad():
        outputs = model(**forward_batch)
    print("logits shape:", tuple(outputs.logits.shape))
    print("initial batch loss:", float(outputs.loss))

    generation_config = GenerationConfig(
        max_new_tokens=96,
        do_sample=False,
        pad_token_id=tokenizer.pad_token_id,
        eos_token_id=tokenizer.eos_token_id,
    )
    eval_instruction = "为什么训练模型需要验证集？"
    baseline_answer = generate_answer(
        model,
        tokenizer,
        eval_instruction,
        generation_config,
    )
    print("\n=== Base model answer ===")
    print(baseline_answer)

    model.config.use_cache = False
    training_args = TrainingArguments(
        output_dir=str(CHECKPOINT_DIR),
        overwrite_output_dir=True,
        num_train_epochs=5,
        per_device_train_batch_size=2,
        per_device_eval_batch_size=2,
        gradient_accumulation_steps=4,
        learning_rate=2e-5,
        weight_decay=0.01,
        warmup_ratio=0.1,
        lr_scheduler_type="cosine",
        logging_steps=1,
        eval_strategy="epoch",
        save_strategy="epoch",
        save_total_limit=2,
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        greater_is_better=False,
        gradient_checkpointing=True,
        gradient_checkpointing_kwargs={"use_reentrant": False},
        bf16=dtype == torch.bfloat16,
        fp16=dtype == torch.float16,
        report_to="none",
        seed=42,
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized_dataset["train"],
        eval_dataset=tokenized_dataset["validation"],
        data_collator=collator,
        processing_class=tokenizer,
    )

    train_result = trainer.train()
    print("\ntrain metrics:", train_result.metrics)
    print("eval metrics:", trainer.evaluate())

    trainer.model.config.use_cache = True
    trainer.save_model(str(FINAL_DIR))
    tokenizer.save_pretrained(str(FINAL_DIR))

    reloaded_tokenizer = AutoTokenizer.from_pretrained(FINAL_DIR)
    reloaded_model = AutoModelForCausalLM.from_pretrained(
        FINAL_DIR,
        dtype=dtype,
    ).to(device)

    tuned_answer = generate_answer(
        reloaded_model,
        reloaded_tokenizer,
        eval_instruction,
        GenerationConfig(
            max_new_tokens=96,
            do_sample=False,
            pad_token_id=reloaded_tokenizer.pad_token_id,
            eos_token_id=reloaded_tokenizer.eos_token_id,
        ),
    )
    print("\n=== SFT model answer ===")
    print(tuned_answer)
    print(f"\nSaved full model to: {FINAL_DIR.resolve()}")


if __name__ == "__main__":
    main()
