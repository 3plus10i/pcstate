"""L3+L4+L5: 区间(间断)填充逻辑.

区间填充策略表:
| 区间长度\数据位宽 | n<8（字节对齐问题）          | n>=8           |
|------------------|------------------------------|----------------|
| <64B             | 逐值写入                     | 逐值写入       |
| 64B ~ 64KB       | 头体尾字节对齐+体部切片写入   | 切片写入       |
| >=64KB           | 头体尾字节对齐+体部切片&分块切片写入 | 切片写入+分块切片写入 |

术语定义:
- 位: 1bit
- 字节: 8位=1B
- 位宽(n): uint8, 2的幂次 (1,2,4,8,16,32,64,128)
- 值: n位数据
- 填充值: n位填充数据
- 填充模式: max(n,8)位, 将n位值重复填充到8位
- 切片缓冲buffer: 64B~64KB, 将填充模式重复构造的临时bytes
- 分块切片缓冲blockBuffer: 64KB, 预分配的64KB填充块
- 64B逐值阈值: 512位=64B
- 64KB分块阈值: 65536字节

分层架构:
L3 分流层 → 根据位宽选择填充策略
L4 字节对齐三段模型 → 头-体-尾分解，处理字节对齐问题
L5 字节填充 → 构造填充模式，切片写入或分块循环填充
"""

import mmap
from typing import List, Tuple
from .bitops import make_pattern, fill_partial_byte


# 64KB 分块阈值
BLOCK_SIZE = 64 * 1024

# 64B 逐值阈值 (512位)
SMALL_FILL_THRESHOLD_BITS = 512

# 预分配的分块切片缓冲 blockBuffer 缓存
_pattern_blocks: dict = {}


def get_block_buffer(pattern: int) -> bytes:
    """
    获取预分配的 64KB 分块切片缓冲 blockBuffer.
    
    Args:
        pattern: 8位填充模式
    
    Returns:
        64KB bytes 对象
    """
    if pattern not in _pattern_blocks:
        _pattern_blocks[pattern] = bytes([pattern]) * BLOCK_SIZE
    return _pattern_blocks[pattern]


def byte_fill(mmap_obj: mmap.mmap, start: int, size: int, pattern: int):
    """
    L5: 字节填充.
    
    构造填充模式，对64KB取模部分构造切片缓冲buffer填充，
    对64KB簇使用分块切片缓冲blockBuffer循环填充.
    
    Args:
        mmap_obj: 内存映射对象
        start: 起始字节偏移
        size: 填充字节数
        pattern: 8位填充模式
    """
    if size <= 0:
        return
    
    offset = start
    remaining = size
    
    # 处理 64KB 整数倍: 使用分块切片缓冲 blockBuffer 循环填充
    if remaining >= BLOCK_SIZE:
        block = get_block_buffer(pattern)
        while remaining >= BLOCK_SIZE:
            mmap_obj[offset:offset + BLOCK_SIZE] = block
            offset += BLOCK_SIZE
            remaining -= BLOCK_SIZE
    
    # 处理剩余: 构造切片缓冲buffer填充
    if remaining > 0:
        mmap_obj[offset:offset + remaining] = bytes([pattern]) * remaining


