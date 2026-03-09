"""
TDR 存储后端
单文件存储14天数据，二进制环形结构
"""

import os
import sys
from datetime import date, datetime
from typing import List, Optional

from .base import StorageBackend


class TDRStorage(StorageBackend):
    """TDR 二进制存储"""
    
    def __init__(self):
        from src.version import TDR_CONFIG
        self._config = TDR_CONFIG
        self._logs_dir = self._get_logs_dir()
    
    def _get_logs_dir(self) -> str:
        """获取日志目录"""
        if getattr(sys, 'frozen', False):
            base_dir = os.path.dirname(sys.executable)
        else:
            # src/storage -> src -> 项目根目录
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        logs_dir = os.path.join(base_dir, 'logs')
        os.makedirs(logs_dir, exist_ok=True)
        return logs_dir
    
    def get_log_path(self, target_date: Optional[date] = None) -> str:
        # TDR 单文件存储，忽略 target_date
        return os.path.join(self._logs_dir, 'pcstate.tdr')
    
    def write(self, hour: int, minute: int) -> None:
        from tdr import TDR
        
        # 计算时间戳（毫秒）
        base_date = date.today()
        timestamp = int(datetime.combine(
            base_date,
            datetime.min.time().replace(hour=hour, minute=minute)
        ).timestamp() * 1000)
        
        log_path = self.get_log_path()
        with TDR(log_path, **self._config) as tdr:
            tdr.write(timestamp, 1, pad_value=0)
    
    def read_by_date(self, target_date: date) -> List[str]:
        from tdr import TDR
        
        log_path = self.get_log_path()
        if not os.path.exists(log_path):
            return []
        
        result = []
        with TDR(log_path) as tdr:
            for minute in range(1440):
                hour = minute // 60
                min_part = minute % 60
                
                timestamp = int(datetime.combine(
                    target_date,
                    datetime.min.time().replace(hour=hour, minute=min_part)
                ).timestamp() * 1000)
                
                value = tdr.read(timestamp)
                if value == 1:
                    result.append(f"{hour:02d}{min_part:02d}")
        
        return result
    
    def get_slots(self, target_date: date) -> List[int]:
        from tdr import TDR
        
        log_path = self.get_log_path()
        if not os.path.exists(log_path):
            return [0] * 288
        
        slots = [0] * 288
        with TDR(log_path) as tdr:
            for minute in range(1440):
                hour = minute // 60
                min_part = minute % 60
                
                timestamp = int(datetime.combine(
                    target_date,
                    datetime.min.time().replace(hour=hour, minute=min_part)
                ).timestamp() * 1000)
                
                value = tdr.read(timestamp)
                if value == 1:
                    slot = hour * 12 + min_part // 5
                    if 0 <= slot < 288:
                        slots[slot] = min(slots[slot] + 1, 5)
        
        return slots
