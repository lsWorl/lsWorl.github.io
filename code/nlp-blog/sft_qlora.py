"""A compact, inspectable QLoRA SFT example built with Hugging Face libraries.

The script intentionally uses a tiny local dataset so the full data -> train ->
save -> reload -> generate path is visible in one file. It requires a CUDA GPU
for the teaching path below. Increase model size and replace the dataset only
after this version works end to end.
"""

from pathlib import Path

import torch
from datasets import Dataset
from peft import LoraConfig, PeftModel
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
    GenerationConfig,
    set_seed,
)
from trl import SFTConfig, SFTTrainer


MODEL_ID = "Qwen/Qwen3-0.6B-Base"
OUTPUT_DIR = Path("outputs/qwen3-0.6b-qlora")
ADAPTER_DIR = OUTPUT_DIR / "final-adapter"
SEED = 42


TRAIN_ROWS = [
    {
        "messages": [
            {"role": "system", "content": "你是一名耐心的机器学习助教。"},
            {"role": "user", "content": "什么是监督学习？"},
            {
                "role": "assistant",
                "content": "监督学习使用带标签样本学习输入到目标的映射，例如用带类别的邮件训练垃圾邮件分类器。",
            },
        ]
    },
    {
        "messages": [
            {"role": "system", "content": "你是一名耐心的机器学习助教。"},
            {"role": "user", "content": "训练集、验证集和测试集分别做什么？"},
            {
                "role": "assistant",
                "content": "训练集用于更新参数，验证集用于选择超参数和模型，测试集只在最终阶段评估泛化能力。",
            },
        ]
    },
    {
        "messages": [
            {"role": "system", "content": "你是一名耐心的机器学习助教。"},
            {"role": "user", "content": "什么是过拟合？"},
            {
                "role": "assistant",
                "content": "过拟合是模型记住训练数据细节却不能推广到新样本，常表现为训练误差继续下降而验证误差上升。",
            },
        ]
    },
    {
        "messages": [
            {"role": "system", "content": "你是一名耐心的机器学习助教。"},
            {"role": "user", "content": "学习率太大会发生什么？"},
            {
                "role": "assistant",
                "content": "学习率过大时参数更新可能越过较优区域，使损失震荡甚至发散；过小时训练又会非常缓慢。",
            },
        ]
    },
    {
        "messages": [
            {"role": "system", "content": "你是一名耐心的机器学习助教。"},
            {"role": "user", "content": "Batch Size 会影响什么？"},
            {
                "role": "assistant",
                "content": "Batch Size 会影响梯度噪声、吞吐量和显存占用。显存不足时可减小微批次并使用梯度累积。",
            },
        ]
    },
    {
        "messages": [
            {"role": "system", "content": "你是一名耐心的机器学习助教。"},
            {"role": "user", "content": "为什么需要归一化输入特征？"},
            {
                "role": "assistant",
                "content": "归一化能减小不同特征尺度的差异，使优化器更容易沿各个方向稳定更新参数。",
            },
        ]
    },
    {
        "messages": [
            {"role": "system", "content": "你是一名耐心的机器学习助教。"},
            {"role": "user", "content": "交叉熵损失在分类中衡量什么？"},
            {
                "role": "assistant",
                "content": "交叉熵衡量预测概率分布与真实标签分布的差异，模型给正确类别的概率越低，损失通常越大。",
            },
        ]
    },
    {
        "messages": [
            {"role": "system", "content": "你是一名耐心的机器学习助教。"},
            {"role": "user", "content": "梯度下降为什么需要反向传播？"},
            {
                "role": "assistant",
                "content": "反向传播利用链式法则高效计算损失对各参数的梯度，梯度下降再据此调整参数。",
            },
        ]
    },
    {
        "messages": [
            {"role": "system", "content": "你是一名耐心的机器学习助教。"},
            {"role": "user", "content": "正则化有什么作用？"},
            {
                "role": "assistant",
                "content": "正则化通过限制模型复杂度或引入噪声来抑制过拟合，常见方法包括权重衰减、Dropout 和数据增强。",
            },
        ]
    },
    {
        "messages": [
            {"role": "system", "content": "你是一名耐心的机器学习助教。"},
            {"role": "user", "content": "Precision 和 Recall 有什么区别？"},
            {
                "role": "assistant",
                "content": "Precision 关注预测为正的样本有多少确实为正，Recall 关注所有真实正样本有多少被找出来。",
            },
        ]
    },
    {
        "messages": [
            {"role": "system", "content": "你是一名耐心的机器学习助教。"},
            {"role": "user", "content": "什么是梯度累积？"},
            {
                "role": "assistant",
                "content": "梯度累积先对多个微批次执行反向传播并累加梯度，再统一更新一次参数，用时间换取更大的有效批次。",
            },
        ]
    },
    {
        "messages": [
            {"role": "system", "content": "你是一名耐心的机器学习助教。"},
            {"role": "user", "content": "为什么验证集不能参与参数更新？"},
            {
                "role": "assistant",
                "content": "验证集用于估计未见数据上的表现；若参与更新，验证指标会被污染，不能可靠地指导模型选择。",
            },
        ]
    },
]


