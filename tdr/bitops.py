"""位操作工具函数.

提供位读写、位置计算、填充模式生成等基础操作.
"""

from typing import Tuple


def make_pattern(n: int, v: int) -> int:
    """
    构造填充模式: 将 n 位填充值 v 重复填充到 8 位字节.
    
    填充模式大小为 max(n, 8)位 = 8位(1字节).
    
    Args:
        n: 位宽(2的幂次, n<8)
        v: n位填充值
    
    Returns:
        8位填充模式
    
    Example:
        >>> make_pattern(2, 3)   # n=2, v=3(0b11)   -> 0b11111111 = 0xFF
        >>> make_pattern(4, 5)   # n=4, v=5(0b0101) -> 0b01010101 = 0x55
    """
    mask = (1 << n) - 1
    v = v & mask
    pattern = 0
    repeats = 8 // n
    for i in range(repeats):
        pattern |= v << (i * n)
    return pattern


def calculate_position(index: int, n: int, base_offset: int = 512) -> Tuple[int, int]:
    """
    计算索引对应的字节偏移和位偏移.
    
    Args:
        index: 环形缓冲区索引
        n: 位宽
        base_offset: 数据区起始偏移(默认512字节头部)
    
    Returns:
        (byte_offset, bit_shift) 元组
    """
    bit_offset = index * n
    byte_offset = base_offset + bit_offset // 8
    bit_shift = bit_offset % 8
    return byte_offset, bit_shift


def read_bits(data: memoryview, byte_offset: int, bit_shift: int, n: int) -> int:
    """
    从指定位置读取 n 位数据.
    
    Args:
        data: 数据视图
        byte_offset: 字节偏移
        bit_shift: 位偏移(0-7)
        n: 位宽
    
    Returns:
        读取的 n 位值
    """
    if n <= 8:
        # 单字节内读取
        byte_val = data[byte_offset]
        mask = (1 << n) - 1
        return (byte_val >> bit_shift) & mask
    else:
        # 多字节读取(小端序)
        num_bytes = (n + 7) // 8
        result = 0
        for i in range(num_bytes):
            result |= data[byte_offset + i] << (i * 8)
        mask = (1 << n) - 1
        return (result >> bit_shift) & mask


def write_bits(data: memoryview, byte_offset: int, bit_shift: int, n: int, value: int):
    """
    向指定位置写入 n 位数据.
    
    Args:
        data: 数据视图
        byte_offset: 字节偏移
        bit_shift: 位偏移(0-7)
        n: 位宽
        value: 要写入的值
    """
    mask = (1 << n) - 1
    value = value & mask
    
    if n <= 8 and (bit_shift + n) <= 8:
        # 单字节内写入
        old_val = data[byte_offset]
        clear_mask = ~(mask << bit_shift) & 0xFF
        data[byte_offset] = (old_val & clear_mask) | (value << bit_shift)
    elif n <= 8:
        # 跨越两个字节
        old_val_low = data[byte_offset]
        old_val_high = data[byte_offset + 1]
        
        # 低字节部分
        low_bits = 8 - bit_shift
        low_mask = (1 << low_bits) - 1
        low_clear = ~(low_mask << bit_shift) & 0xFF
        data[byte_offset] = (old_val_low & low_clear) | ((value & low_mask) << bit_shift)
        
        # 高字节部分
        high_bits = n - low_bits
        high_mask = (1 << high_bits) - 1
        high_clear = ~high_mask & 0xFF
        data[byte_offset + 1] = (old_val_high & high_clear) | ((value >> low_bits) & high_mask)
    else:
        # 多字节写入(小端序)
        num_bytes = (n + 7) // 8
        
        # 读取旧值
        old_val = 0
        for i in range(num_bytes):
            old_val |= data[byte_offset + i] << (i * 8)
        
        # 修改值
        clear_mask = ~(mask << bit_shift)
        new_val = (old_val & clear_mask) | (value << bit_shift)
        
        # 写回
        for i in range(num_bytes):
            data[byte_offset + i] = (new_val >> (i * 8)) & 0xFF


def fill_partial_byte(data: memoryview, addr: int, shift: int, bits: int, pattern: int):
    """
    填充字节的指定范围 [shift, shift+bits).
    
    Args:
        data: 数据视图
        addr: 字节地址
        shift: 起始位偏移
        bits: 要填充的位数
        pattern: 填充模式(8位)
    """
    old_val = data[addr]
    fill_mask = (1 << bits) - 1
    fill_val = (pattern >> shift) & fill_mask
    clear_mask = ~(fill_mask << shift) & 0xFF
    data[addr] = (old_val & clear_mask) | (fill_val << shift)
