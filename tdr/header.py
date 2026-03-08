"""TDR 文件头部定义与序列化."""

import struct
from dataclasses import dataclass
from typing import Optional


# 魔数: TDR\0
MAGIC = b'TDR\x00'
VERSION = 1
HEADER_SIZE = 512

# 支持的位宽: 2的幂次
VALID_BIT_WIDTHS = {1, 2, 4, 8, 16, 32, 64, 128}


@dataclass
class Header:
    """TDR 文件头部结构."""
    
    length: int          # L: 缓冲区容量
    step: int            # Step: 时间步长(ms)
    bit_width: int       # n: 位宽
    begin_ts: int = 0    # BeginTS: 起始时间戳
    last_ts: int = 0     # LastTS: 最新时间戳
    remarks: str = ""    # 备注(UTF-8, 最多472字节)
    
    def __post_init__(self):
        """验证参数有效性."""
        if self.length <= 0:
            raise ValueError(f"length must be > 0, got {self.length}")
        if self.step <= 0:
            raise ValueError(f"step must be > 0, got {self.step}")
        if self.bit_width not in VALID_BIT_WIDTHS:
            raise ValueError(f"bit_width must be in {VALID_BIT_WIDTHS}, got {self.bit_width}")
        remarks_bytes = self.remarks.encode('utf-8')
        if len(remarks_bytes) > 472:
            raise ValueError(f"remarks too long (max 472 bytes), got {len(remarks_bytes)}")
    
    @property
    def data_size(self) -> int:
        """计算数据区字节大小."""
        total_bits = self.length * self.bit_width
        return (total_bits + 7) // 8
    
    @property
    def file_size(self) -> int:
        """计算总文件大小."""
        return HEADER_SIZE + self.data_size
    
    def to_bytes(self) -> bytes:
        """序列化头部为字节."""
        remarks_bytes = self.remarks.encode('utf-8')
        remarks_padded = remarks_bytes.ljust(472, b'\x00')
        
        # 结构: <4sIIIIB3xQQ472s
        # 4s: magic, I: version, I: header_size, I: length, I: step
        # B: bit_width, 3x: reserved, Q: begin_ts, Q: last_ts, 472s: remarks
        return struct.pack(
            '<4sIIIIB3xQQ472s',
            MAGIC,
            VERSION,
            HEADER_SIZE,
            self.length,
            self.step,
            self.bit_width,
            self.begin_ts,
            self.last_ts,
            remarks_padded
        )
    
    @classmethod
    def from_bytes(cls, data: bytes) -> 'Header':
        """从字节反序列化头部."""
        if len(data) < HEADER_SIZE:
            raise ValueError(f"header data too short: {len(data)} < {HEADER_SIZE}")
        
        magic, version, header_size, length, step, bit_width, begin_ts, last_ts, remarks_bytes = \
            struct.unpack('<4sIIIIB3xQQ472s', data[:HEADER_SIZE])
        
        if magic != MAGIC:
            raise ValueError(f"invalid magic: {magic!r}, expected {MAGIC!r}")
        if version != VERSION:
            raise ValueError(f"unsupported version: {version}, expected {VERSION}")
        if header_size != HEADER_SIZE:
            raise ValueError(f"unsupported header size: {header_size}, expected {HEADER_SIZE}")
        
        remarks = remarks_bytes.rstrip(b'\x00').decode('utf-8', errors='replace')
        
        return cls(
            length=length,
            step=step,
            bit_width=bit_width,
            begin_ts=begin_ts,
            last_ts=last_ts,
            remarks=remarks
        )
    
    def is_empty(self) -> bool:
        """检查是否还未写入数据."""
        return self.begin_ts == 0 and self.last_ts == 0