def fill_head_body_tail(
    mmap_obj: mmap.mmap,
    bit_start: int,
    bit_end: int,
    n: int,
    pattern: int,
    base_offset: int = 512
):
    """
    L4: 字节对齐三段模型.
    
    将位范围分解为头-体-尾三段处理:
    - 头部: 非字节对齐部分，Read-Modify-Write 保护无关位
    - 体部: 字节对齐部分，调用 L5 字节填充
    - 尾部: 非字节对齐部分，Read-Modify-Write 保护无关位
    
    Args:
        mmap_obj: 内存映射对象
        bit_start: 起始位偏移(相对于数据区起始)
        bit_end: 结束位偏移(包含)
        n: 位宽
        pattern: 8位填充模式
        base_offset: 数据区起始偏移(默认512字节头部)
    """
    if bit_start > bit_end:
        return
    
    start_byte = bit_start // 8
    end_byte = bit_end // 8
    head_shift = bit_start % 8
    tail_end = bit_end % 8
    
    # 确定体部范围(字节对齐部分)
    body_start_byte = start_byte if head_shift == 0 else start_byte + 1
    body_end_byte = end_byte if tail_end == 7 else end_byte - 1
    
    # 处理头部(非字节对齐部分): Read-Modify-Write
    if head_shift != 0 and start_byte <= end_byte:
        if start_byte == end_byte:
            # 全部在同一个字节内
            fill_bits = bit_end - bit_start + 1
        else:
            fill_bits = 8 - head_shift
        
        addr = base_offset + start_byte
        old_val = mmap_obj[addr]
        fill_mask = (1 << fill_bits) - 1
        fill_val = (pattern >> head_shift) & fill_mask
        clear_mask = ~(fill_mask << head_shift) & 0xFF
        mmap_obj[addr] = (old_val & clear_mask) | (fill_val << head_shift)
    
    # 处理体部(字节对齐部分): 调用 L5 字节填充
    if body_start_byte <= body_end_byte:
        body_size = body_end_byte - body_start_byte + 1
        body_offset = base_offset + body_start_byte
        byte_fill(mmap_obj, body_offset, body_size, pattern)
    
    # 处理尾部(非字节对齐部分): Read-Modify-Write
    if tail_end != 7 and end_byte >= body_start_byte:
        addr = base_offset + end_byte
        old_val = mmap_obj[addr]
        tail_bits = tail_end + 1
        fill_mask = (1 << tail_bits) - 1
        fill_val = pattern & fill_mask
        clear_mask = ~(fill_mask) & 0xFF
        mmap_obj[addr] = (old_val & clear_mask) | fill_val


def fill_small_range(
    mmap_obj: mmap.mmap,
    start_idx: int,
    end_idx: int,
    n: int,
    pad_value: int,
    base_offset: int = 512
):
    """
    逐值写入: 填充小范围(< 64B = 512位).
    
    Args:
        mmap_obj: 内存映射对象
        start_idx: 起始索引
        end_idx: 结束索引(包含)
        n: 位宽
        pad_value: n位填充值
        base_offset: 数据区起始偏移
    """
    from .bitops import calculate_position, write_bits
    
    for idx in range(start_idx, end_idx + 1):
        byte_offset, bit_shift = calculate_position(idx, n, base_offset)
        write_bits(mmap_obj, byte_offset, bit_shift, n, pad_value)


def fill_index_range(
    mmap_obj: mmap.mmap,
    start_idx: int,
    end_idx: int,
    n: int,
    pad_value: int,
    length: int,
    base_offset: int = 512
):
    """
    L3: 分流层 - 根据位宽和区间长度选择填充策略.
    
    区间填充策略:
    - <64B: 逐值写入
    - n<8, 64B~64KB: 头体尾字节对齐+体部切片写入
    - n<8, >=64KB: 头体尾字节对齐+体部切片&分块切片写入
    - n>=8, 64B~64KB: 切片写入
    - n>=8, >=64KB: 切片写入+分块切片写入
    
    Args:
        mmap_obj: 内存映射对象
        start_idx: 起始索引
        end_idx: 结束索引(包含)
        n: 位宽(2的幂次)
        pad_value: n位填充值
        length: 缓冲区长度(用于环形跨越检测)
        base_offset: 数据区起始偏移
    """
    # 处理环形跨越: 拆分为1-2个连续范围
    if start_idx > end_idx:
        fill_index_range(mmap_obj, start_idx, length - 1, n, pad_value, length, base_offset)
        fill_index_range(mmap_obj, 0, end_idx, n, pad_value, length, base_offset)
        return
    
    num_indices = end_idx - start_idx + 1
    total_bits = num_indices * n
    
    # <64B (512位): 逐值写入
    if total_bits < SMALL_FILL_THRESHOLD_BITS:
        fill_small_range(mmap_obj, start_idx, end_idx, n, pad_value, base_offset)
        return
    
    # n >= 8: 直接字节填充
    if n >= 8:
        num_bytes = num_indices * (n // 8)
        start_byte = base_offset + start_idx * (n // 8)
        
        # 生成填充模式(小端序多字节)
        fill_val = pad_value & ((1 << n) - 1)
        byte_pattern = fill_val & 0xFF
        byte_fill(mmap_obj, start_byte, num_bytes, byte_pattern)
        return
    
    # n < 8: 使用字节对齐三段模型 (L4)
    pattern = make_pattern(n, pad_value)  # 构造8位填充模式
    bit_start = start_idx * n
    bit_end = (end_idx + 1) * n - 1
    fill_head_body_tail(mmap_obj, bit_start, bit_end, n, pattern, base_offset)
