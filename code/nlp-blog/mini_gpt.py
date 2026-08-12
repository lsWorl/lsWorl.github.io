"""A small character-level GPT implemented with basic PyTorch layers."""

import argparse
import math
import random
from dataclasses import asdict, dataclass
from pathlib import Path

import torch
import torch.nn.functional as F
from torch import nn


RAW_TEXT = """春天来了，花儿在风中开放。
夏天来了，蝉儿在树上歌唱。
秋天来了，果实在枝头成熟。
冬天来了，雪花在天空飞舞。
清晨，太阳从东方升起。
傍晚，月亮在云间出现。
小河穿过安静的村庄。
微风吹过绿色的田野。
我们读书，也观察世界。
我们思考，也记录问题。
机器学习从数据中寻找规律。
神经网络用参数表示知识。
注意力让词语彼此交换信息。
语言模型根据上文预测下一个字符。
"""


@dataclass
class GPTConfig:
    vocab_size: int
    block_size: int = 64
    n_layer: int = 3
    n_head: int = 4
    n_embd: int = 96
    dropout: float = 0.1


class CharacterTokenizer:
    def __init__(self, text):
        chars = sorted(set(text))
        self.stoi = {ch: i for i, ch in enumerate(chars)}
        self.itos = {i: ch for ch, i in self.stoi.items()}

    @property
    def vocab_size(self):
        return len(self.stoi)

    def encode(self, text):
        unknown = sorted(set(text) - self.stoi.keys())
        if unknown:
            raise ValueError(f"characters are not in the vocabulary: {unknown}")
        return [self.stoi[ch] for ch in text]

    def decode(self, ids):
        return "".join(self.itos[int(i)] for i in ids)


class CausalSelfAttention(nn.Module):
    def __init__(self, config):
        super().__init__()
        if config.n_embd % config.n_head != 0:
            raise ValueError("n_embd must be divisible by n_head")

        self.n_head = config.n_head
        self.head_dim = config.n_embd // config.n_head
        self.qkv = nn.Linear(config.n_embd, 3 * config.n_embd)
        self.proj = nn.Linear(config.n_embd, config.n_embd)
        self.attn_dropout = nn.Dropout(config.dropout)
        self.resid_dropout = nn.Dropout(config.dropout)

        mask = torch.tril(torch.ones(
            config.block_size,
            config.block_size,
        ))
        self.register_buffer(
            "causal_mask",
            mask.view(1, 1, config.block_size, config.block_size),
        )

    def forward(self, x):
        batch_size, seq_len, channels = x.shape
        q, k, v = self.qkv(x).split(channels, dim=-1)

        q = q.view(
            batch_size, seq_len, self.n_head, self.head_dim
        ).transpose(1, 2)
        k = k.view(
            batch_size, seq_len, self.n_head, self.head_dim
        ).transpose(1, 2)
        v = v.view(
            batch_size, seq_len, self.n_head, self.head_dim
        ).transpose(1, 2)

        scores = q @ k.transpose(-2, -1)
        scores = scores / math.sqrt(self.head_dim)
        scores = scores.masked_fill(
            self.causal_mask[:, :, :seq_len, :seq_len] == 0,
            float("-inf"),
        )

        weights = F.softmax(scores, dim=-1)
        weights = self.attn_dropout(weights)
        output = weights @ v
        output = output.transpose(1, 2).contiguous()
        output = output.view(batch_size, seq_len, channels)
        return self.resid_dropout(self.proj(output))


class MLP(nn.Module):
    def __init__(self, config):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(config.n_embd, 4 * config.n_embd),
            nn.GELU(),
            nn.Linear(4 * config.n_embd, config.n_embd),
            nn.Dropout(config.dropout),
        )

    def forward(self, x):
        return self.net(x)


class Block(nn.Module):
    def __init__(self, config):
        super().__init__()
        self.ln_1 = nn.LayerNorm(config.n_embd)
        self.attn = CausalSelfAttention(config)
        self.ln_2 = nn.LayerNorm(config.n_embd)
        self.mlp = MLP(config)

    def forward(self, x):
        x = x + self.attn(self.ln_1(x))
        return x + self.mlp(self.ln_2(x))


