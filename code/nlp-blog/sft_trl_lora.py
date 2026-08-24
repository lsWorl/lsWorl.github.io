"""Conversational SFT with Hugging Face TRL and PEFT LoRA.

The local examples are deliberately tiny and only demonstrate the complete
messages -> chat template -> assistant-only loss -> adapter -> generation flow.
They are not enough to produce a reliable instruction-following model.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import torch
from datasets import Dataset, DatasetDict
from peft import LoraConfig, PeftModel
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    GenerationConfig,
    set_seed,
)
from trl import SFTConfig, SFTTrainer


MODEL_ID = "Qwen/Qwen3-0.6B-Base"
MAX_LENGTH = 512
OUTPUT_ROOT = Path("outputs/sft-trl-lora")
CHECKPOINT_DIR = OUTPUT_ROOT / "checkpoints"
ADAPTER_DIR = OUTPUT_ROOT / "final-adapter"
MERGED_DIR = OUTPUT_ROOT / "merged-model"
MERGE_ADAPTER = False

SYSTEM_MESSAGE = "你是一名耐心、准确的机器学习助教。回答应简洁，并避免编造事实。"


def conversation(user: str, assistant: str) -> dict[str, list[dict[str, str]]]:
    return {
        "messages": [
            {"role": "system", "content": SYSTEM_MESSAGE},
            {"role": "user", "content": user},
            {"role": "assistant", "content": assistant},
        ]
    }


TRAIN_CONVERSATIONS = [
    conversation(
        "请用一句话解释什么是过拟合。",
        "过拟合是模型过度记忆训练数据，导致在未见数据上泛化较差的现象。",
    ),
    conversation(
        "梯度下降的作用是什么？",
        "梯度下降通过沿损失函数负梯度方向更新参数，使模型损失逐步减小。",
    ),
    conversation(
        "训练集和验证集分别有什么作用？",
        "训练集用于更新模型参数，验证集用于选择超参数并监控泛化表现。",
    ),
    conversation(
        "为什么交叉熵通常直接接收 logits？",
        "因为交叉熵内部会稳定地完成 log-softmax，不需要提前手动计算 softmax。",
    ),
    conversation(
        "Attention Mask 的作用是什么？",
        "Attention Mask 标记有效输入位置，并阻止模型关注 Padding 等无效位置。",
    ),
    conversation(
        "给出两种缓解过拟合的方法。",
        "可以增加正则化或数据增强，也可以使用早停并降低模型复杂度。",
    ),
    conversation(
        "为什么学习率过大会导致训练不稳定？",
        "学习率过大可能使参数跨过较优区域，造成损失震荡甚至发散。",
    ),
    conversation(
        "什么是梯度累积？",
        "梯度累积是在多次小批量反向传播后再更新参数，用于模拟更大的有效批量。",
    ),
    conversation(
        "Tokenizer 在语言模型中负责什么？",
        "Tokenizer 负责把文本映射为 token id，也负责把生成的 id 解码回文本。",
    ),
    conversation(
        "Causal Mask 为什么重要？",
        "Causal Mask 防止当前位置看到未来 token，从而保持自回归预测条件。",
    ),
    conversation(
        "LoRA 的核心思想是什么？",
        "LoRA 冻结原模型权重，只训练低秩增量矩阵，以减少可训练参数和优化器状态。",
    ),
    conversation(
        "SFT 训练时 Temperature 会影响 loss 吗？",
        "普通 SFT loss 直接由 logits 和标签计算，Temperature 通常只影响生成阶段的采样。",
    ),
]


VALIDATION_CONVERSATIONS = [
    conversation(
        "验证集与测试集有什么区别？",
        "验证集用于开发阶段选择配置，测试集用于最终且尽量独立的效果评估。",
    ),
    conversation(
        "为什么训练完成后还要评估生成结果？",
        "因为较低的 token loss 不一定代表回答在事实、格式和指令遵循上都更好。",
    ),
    conversation(
        "Completion-only loss 是什么意思？",
        "Completion-only loss 忽略 Prompt 标签，只对目标 Completion token 计算训练损失。",
    ),
    conversation(
        "LoRA Adapter 可以脱离 Base Model 独立推理吗？",
        "未合并的 LoRA Adapter 通常只保存增量参数，推理时仍需加载匹配的 Base Model。",
    ),
]


def build_dataset() -> DatasetDict:
    return DatasetDict(
        {
            "train": Dataset.from_list(TRAIN_CONVERSATIONS),
            "validation": Dataset.from_list(VALIDATION_CONVERSATIONS),
        }
    )


def validate_dataset(dataset: DatasetDict) -> None:
    allowed_roles = {"system", "user", "assistant"}

    for split_name, split in dataset.items():
        for row_index, example in enumerate(split):
            messages = example["messages"]
            if not messages:
                raise ValueError(f"{split_name}[{row_index}] has no messages.")

            assistant_count = 0
            for message in messages:
                role = message.get("role")
                content = message.get("content")
                if role not in allowed_roles:
                    raise ValueError(
                        f"{split_name}[{row_index}] has invalid role: {role!r}"
                    )
                if not isinstance(content, str) or not content.strip():
                    raise ValueError(
                        f"{split_name}[{row_index}] contains an empty message."
                    )
                assistant_count += role == "assistant"

            if assistant_count == 0:
                raise ValueError(
                    f"{split_name}[{row_index}] needs an assistant response."
                )


def choose_dtype() -> torch.dtype:
    if not torch.cuda.is_available():
        return torch.float32
    if torch.cuda.is_bf16_supported():
        return torch.bfloat16
    return torch.float16


def build_lora_config() -> LoraConfig:
    return LoraConfig(
        r=16,
        lora_alpha=32,
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules="all-linear",
    )


def print_trainable_parameters(model: Any) -> None:
    trainable = sum(
        parameter.numel()
        for parameter in model.parameters()
        if parameter.requires_grad
    )
    total = sum(parameter.numel() for parameter in model.parameters())
    ratio = 100.0 * trainable / total
    print(f"trainable parameters: {trainable:,}")
    print(f"all parameters: {total:,}")
    print(f"trainable ratio: {ratio:.4f}%")


def inspect_chat_template(tokenizer: Any, messages: list[dict[str, str]]) -> None:
    formatted = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=False,
        enable_thinking=False,
    )
    print("\n=== Formatted training conversation ===")
    print(formatted)


@torch.no_grad()
def generate_answer(
    model: Any,
    tokenizer: Any,
    user_message: str,
    generation_config: GenerationConfig,
) -> str:
    model.eval()
    messages = [
        {"role": "system", "content": SYSTEM_MESSAGE},
        {"role": "user", "content": user_message},
    ]
    inputs = tokenizer.apply_chat_template(
        messages,
        tokenize=True,
        add_generation_prompt=True,
        return_dict=True,
        return_tensors="pt",
        enable_thinking=False,
    ).to(model.device)

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
    validate_dataset(dataset)

    dtype = choose_dtype()
    print(f"training dtype: {dtype}")
    print(f"train examples: {len(dataset['train'])}")
    print(f"validation examples: {len(dataset['validation'])}")

    # Qwen3 already contains the required chat control tokens. Current TRL can
    # patch known Qwen3 templates to expose assistant generation spans.
    training_args = SFTConfig(
        output_dir=str(CHECKPOINT_DIR),
        overwrite_output_dir=True,
        max_length=MAX_LENGTH,
        eos_token="<|im_end|>",
        assistant_only_loss=True,
        packing=False,
        loss_type="nll",
        num_train_epochs=3,
        per_device_train_batch_size=1,
        per_device_eval_batch_size=1,
        gradient_accumulation_steps=8,
        learning_rate=1e-4,
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
        model_init_kwargs={"dtype": dtype},
    )

    trainer = SFTTrainer(
        model=MODEL_ID,
        args=training_args,
        train_dataset=dataset["train"],
        eval_dataset=dataset["validation"],
        peft_config=build_lora_config(),
    )

    inspect_chat_template(
        trainer.processing_class,
        dataset["train"][0]["messages"],
    )
    print_trainable_parameters(trainer.model)

    train_result = trainer.train()
    print("\ntrain metrics:", train_result.metrics)
    print("eval metrics:", trainer.evaluate())

    trainer.save_model(str(ADAPTER_DIR))
    trainer.processing_class.save_pretrained(str(ADAPTER_DIR))
    print(f"\nSaved adapter to: {ADAPTER_DIR.resolve()}")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    tokenizer = AutoTokenizer.from_pretrained(ADAPTER_DIR)
    base_model = AutoModelForCausalLM.from_pretrained(
        MODEL_ID,
        dtype=dtype,
    ).to(device)
    model = PeftModel.from_pretrained(base_model, ADAPTER_DIR).to(device)

    generation_config = GenerationConfig(
        max_new_tokens=128,
        do_sample=True,
        temperature=0.8,
        top_p=0.9,
        pad_token_id=tokenizer.pad_token_id,
        eos_token_id=tokenizer.eos_token_id,
    )
    answer = generate_answer(
        model,
        tokenizer,
        "请解释训练集、验证集和测试集的区别。",
        generation_config,
    )
    print("\n=== Adapter model answer ===")
    print(answer)

    if MERGE_ADAPTER:
        merged_model = model.merge_and_unload()
        merged_model.save_pretrained(
            MERGED_DIR,
            safe_serialization=True,
        )
        tokenizer.save_pretrained(MERGED_DIR)
        print(f"Saved merged model to: {MERGED_DIR.resolve()}")


if __name__ == "__main__":
    main()
