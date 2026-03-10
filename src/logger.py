"""
日志模块 - 存储层适配器
提供向后兼容的接口，内部委托给存储后端
"""

from datetime import date
from typing import List, Optional

from src.storage import get_backend


# 模块级后端实例（延迟初始化）
_backend = None


def _get_backend():
    """获取存储后端单例"""
    global _backend
    if _backend is None:
        _backend = get_backend()
    return _backend


def get_log_path(target_date: Optional[date] = None) -> str:
    """获取日志文件路径"""
    return _get_backend().get_log_path(target_date)


def write_log(record: str, log_path: str = None) -> None:
    """
    写入日志记录
    
    Args:
        record: 时间记录，格式 HHMM（例如：1621 表示 16:21）
        log_path: 忽略，保留向后兼容
    """
    hour = int(record[:2])
    minute = int(record[2:4])
    _get_backend().write(hour, minute)


def read_log_by_date(log_date: str) -> List[str]:
    """读取指定日期的日志"""
    target_date = date.fromisoformat(log_date)
    return _get_backend().read_by_date(target_date)


def get_slots_by_date(target_date: date) -> List[int]:
    """获取指定日期的槽位统计"""
    return _get_backend().get_slots(target_date)


# ============ 以下为向后兼容的遗留接口 ============

def get_logs_dir() -> str:
    """获取日志目录"""
    import os
    return os.path.dirname(get_log_path())


def get_log_files() -> List[str]:
    """获取所有日志文件列表"""
    import os
    from version import STORAGE_MODE
    
    logs_dir = get_logs_dir()
    if not os.path.exists(logs_dir):
        return []
    
    ext = '.tdr' if STORAGE_MODE == 'tdr' else '.log'
    files = [f for f in os.listdir(logs_dir) 
             if f.startswith('pcstate') and f.endswith(ext)]
    files.sort(reverse=True)
    return files


def read_recent_logs(lines: int = 20) -> str:
    """读取最近若干行日志（仅文本模式）"""
    from version import STORAGE_MODE
    
    if STORAGE_MODE != 'text':
        return "非文本模式不支持逐行读取"
    
    log_path = get_log_path()
    if not log_path or not os.path.exists(log_path):
        return "暂无日志记录"
    
    import os
    with open(log_path, 'r', encoding='utf-8') as f:
        all_lines = f.readlines()
    
    recent = all_lines[-lines:] if len(all_lines) > lines else all_lines
    return ''.join(recent)


if __name__ == '__main__':
    # 测试
    print("存储后端:", _get_backend().__class__.__name__)
    print("日志路径:", get_log_path())