class MiniGPT(nn.Module):
    def __init__(self, config):
        super().__init__()
        self.config = config
        self.token_embedding = nn.Embedding(
            config.vocab_size,
            config.n_embd,
        )
        self.position_embedding = nn.Embedding(
            config.block_size,
            config.n_embd,
        )
        self.dropout = nn.Dropout(config.dropout)
        self.blocks = nn.ModuleList([
            Block(config) for _ in range(config.n_layer)
        ])
        self.ln_f = nn.LayerNorm(config.n_embd)
        self.lm_head = nn.Linear(
            config.n_embd,
            config.vocab_size,
            bias=False,
        )

        self.apply(self._init_weights)
        self.lm_head.weight = self.token_embedding.weight

    @staticmethod
    def _init_weights(module):
        if isinstance(module, nn.Linear):
            nn.init.normal_(module.weight, mean=0.0, std=0.02)
            if module.bias is not None:
                nn.init.zeros_(module.bias)
        elif isinstance(module, nn.Embedding):
            nn.init.normal_(module.weight, mean=0.0, std=0.02)

    def forward(self, idx, targets=None):
        _, seq_len = idx.shape
        if seq_len > self.config.block_size:
            raise ValueError("sequence is longer than block_size")

        positions = torch.arange(seq_len, device=idx.device)
        x = self.token_embedding(idx) + self.position_embedding(positions)
        x = self.dropout(x)

        for block in self.blocks:
            x = block(x)

        logits = self.lm_head(self.ln_f(x))
        loss = None
        if targets is not None:
            loss = F.cross_entropy(
                logits.reshape(-1, self.config.vocab_size),
                targets.reshape(-1),
            )
        return logits, loss

    @torch.no_grad()
    def generate(
        self,
        idx,
        max_new_tokens,
        temperature=1.0,
        top_k=None,
    ):
        if temperature <= 0:
            raise ValueError("temperature must be greater than 0")

        self.eval()
        for _ in range(max_new_tokens):
            idx_cond = idx[:, -self.config.block_size:]
            logits, _ = self(idx_cond)
            logits = logits[:, -1, :] / temperature

            if top_k is not None:
                k = min(top_k, logits.size(-1))
                threshold = torch.topk(logits, k).values[:, [-1]]
                logits = logits.masked_fill(
                    logits < threshold,
                    float("-inf"),
                )

            probabilities = F.softmax(logits, dim=-1)
            next_token = torch.multinomial(probabilities, num_samples=1)
            idx = torch.cat((idx, next_token), dim=1)
        return idx


class Trainer:
    def __init__(
        self,
        model,
        train_data,
        val_data,
        device,
        batch_size,
        max_steps,
        warmup_steps,
        max_lr=3e-3,
        min_lr=3e-4,
    ):
        self.model = model
        self.train_data = train_data
        self.val_data = val_data
        self.device = device
        self.batch_size = batch_size
        self.max_steps = max_steps
        self.warmup_steps = min(warmup_steps, max_steps)
        self.max_lr = max_lr
        self.min_lr = min_lr

        decay = [
            p for p in model.parameters()
            if p.requires_grad and p.dim() >= 2
        ]
        no_decay = [
            p for p in model.parameters()
            if p.requires_grad and p.dim() < 2
        ]
        self.optimizer = torch.optim.AdamW(
            [
                {"params": decay, "weight_decay": 0.1},
                {"params": no_decay, "weight_decay": 0.0},
            ],
            lr=max_lr,
            betas=(0.9, 0.95),
        )

    def get_batch(self, split):
        source = self.train_data if split == "train" else self.val_data
        block_size = self.model.config.block_size
        starts = torch.randint(
            len(source) - block_size - 1,
            (self.batch_size,),
        )
        x = torch.stack([
            source[i:i + block_size] for i in starts
        ])
        y = torch.stack([
            source[i + 1:i + block_size + 1] for i in starts
        ])
        return x.to(self.device), y.to(self.device)

    def get_lr(self, step):
        if step < self.warmup_steps:
            return self.max_lr * (step + 1) / self.warmup_steps
        if self.max_steps == self.warmup_steps:
            return self.max_lr

        ratio = (
            (step - self.warmup_steps)
            / (self.max_steps - self.warmup_steps)
        )
        coefficient = 0.5 * (1.0 + math.cos(math.pi * ratio))
        return self.min_lr + coefficient * (self.max_lr - self.min_lr)

    @torch.no_grad()
    def estimate_loss(self, eval_iters):
        self.model.eval()
        result = {}
        for split in ("train", "val"):
            losses = []
            for _ in range(eval_iters):
                x, y = self.get_batch(split)
                _, loss = self.model(x, y)
                losses.append(loss.item())
            result[split] = sum(losses) / len(losses)
        self.model.train()
        return result

    def train(self, eval_interval, eval_iters):
        self.model.train()
        for step in range(self.max_steps):
            learning_rate = self.get_lr(step)
            for group in self.optimizer.param_groups:
                group["lr"] = learning_rate

            x, y = self.get_batch("train")
            _, loss = self.model(x, y)
            self.optimizer.zero_grad(set_to_none=True)
            loss.backward()
            grad_norm = torch.nn.utils.clip_grad_norm_(
                self.model.parameters(),
                1.0,
            )
            self.optimizer.step()

            should_report = (
                (step + 1) % eval_interval == 0
                or step + 1 == self.max_steps
            )
            if should_report:
                metrics = self.estimate_loss(eval_iters)
                print(
                    f"step={step + 1}, "
                    f"train={metrics['train']:.4f}, "
                    f"val={metrics['val']:.4f}, "
                    f"lr={learning_rate:.6f}, "
                    f"grad={float(grad_norm):.3f}",
                    flush=True,
                )


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--steps", type=int, default=1000)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--eval-interval", type=int, default=200)
    parser.add_argument("--eval-iters", type=int, default=20)
    parser.add_argument("--repeats", type=int, default=120)
    parser.add_argument("--prompt", default="春天")
    parser.add_argument("--max-new-tokens", type=int, default=100)
    parser.add_argument("--temperature", type=float, default=0.8)
    parser.add_argument("--top-k", type=int, default=8)
    parser.add_argument("--device", choices=("auto", "cpu", "cuda"), default="auto")
    parser.add_argument("--save-path", default="mini_gpt.pt")
    parser.add_argument("--no-save", action="store_true")
    return parser.parse_args()