EVAL_ROWS = [
    {
        "messages": [
            {"role": "system", "content": "你是一名耐心的机器学习助教。"},
            {"role": "user", "content": "欠拟合是什么？"},
            {
                "role": "assistant",
                "content": "欠拟合表示模型连训练数据中的主要规律都没有学好，训练和验证表现通常都较差。",
            },
        ]
    },
    {
        "messages": [
            {"role": "system", "content": "你是一名耐心的机器学习助教。"},
            {"role": "user", "content": "为什么要固定随机种子？"},
            {
                "role": "assistant",
                "content": "固定随机种子能减少初始化、采样和数据顺序带来的差异，便于复现实验和比较配置。",
            },
        ]
    },
    {
        "messages": [
            {"role": "system", "content": "你是一名耐心的机器学习助教。"},
            {"role": "user", "content": "F1 Score 适合什么场景？"},
            {
                "role": "assistant",
                "content": "F1 Score 是 Precision 与 Recall 的调和平均，适合类别不均衡且二者都重要的场景。",
            },
        ]
    },
    {
        "messages": [
            {"role": "system", "content": "你是一名耐心的机器学习助教。"},
            {"role": "user", "content": "训练损失下降是否说明模型一定更好？"},
            {
                "role": "assistant",
                "content": "不一定。还要检查验证损失、任务指标和真实生成结果，以排除过拟合、数据泄漏和格式学习。",
            },
        ]
    },
]


def validate_rows(rows: list[dict]) -> None:
    """Fail early if a conversational sample has an invalid role sequence."""
    for row_index, row in enumerate(rows):
        messages = row.get("messages")
        if not isinstance(messages, list) or len(messages) < 2:
            raise ValueError(f"row {row_index}: messages must contain a conversation")
        if messages[-1].get("role") != "assistant":
            raise ValueError(f"row {row_index}: the final message must be assistant")
        for message in messages:
            if message.get("role") not in {"system", "user", "assistant"}:
                raise ValueError(f"row {row_index}: invalid role {message.get('role')!r}")
            if not isinstance(message.get("content"), str) or not message["content"].strip():
                raise ValueError(f"row {row_index}: message content cannot be empty")


def choose_compute_dtype() -> torch.dtype:
    if not torch.cuda.is_available():
        raise RuntimeError(
            "This teaching script expects a CUDA GPU. "
            "Check the current bitsandbytes backend documentation before adapting it to another device."
        )
    return torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16


def print_model_report(model: torch.nn.Module) -> None:
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total = sum(p.numel() for p in model.parameters())
    linear4bit = [
        name
        for name, module in model.named_modules()
        if module.__class__.__name__ == "Linear4bit"
    ]
    print(f"4-bit Linear layers: {len(linear4bit)}")
    print(f"first 4-bit layers: {linear4bit[:8]}")
    print(f"trainable params: {trainable:,}")
    print(f"all params reported by modules: {total:,}")
    print(f"trainable ratio: {100 * trainable / total:.4f}%")


