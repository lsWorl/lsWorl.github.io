"""Fine-tune and save a small Chinese sentiment classifier with Hugging Face."""

from pathlib import Path

import numpy as np
from datasets import Dataset, DatasetDict
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
    DataCollatorWithPadding,
    Trainer,
    TrainingArguments,
    pipeline,
    set_seed,
)


MODEL_ID = "google-bert/bert-base-chinese"
OUTPUT_DIR = Path("outputs/hf-chinese-sentiment")
FINAL_DIR = OUTPUT_DIR / "final"

ID2LABEL = {
    0: "NEGATIVE",
    1: "POSITIVE",
}
LABEL2ID = {
    "NEGATIVE": 0,
    "POSITIVE": 1,
}


def build_dataset() -> DatasetDict:
    train_texts = [
        "物流很快，包装完整，商品也很好用。",
        "音质清晰，佩戴几个小时也很舒服。",
        "屏幕显示细腻，系统运行十分流畅。",
        "客服回复及时，问题很快得到解决。",
        "续航表现不错，一整天使用没有压力。",
        "键盘手感很好，连接也非常稳定。",
        "做工粗糙，刚拆开就发现了划痕。",
        "电池掉电特别快，完全无法正常使用。",
        "商品与描述不符，体验非常糟糕。",
        "包装已经破损，而且缺少配件。",
        "运行频繁卡顿，还出现了自动关机。",
        "客服一直没有回复，售后体验很差。",
    ]
    train_labels = [1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0]

    validation_texts = [
        "外观漂亮，操作简单，整体很满意。",
        "价格合理，实际效果超出了预期。",
        "收到时屏幕已经碎了，无法使用。",
        "声音断断续续，连接经常中断。",
    ]
    validation_labels = [1, 1, 0, 0]

    return DatasetDict(
        {
            "train": Dataset.from_dict(
                {"text": train_texts, "label": train_labels}
            ),
            "validation": Dataset.from_dict(
                {
                    "text": validation_texts,
                    "label": validation_labels,
                }
            ),
        }
    )


def compute_metrics(eval_pred) -> dict[str, float]:
    logits, labels = eval_pred
    predictions = np.argmax(logits, axis=-1)
    accuracy = (predictions == labels).mean()
    return {"accuracy": float(accuracy)}


def main() -> None:
    set_seed(42)

    raw_dataset = build_dataset()
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)

    def tokenize_batch(examples):
        return tokenizer(
            examples["text"],
            truncation=True,
            max_length=128,
        )

    tokenized_dataset = raw_dataset.map(
        tokenize_batch,
        batched=True,
        remove_columns=["text"],
    )

    data_collator = DataCollatorWithPadding(tokenizer=tokenizer)

    model = AutoModelForSequenceClassification.from_pretrained(
        MODEL_ID,
        num_labels=2,
        id2label=ID2LABEL,
        label2id=LABEL2ID,
    )

    training_args = TrainingArguments(
        output_dir=str(OUTPUT_DIR),
        learning_rate=2e-5,
        per_device_train_batch_size=4,
        per_device_eval_batch_size=4,
        num_train_epochs=3,
        weight_decay=0.01,
        eval_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="accuracy",
        greater_is_better=True,
        save_total_limit=2,
        logging_steps=1,
        report_to="none",
        seed=42,
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized_dataset["train"],
        eval_dataset=tokenized_dataset["validation"],
        processing_class=tokenizer,
        data_collator=data_collator,
        compute_metrics=compute_metrics,
    )

    trainer.train()
    metrics = trainer.evaluate()
    print("evaluation metrics:", metrics)

    FINAL_DIR.mkdir(parents=True, exist_ok=True)
    trainer.save_model(str(FINAL_DIR))
    tokenizer.save_pretrained(str(FINAL_DIR))

    classifier = pipeline(
        task="text-classification",
        model=str(FINAL_DIR),
        tokenizer=str(FINAL_DIR),
    )
    predictions = classifier(
        [
            "这个鼠标握持舒适，定位也很准确。",
            "才使用一天按键就失灵了。",
        ]
    )
    print("predictions:", predictions)


if __name__ == "__main__":
    main()
