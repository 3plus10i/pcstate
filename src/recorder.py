"""
记录模块 - SQLite 数据库存储
"""

from datetime import date
from typing import List, Optional

from src.sqlite import SQLiteStorage


# 模块级后端实例（延迟初始化）
_backend = None


def _get_backend() -> SQLiteStorage:
    """获取存储后端单例"""
    global _backend
    if _backend is None:
        _backend = SQLiteStorage()
    return _backend


def get_record_path(target_date: Optional[date] = None) -> str:
    """获取记录文件路径"""
    return _get_backend().get_record_path(target_date)


def write_record(record: str, record_path: str = None) -> None:
    """
    写入记录
    
    Args:
        record: 时间记录，格式 HHMM（例如：1621 表示 16:21）
        record_path: 忽略，保留向后兼容
    """
    hour = int(record[:2])
    minute = int(record[2:4])
    _get_backend().write(hour, minute)


def read_records_by_date(record_date: str) -> List[str]:
    """读取指定日期的记录"""
    target_date = date.fromisoformat(record_date)
    return _get_backend().read_by_date(target_date)


def get_slots_by_date(target_date: date) -> List[int]:
    """获取指定日期的槽位统计"""
    return _get_backend().get_slots(target_date)


def get_records_dir() -> str:
    """获取记录数据文件所在目录"""
    import os
    return os.path.dirname(get_record_path())


def get_record_files() -> List[str]:
    """获取数据库文件列表"""
    import os
    
    db_path = get_record_path()
    if os.path.exists(db_path):
        return [os.path.basename(db_path)]
    return []


if __name__ == '__main__':
    # 测试
    print("存储后端:", _get_backend().__class__.__name__)
    print("数据库路径:", get_record_path())
