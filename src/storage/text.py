"""
文本存储后端
每天一个 .log 文件，每行一条 HHMM 记录
"""

import os
import sys
from datetime import date
from typing import List, Optional

from .base import StorageBackend


class TextStorage(StorageBackend):
    """文本文件存储"""
    
    def __init__(self):
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
        if target_date is None:
            target_date = date.today()
        date_str = target_date.strftime('%Y-%m-%d')
        return os.path.join(self._logs_dir, f'pcstate-{date_str}.log')
    
    def write(self, hour: int, minute: int) -> None:
        record = f"{hour:02d}{minute:02d}"
        log_path = self.get_log_path()
        with open(log_path, 'a', encoding='utf-8') as f:
            f.write(record + '\n')
    
    def read_by_date(self, target_date: date) -> List[str]:
        log_path = self.get_log_path(target_date)
        if not os.path.exists(log_path):
            return []
        
        result = []
        with open(log_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and len(line) == 4:
                    result.append(line)
        return result
    
    def get_slots(self, target_date: date) -> List[int]:
        slots = [0] * 288
        records = self.read_by_date(target_date)
        
        for minute_str in records:
            try:
                hour = int(minute_str[:2])
                minute = int(minute_str[2:4])
                slot = hour * 12 + minute // 5
                if 0 <= slot < 288:
                    slots[slot] = min(slots[slot] + 1, 5)
            except ValueError:
                continue
        
        return slots
