"""L1: 业务层 - TDR 主类，时间戳管理，读写接口.

调用链:
- write() → 判定 Gap → 计算索引范围 → 调用 L2 解环层 → L3+L4+L5 区间填充
- read() → 时间戳校验 → 计算物理位置 → 读取数据
"""

import os
import mmap
from pathlib import Path
from typing import Optional, Union

from .header import Header, HEADER_SIZE
from .ring import RingBuffer
from .bitops import calculate_position, read_bits, write_bits
from .filler import fill_index_range


class TDR:
    """
    Time Data Ring - 定长环形时序存储结构.
    
    核心特性:
    - 固定大小: 创建时即分配全部空间，生命周期内体积恒定
    - 环形覆盖: 过期数据自动被新数据覆盖
    - 位压缩: 支持 n ∈ {1,2,4,8,16,32,64,128}，最大化空间利用率
    - 内存映射: O(1) 访问速度
    """
    
    def __init__(
        self,
        filepath: Union[str, Path],
        length: Optional[int] = None,
        step: Optional[int] = None,
        bit_width: Optional[int] = None,
        remarks: str = ""
    ):
        """
        打开或创建 TDR 文件.
        
        Args:
            filepath: 文件路径
            length: 缓冲区容量 L(创建时必需)
            step: 时间步长 ms(创建时必需)
            bit_width: 位宽 n(创建时必需)
            remarks: 备注(创建时可选)
        
        Raises:
            FileNotFoundError: 文件不存在且未提供创建参数
            ValueError: 参数无效
        """
        self.filepath = Path(filepath)
        self._mmap: Optional[mmap.mmap] = None
        
        if self.filepath.exists():
            # 打开现有文件
            self._open_existing()
        else:
            # 创建新文件
            if length is None or step is None or bit_width is None:
                raise ValueError("创建新文件需要提供 length, step, bit_width")
            self._create_new(length, step, bit_width, remarks)
        
        # 初始化环形缓冲区管理器
        self._ring = RingBuffer(self.header.length)
    
    def _open_existing(self):
        """打开现有 TDR 文件."""
        file_size = self.filepath.stat().st_size
        
        with open(self.filepath, 'rb') as f:
            header_data = f.read(HEADER_SIZE)
        
        self.header = Header.from_bytes(header_data)
        
        expected_size = self.header.file_size
        if file_size != expected_size:
            raise ValueError(f"文件大小不匹配: {file_size} != {expected_size}")
        
        # 内存映射
        self._mmap_file()
    
    def _create_new(self, length: int, step: int, bit_width: int, remarks: str):
        """创建新 TDR 文件."""
        self.header = Header(
            length=length,
            step=step,
            bit_width=bit_width,
            remarks=remarks
        )
        
        # 创建文件并分配空间
        self.filepath.parent.mkdir(parents=True, exist_ok=True)
        
        with open(self.filepath, 'wb') as f:
            # 写入头部
            f.write(self.header.to_bytes())
            # 分配数据区
            f.write(b'\x00' * self.header.data_size)
        
        # 内存映射
        self._mmap_file()
    
    def _mmap_file(self):
        """建立内存映射."""
        with open(self.filepath, 'r+b') as f:
            self._mmap = mmap.mmap(f.fileno(), 0)
    
    def _sync_header(self):
        """同步头部到文件."""
        if self._mmap is None:
            return
        self._mmap[:HEADER_SIZE] = self.header.to_bytes()
    
    def close(self):
        """关闭文件并释放资源."""
        if self._mmap is not None:
            self._mmap.close()
            self._mmap = None
    
    def __enter__(self):
        """上下文管理器入口."""
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """上下文管理器出口."""
        self.close()
        return False
    
    @property
    def is_empty(self) -> bool:
        """检查是否还未写入数据."""
        return self.header.is_empty()
    
    @property
    def window_size_ms(self) -> int:
        """获取时间窗口大小(ms)."""
        return self.header.length * self.header.step
    
    def _update_header_timestamps(self, begin_ts: Optional[int] = None, last_ts: Optional[int] = None):
        """更新头部时间戳."""
        if begin_ts is not None:
            self.header.begin_ts = begin_ts
        if last_ts is not None:
            self.header.last_ts = last_ts
        self._sync_header()
    
    def read(self, timestamp: int) -> Optional[int]:
        """
        读取指定时间戳的数据.
        
        Args:
            timestamp: 时间戳(ms)
        
        Returns:
            数据值，如果无效则返回 None
        """
        if self._mmap is None:
            raise RuntimeError("TDR file not open")
        
        # 有效性校验
        valid, _ = self._ring.is_valid_timestamp(
            timestamp, self.header.begin_ts, self.header.last_ts, self.header.step
        )
        if not valid:
            return None
        
        # 计算物理位置
        index = self._ring.timestamp_to_index(timestamp, self.header.step)
        byte_offset, bit_shift = calculate_position(index, self.header.bit_width, HEADER_SIZE)
        
        # 读取数据
        return read_bits(self._mmap, byte_offset, bit_shift, self.header.bit_width)
    
    def write(self, timestamp: int, value: int, pad_value: int = 0):
        """
        写入时间戳数据.
        
        Args:
            timestamp: 时间戳(ms)
            value: 要写入的值
            pad_value: 间隙填充值(默认0)
        """
        if self._mmap is None:
            raise RuntimeError("TDR file not open")
        
        n = self.header.bit_width
        mask = (1 << n) - 1
        value = value & mask
        pad_value = pad_value & mask
        
        # 首环记录
        if self.is_empty:
            self._update_header_timestamps(begin_ts=timestamp, last_ts=timestamp)
            self._write_at_timestamp(timestamp, value)
            return
        
        # Gap 检测（间断检测）
        gap = timestamp - self.header.last_ts
        window_size = self.window_size_ms
        
        if gap <= 0:
            # 时间戳必须单调递增
            raise ValueError(f"timestamp must be > last_ts ({self.header.last_ts}), got {timestamp}")
        
        if gap >= window_size:
            # 情况 A: 超环间断 - 重置时间戳，旧数据自动失效
            self._update_header_timestamps(begin_ts=timestamp, last_ts=timestamp)
            self._write_at_timestamp(timestamp, value)
            return
        
        # 计算索引
        last_idx = self._ring.timestamp_to_index(self.header.last_ts, self.header.step)
        curr_idx = self._ring.timestamp_to_index(timestamp, self.header.step)
        
        if gap > self.header.step:
            # 情况 B: 环内间断 - 需要区间填充
            # 计算填充索引范围 [last_idx+1, curr_idx-1]，经 L2 解环层处理环形跨越
            if last_idx < curr_idx:
                # 无跨越: 直接填充
                if last_idx + 1 <= curr_idx - 1:
                    fill_index_range(
                        self._mmap,
                        last_idx + 1,
                        curr_idx - 1,
                        n,
                        pad_value,
                        self.header.length,
                        HEADER_SIZE
                    )
            else:
                # 跨越环尾: 拆分为 [last_idx+1, L-1] 和 [0, curr_idx-1] 两段填充
                if last_idx + 1 <= self.header.length - 1:
                    fill_index_range(
                        self._mmap,
                        last_idx + 1,
                        self.header.length - 1,
                        n,
                        pad_value,
                        self.header.length,
                        HEADER_SIZE
                    )
                if curr_idx > 0:
                    fill_index_range(
                        self._mmap,
                        0,
                        curr_idx - 1,
                        n,
                        pad_value,
                        self.header.length,
                        HEADER_SIZE
                    )
        
        # 情况 C: 正常追加或情况 B 后续 - 写入当前值
        self._write_at_timestamp(timestamp, value)
        self._update_header_timestamps(last_ts=timestamp)
    
    def _write_at_timestamp(self, timestamp: int, value: int):
        """在指定时间戳位置写入值(不更新时间戳)."""
        index = self._ring.timestamp_to_index(timestamp, self.header.step)
        byte_offset, bit_shift = calculate_position(index, self.header.bit_width, HEADER_SIZE)
        write_bits(self._mmap, byte_offset, bit_shift, self.header.bit_width, value)
    
    def get_range(self, start_ts: int, end_ts: int):
        """
        获取时间范围内的数据迭代器.
        
        Args:
            start_ts: 起始时间戳(包含)
            end_ts: 结束时间戳(包含)
        
        Yields:
            (timestamp, value) 元组
        """
        if self.is_empty:
            return
        
        step = self.header.step
        
        # 调整范围
        start_ts = max(start_ts, self.header.begin_ts)
        end_ts = min(end_ts, self.header.last_ts)
        
        # 对齐到步长
        start_tick = (start_ts + step // 2) // step
        end_tick = (end_ts + step // 2) // step
        
        for tick in range(start_tick, end_tick + 1):
            ts = tick * step
            value = self.read(ts)
            if value is not None:
                yield ts, value
