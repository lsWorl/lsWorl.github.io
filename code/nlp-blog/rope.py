"""RoPE examples used by the accompanying blog post."""

import math

import torch
import torch.nn.functional as F
from torch import nn


def precompute_rope(
    head_dim: int,
    max_seq_len: int,
    base: float = 10000.0,
    device: torch.device | None = None,
) -> tuple[torch.Tensor, torch.Tensor]:
    if head_dim % 2 != 0:
        raise ValueError("head_dim must be even for RoPE")

    pair_index = torch.arange(
        0, head_dim, 2, dtype=torch.float32, device=device
    )
    inv_freq = base ** (-pair_index / head_dim)
    positions = torch.arange(
        max_seq_len, dtype=torch.float32, device=device
    )
    angles = torch.outer(positions, inv_freq)
    return angles.cos(), angles.sin()


def rotate_pairs(x: torch.Tensor) -> torch.Tensor:
    x_pairs = x.float().reshape(*x.shape[:-1], -1, 2)
    x_even = x_pairs[..., 0]
    x_odd = x_pairs[..., 1]
    return torch.stack((-x_odd, x_even), dim=-1).flatten(-2)


def apply_rotary(
    q: torch.Tensor,
    k: torch.Tensor,
    cos: torch.Tensor,
    sin: torch.Tensor,
) -> tuple[torch.Tensor, torch.Tensor]:
    q_float = q.float()
    k_float = k.float()

    q_out = q_float * cos + rotate_pairs(q_float) * sin
    k_out = k_float * cos + rotate_pairs(k_float) * sin
    return q_out.to(q.dtype), k_out.to(k.dtype)


class RotaryEmbedding(nn.Module):
    def __init__(self, head_dim: int, base: float = 10000.0):
        super().__init__()

        if head_dim % 2 != 0:
            raise ValueError("head_dim must be even for RoPE")

        pair_index = torch.arange(0, head_dim, 2).float()
        inv_freq = base ** (-pair_index / head_dim)
        self.register_buffer("inv_freq", inv_freq, persistent=False)

    def forward(
        self,
        x: torch.Tensor,
        position_ids: torch.Tensor,
    ) -> tuple[torch.Tensor, torch.Tensor]:
        angles = (
            position_ids.float().unsqueeze(-1)
            * self.inv_freq.view(1, 1, -1)
        )
        angles = torch.repeat_interleave(angles, 2, dim=-1)

        cos = angles.cos().unsqueeze(1)
        sin = angles.sin().unsqueeze(1)
        return cos, sin


class RoPECausalSelfAttention(nn.Module):
    def __init__(
        self,
        n_embd: int,
        n_head: int,
        dropout: float = 0.0,
        rope_base: float = 10000.0,
    ):
        super().__init__()

        if n_embd % n_head != 0:
            raise ValueError("n_embd must be divisible by n_head")

        self.n_head = n_head
        self.head_dim = n_embd // n_head

        if self.head_dim % 2 != 0:
            raise ValueError("head_dim must be even for full RoPE")

        self.qkv = nn.Linear(n_embd, 3 * n_embd, bias=False)
        self.out_proj = nn.Linear(n_embd, n_embd, bias=False)
        self.resid_dropout = nn.Dropout(dropout)
        self.attn_dropout = dropout
        self.rope = RotaryEmbedding(self.head_dim, base=rope_base)

    def forward(
        self,
        x: torch.Tensor,
        position_ids: torch.Tensor | None = None,
    ) -> torch.Tensor:
        batch_size, seq_len, channels = x.shape

        if position_ids is None:
            position_ids = torch.arange(
                seq_len, device=x.device
            ).unsqueeze(0).expand(batch_size, -1)

        q, k, v = self.qkv(x).chunk(3, dim=-1)

        def split_heads(tensor: torch.Tensor) -> torch.Tensor:
            return tensor.view(
                batch_size, seq_len, self.n_head, self.head_dim
            ).transpose(1, 2)

        q = split_heads(q)
        k = split_heads(k)
        v = split_heads(v)

        cos, sin = self.rope(q, position_ids)
        q, k = apply_rotary(q, k, cos, sin)

        output = F.scaled_dot_product_attention(
            q,
            k,
            v,
            is_causal=True,
            dropout_p=(self.attn_dropout if self.training else 0.0),
        )
        output = output.transpose(1, 2).contiguous()
        output = output.view(batch_size, seq_len, channels)
        return self.resid_dropout(self.out_proj(output))


