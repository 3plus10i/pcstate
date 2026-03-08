"""
日志模块 - 提供日志文件路径生成和读写功能
支持两种存储方案: text(文本) / tdr(二进制)
"""
import os
import sys
from datetime import date, datetime

from config import STORAGE_MODE, TDR_CONFIG

# TDR 模式需要导入 tdr 模块
if STORAGE_MODE == 'tdr':
    from tdr import TDR


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
    
    if STORAGE_MODE == 'tdr':
        # TDR方案: 单文件存储14天
        return os.path.join(logs_dir, 'pcstate.tdr')
    else:
        # 文本方案: 每天一个文件
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
    if STORAGE_MODE == 'tdr':
        _write_tdr(record, log_path)
    else:
        _write_text(record, log_path)


def _write_text(record: str, log_path: str) -> None:
    """文本方案：追加写入"""
    with open(log_path, 'a', encoding='utf-8') as f:
        f.write(record + '\n')


def _write_tdr(record: str, log_path: str) -> None:
    """TDR方案：二进制存储"""
    # 解析 HHMM 格式
    hour = int(record[:2])
    minute = int(record[2:4])
    
    # 使用当天日期计算时间戳（毫秒）
    base_date = date.today()
    timestamp = int(datetime.combine(
        base_date,
        datetime.min.time().replace(hour=hour, minute=minute)
    ).timestamp() * 1000)
    
    # 写入活跃状态(1)，闲置填充值(0)
    with TDR(log_path, **TDR_CONFIG) as tdr:
        tdr.write(timestamp, 1, pad_value=0)


def get_log_files() -> list:
    """
    获取所有日志文件列表（按日期排序，最新的在前）
    """
    logs_dir = get_logs_dir()
    if not os.path.exists(logs_dir):
        return []
    
    if STORAGE_MODE == 'tdr':
        ext = '.tdr'
    else:
        ext = '.log'
    
    files = [f for f in os.listdir(logs_dir) if f.startswith('pcstate-') and f.endswith(ext)]
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
    if STORAGE_MODE == 'tdr':
        return _read_tdr_by_date(log_date)
    else:
        return _read_text_by_date(log_date)


def _read_text_by_date(log_date: str) -> list:
    """文本方案读取"""
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


def _read_tdr_by_date(log_date: str) -> list:
    """TDR方案读取指定日期数据"""
    from tdr import TDR
    from datetime import datetime
    
    log_path = get_log_path()
    
    if not os.path.exists(log_path):
        return []
    
    result = []
    target_date = date.fromisoformat(log_date)
    
    with TDR(log_path) as tdr:
        # 遍历当天的每一分钟
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


def read_recent_logs(lines: int = 20) -> str:
    """读取最近若干行日志（仅文本方案）"""
    if STORAGE_MODE == 'tdr':
        return "TDR模式不支持逐行读取"
    
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
