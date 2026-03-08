"""
日志模块 - 提供日志文件路径生成和读写功能
"""
import os
import sys
from datetime import date


def get_logs_dir() -> str:
    """获取日志目录路径"""
    if getattr(sys, 'frozen', False):
        base_dir = os.path.dirname(sys.executable)
    else:
        base_dir = os.path.dirname(os.path.abspath(__file__))
    logs_dir = os.path.join(base_dir, 'logs')
    if not os.path.exists(logs_dir):
        os.makedirs(logs_dir)
    return logs_dir


def get_log_path(target_date=None) -> str:
    """
    获取日志文件路径

    Args:
        target_date: 指定日期的date对象，如果为None则使用当天日期

    Returns:
        日志文件的完整路径
    """
    logs_dir = get_logs_dir()
    if target_date is None:
        target_date = date.today()
    date_str = target_date.strftime('%Y-%m-%d')
    return os.path.join(logs_dir, f'pcstate-{date_str}.log')


def write_log(record: str, log_path: str) -> None:
    """
    写入日志记录到指定文件

    Args:
        record: 时间记录，格式 HHMM（例如：1621 表示 16:21）
        log_path: 日志文件完整路径
    """
    with open(log_path, 'a', encoding='utf-8') as f:
        f.write(record + '\n')


def get_log_files() -> list:
    """
    获取所有日志文件列表（按日期排序，最新的在前）
    """
    logs_dir = get_logs_dir()
    if not os.path.exists(logs_dir):
        return []
    
    files = [f for f in os.listdir(logs_dir) if f.startswith('pcstate-') and f.endswith('.log')]
    # 排序，最新的在前
    files.sort(reverse=True)
    return files


def read_log_by_date(log_date: str) -> list:
    """
    读取指定日期的日志
    
    Args:
        log_date: 日期字符串，格式 "YYYY-MM-DD"
    
    Returns:
        时间记录列表，每个元素为 HHMM 格式的字符串
    """
    logs_dir = get_logs_dir()
    log_path = os.path.join(logs_dir, f'pcstate-{log_date}.log')
    
    if not os.path.exists(log_path):
        return []
    
    result = []
    with open(log_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line:
                result.append(line)
    
    return result


def read_recent_logs(lines: int = 20) -> str:
    """读取最近若干行日志"""
    log_path = get_log_path()
    
    if not os.path.exists(log_path):
        return "暂无日志记录"
    
    with open(log_path, 'r', encoding='utf-8') as f:
        all_lines = f.readlines()
    
    recent = all_lines[-lines:] if len(all_lines) > lines else all_lines
    return ''.join(recent)


if __name__ == '__main__':
    # 测试
    import time
    write_log('1621')
    time.sleep(1)
    write_log('1622')
    print("日志文件:", get_log_path())
    print("最近日志:", read_recent_logs())
    print("所有日志文件:", get_log_files())
