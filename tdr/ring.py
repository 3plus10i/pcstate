"""L2: 解环层 - 环形缓冲区索引管理."""

from typing import List, Tuple, Optional


class RingBuffer:
    """环形缓冲区索引管理."""
    
    def __init__(self, length: int):
        """
        初始化环形缓冲区.
        
        Args:
            length: 缓冲区容量 L
        """
        self.length = length
    
    def timestamp_to_tick(self, timestamp: int, step: int) -> int:
        """
        时间戳转换为 Tick(四舍五入).
        
        Args:
            timestamp: 时间戳(ms)
            step: 时间步长(ms)
        
        Returns:
            Tick 值
        """
        return (timestamp + step // 2) // step
    
    def tick_to_index(self, tick: int) -> int:
        """
        Tick 转换为环形索引.
        
        Args:
            tick: Tick 值
        
        Returns:
            环形索引 [0, L-1]
        """
        return tick % self.length
    
    def timestamp_to_index(self, timestamp: int, step: int) -> int:
        """
        时间戳直接转换为环形索引.
        
        Args:
            timestamp: 时间戳(ms)
            step: 时间步长(ms)
        
        Returns:
            环形索引 [0, L-1]
        """
        tick = self.timestamp_to_tick(timestamp, step)
        return self.tick_to_index(tick)
    
    def split_range(self, start_idx: int, end_idx: int) -> List[Tuple[int, int]]:
        """
        将索引范围拆分为连续子范围(处理环形跨越).
        
        Args:
            start_idx: 起始索引(包含)
            end_idx: 结束索引(包含)
        
        Returns:
            连续子范围列表 [(start1, end1), (start2, end2), ...]
        """
        if start_idx <= end_idx:
            # 无跨越
            return [(start_idx, end_idx)]
        else:
            # 跨越环尾: [start, L-1] 和 [0, end]
            return [(start_idx, self.length - 1), (0, end_idx)]
    
    def is_valid_timestamp(
        self, 
        timestamp: int, 
        begin_ts: int, 
        last_ts: int, 
        step: int
    ) -> Tuple[bool, Optional[str]]:
        """
        检查时间戳是否有效(可读).
        
        Args:
            timestamp: 要检查的时间戳
            begin_ts: 起始时间戳
            last_ts: 最新时间戳
            step: 时间步长
        
        Returns:
            (是否有效, 错误原因或None)
        """
        if begin_ts == 0 and last_ts == 0:
            return False, "no data written"
        
        if timestamp < begin_ts:
            return False, "timestamp before begin_ts"
        
        if timestamp > last_ts:
            return False, "timestamp in future"
        
        # 检查是否已被覆盖
        window_size = self.length * step
        if timestamp <= last_ts - window_size:
            return False, "timestamp overwritten"
        
        return True, None
