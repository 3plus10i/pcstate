"""
存储后端抽象基类
所有存储实现必须继承此类
"""

from abc import ABC, abstractmethod
from datetime import date
from typing import List, Optional


class StorageBackend(ABC):
    """
    存储后端抽象基类
    
    职责：统一读写接口，隔离具体存储实现
    """
    
    @abstractmethod
    def get_log_path(self, target_date: Optional[date] = None) -> str:
        """
        获取存储路径
        
        Args:
            target_date: 目标日期，None 表示当天
            
        Returns:
            存储文件/目录路径
        """
        pass
    
    @abstractmethod
    def write(self, hour: int, minute: int) -> None:
        """
        写入一条活跃记录
        
        Args:
            hour: 小时 (0-23)
            minute: 分钟 (0-59)
        """
        pass
    
    @abstractmethod
    def read_by_date(self, target_date: date) -> List[str]:
        """
        读取指定日期的所有记录
        
        Args:
            target_date: 目标日期
            
        Returns:
            时间记录列表，格式为 HHMM 字符串
        """
        pass
    
    @abstractmethod
    def get_slots(self, target_date: date) -> List[int]:
        """
        获取指定日期的5分钟槽位统计
        
        Args:
            target_date: 目标日期
            
        Returns:
            288个槽位的活跃计数，每个槽位代表5分钟
        """
        pass