def rotate_2d(x: torch.Tensor, angle: float) -> torch.Tensor:
    rotation = torch.tensor(
        [
            [math.cos(angle), -math.sin(angle)],
            [math.sin(angle), math.cos(angle)],
        ],
        dtype=x.dtype,
    )
    return rotation @ x


def verify_manual_relative_position_example() -> None:
    q = torch.tensor([1.0, 2.0])
    k = torch.tensor([3.0, 4.0])
    theta = math.pi / 2

    q_at_1 = rotate_2d(q, theta)
    k_at_2 = rotate_2d(k, 2 * theta)
    absolute_score = q_at_1 @ k_at_2

    relative_score = q @ rotate_2d(k, theta)

    torch.testing.assert_close(absolute_score, torch.tensor(2.0))
    torch.testing.assert_close(relative_score, torch.tensor(2.0))
    print("absolute rotation score:", absolute_score.item())
    print("relative rotation score:", relative_score.item())


def verify_manual_attention_example() -> None:
    theta = math.pi / 2
    q_1 = rotate_2d(torch.tensor([1.0, 0.0]), theta)
    k_0 = torch.tensor([1.0, 0.0])
    k_1 = rotate_2d(torch.tensor([1.0, 0.0]), theta)

    scores = torch.stack((q_1 @ k_0, q_1 @ k_1)) / math.sqrt(2)
    weights = F.softmax(scores, dim=-1)

    values = torch.tensor([[10.0, 0.0], [0.0, 20.0]])
    output = weights @ values

    torch.testing.assert_close(
        weights,
        torch.tensor([0.3302, 0.6698]),
        rtol=1e-4,
        atol=1e-4,
    )
    torch.testing.assert_close(
        output,
        torch.tensor([3.3024, 13.3952]),
        rtol=1e-4,
        atol=1e-4,
    )
    print("attention weights:", weights)
    print("attention output:", output)


def verify_rope_properties() -> None:
    torch.manual_seed(7)

    batch_size = 2
    num_heads = 3
    seq_len = 8
    head_dim = 6

    q = torch.randn(batch_size, num_heads, seq_len, head_dim)
    k = torch.randn(batch_size, num_heads, seq_len, head_dim)

    cos_table, sin_table = precompute_rope(head_dim, seq_len)
    position_ids = torch.arange(seq_len).unsqueeze(0).expand(
        batch_size, -1
    )

    cos = cos_table[position_ids].repeat_interleave(2, dim=-1)
    sin = sin_table[position_ids].repeat_interleave(2, dim=-1)
    cos = cos.unsqueeze(1)
    sin = sin.unsqueeze(1)

    q_rotated, k_rotated = apply_rotary(q, k, cos, sin)

    torch.testing.assert_close(
        q.norm(dim=-1),
        q_rotated.norm(dim=-1),
        rtol=1e-5,
        atol=1e-5,
    )
    torch.testing.assert_close(q[:, :, 0], q_rotated[:, :, 0])
    torch.testing.assert_close(k[:, :, 0], k_rotated[:, :, 0])

    base_q = torch.randn(1, 1, 1, head_dim).expand(1, 1, seq_len, -1)
    base_k = torch.randn(1, 1, 1, head_dim).expand(1, 1, seq_len, -1)
    q_same, k_same = apply_rotary(
        base_q,
        base_k,
        cos[:1],
        sin[:1],
    )

    score_13 = (q_same[0, 0, 1] * k_same[0, 0, 3]).sum()
    score_57 = (q_same[0, 0, 5] * k_same[0, 0, 7]).sum()
    torch.testing.assert_close(score_13, score_57, rtol=1e-5, atol=1e-5)

    print("norm preservation: passed")
    print("position zero identity: passed")
    print("relative position invariance: passed")


def smoke_test_attention() -> None:
    attention = RoPECausalSelfAttention(
        n_embd=32,
        n_head=4,
        dropout=0.1,
    )
    x = torch.randn(2, 12, 32)
    output = attention(x)
    assert output.shape == x.shape
    print("attention output shape:", tuple(output.shape))


if __name__ == "__main__":
    verify_manual_relative_position_example()
    verify_manual_attention_example()
    verify_rope_properties()
    smoke_test_attention()