def resolve_device(name):
    if name == "auto":
        return torch.device("cuda" if torch.cuda.is_available() else "cpu")
    if name == "cuda" and not torch.cuda.is_available():
        raise RuntimeError("CUDA was requested but is not available")
    return torch.device(name)


def main():
    args = parse_args()
    if args.steps <= 0 or args.batch_size <= 0 or args.eval_iters <= 0:
        raise ValueError("steps, batch-size, and eval-iters must be positive")

    torch.manual_seed(42)
    random.seed(42)
    device = resolve_device(args.device)

    text = RAW_TEXT * args.repeats
    tokenizer = CharacterTokenizer(text)
    data = torch.tensor(tokenizer.encode(text), dtype=torch.long)
    split_index = int(0.9 * len(data))
    train_data = data[:split_index]
    val_data = data[split_index:]

    config = GPTConfig(vocab_size=tokenizer.vocab_size)
    minimum_length = config.block_size + 2
    if len(train_data) < minimum_length or len(val_data) < minimum_length:
        raise ValueError("increase --repeats so both splits exceed block_size")

    model = MiniGPT(config).to(device)
    parameter_count = sum(p.numel() for p in model.parameters())
    print(f"device={device}, vocab_size={config.vocab_size}, parameters={parameter_count}")

    trainer = Trainer(
        model=model,
        train_data=train_data,
        val_data=val_data,
        device=device,
        batch_size=args.batch_size,
        max_steps=args.steps,
        warmup_steps=100,
    )
    trainer.train(args.eval_interval, args.eval_iters)

    prompt = torch.tensor(
        [tokenizer.encode(args.prompt)],
        dtype=torch.long,
        device=device,
    )
    torch.manual_seed(7)
    generated = model.generate(
        prompt,
        max_new_tokens=args.max_new_tokens,
        temperature=args.temperature,
        top_k=args.top_k,
    )
    print("\ngenerated:\n" + tokenizer.decode(generated[0].tolist()))

    if not args.no_save:
        save_path = Path(args.save_path)
        torch.save(
            {
                "model": model.state_dict(),
                "optimizer": trainer.optimizer.state_dict(),
                "config": asdict(config),
                "stoi": tokenizer.stoi,
                "itos": tokenizer.itos,
            },
            save_path,
        )
        print(f"checkpoint saved to {save_path.resolve()}")


if __name__ == "__main__":
    main()