def main() -> None:
    set_seed(SEED)
    validate_rows(TRAIN_ROWS)
    validate_rows(EVAL_ROWS)

    compute_dtype = choose_compute_dtype()
    bf16 = compute_dtype == torch.bfloat16
    print(f"GPU: {torch.cuda.get_device_name(0)}")
    print(f"QLoRA compute dtype: {compute_dtype}")

    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
    if tokenizer.pad_token_id is None:
        tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"

    train_dataset = Dataset.from_list(TRAIN_ROWS)
    eval_dataset = Dataset.from_list(EVAL_ROWS)

    quantization_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True,
        bnb_4bit_compute_dtype=compute_dtype,
    )

    peft_config = LoraConfig(
        task_type="CAUSAL_LM",
        r=16,
        lora_alpha=32,
        lora_dropout=0.05,
        bias="none",
        target_modules="all-linear",
    )

    training_args = SFTConfig(
        output_dir=str(OUTPUT_DIR),
        max_length=512,
        assistant_only_loss=True,
        eos_token="<|im_end|>",
        per_device_train_batch_size=1,
        per_device_eval_batch_size=1,
        gradient_accumulation_steps=8,
        gradient_checkpointing=True,
        gradient_checkpointing_kwargs={"use_reentrant": False},
        learning_rate=2e-4,
        num_train_epochs=3,
        warmup_ratio=0.05,
        lr_scheduler_type="cosine",
        optim="paged_adamw_8bit",
        weight_decay=0.01,
        max_grad_norm=0.3,
        bf16=bf16,
        fp16=not bf16,
        eval_strategy="epoch",
        save_strategy="epoch",
        logging_steps=1,
        save_total_limit=2,
        load_best_model_at_end=True,
        report_to="none",
        seed=SEED,
        data_seed=SEED,
        use_cache=False,
    )

    # Current TRL can load and quantize a model id, then apply PEFT internally.
    trainer = SFTTrainer(
        model=MODEL_ID,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        processing_class=tokenizer,
        quantization_config=quantization_config,
        peft_config=peft_config,
    )

    print_model_report(trainer.model)
    torch.cuda.reset_peak_memory_stats()
    trainer.train()
    print(f"peak allocated VRAM: {torch.cuda.max_memory_allocated() / 1024**3:.2f} GiB")

    trainer.save_model(str(ADAPTER_DIR))
    tokenizer.save_pretrained(ADAPTER_DIR)
    print(f"adapter saved to: {ADAPTER_DIR.resolve()}")

    del trainer
    torch.cuda.empty_cache()

    inference_quantization = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True,
        bnb_4bit_compute_dtype=compute_dtype,
    )
    base_model = AutoModelForCausalLM.from_pretrained(
        MODEL_ID,
        quantization_config=inference_quantization,
        device_map={"": 0},
    )
    model = PeftModel.from_pretrained(base_model, ADAPTER_DIR)
    model.eval()
    tokenizer = AutoTokenizer.from_pretrained(ADAPTER_DIR)

    messages = [
        {"role": "system", "content": "你是一名耐心的机器学习助教。"},
        {"role": "user", "content": "请用一个生活中的例子解释过拟合。"},
    ]
    input_ids = tokenizer.apply_chat_template(
        messages,
        tokenize=True,
        add_generation_prompt=True,
        return_tensors="pt",
        enable_thinking=False,
    )
    input_device = model.get_input_embeddings().weight.device
    input_ids = input_ids.to(input_device)

    im_end_id = tokenizer.convert_tokens_to_ids("<|im_end|>")
    generation_config = GenerationConfig(
        max_new_tokens=128,
        do_sample=True,
        temperature=0.7,
        top_p=0.9,
        repetition_penalty=1.05,
        pad_token_id=tokenizer.pad_token_id,
        eos_token_id=im_end_id,
    )
    with torch.inference_mode():
        output_ids = model.generate(
            input_ids=input_ids,
            generation_config=generation_config,
        )

    new_tokens = output_ids[0, input_ids.shape[-1] :]
    print(tokenizer.decode(new_tokens, skip_special_tokens=True))


if __name__ == "__main__":
    main()
