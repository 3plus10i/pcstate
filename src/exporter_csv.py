"""
CSV 导出模块 - 导出活动数据为 CSV 文件
"""

import os
import sys
import csv
import sqlite3
from datetime import datetime, timedelta, date
from typing import List, Tuple, Optional

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.utils import get_script_dir


def get_export_dir() -> str:
    """获取导出目录"""
    export_dir = os.path.join(get_script_dir(), 'PCState-export')
    os.makedirs(export_dir, exist_ok=True)
    return export_dir


def get_db_path() -> str:
    """获取数据库文件路径"""
    return os.path.join(get_script_dir(), 'pcstate.db')


def query_activity_data(days: int) -> List[Tuple]:
    """
    查询指定天数范围内的活动数据
    
    Args:
        days: 查询最近多少天的数据
    
    Returns:
        数据列表 [(time, is_active, prog_name), ...]
    """
    db_path = get_db_path()
    if not os.path.exists(db_path):
        print(f"数据库文件不存在: {db_path}")
        return []
    
    # 计算时间范围
    end_dt = datetime.now()
    start_dt = end_dt - timedelta(days=days)
    
    # 转换为分钟时间戳（与数据库存储格式一致）
    start_time = int(start_dt.timestamp() // 60)
    end_time = int(end_dt.timestamp() // 60)
    
    conn = sqlite3.connect(db_path)
    cursor = conn.execute(
        'SELECT time, is_active, prog_name FROM activity WHERE time >= ? AND time <= ? ORDER BY time',
        (start_time, end_time)
    )
    results = cursor.fetchall()
    conn.close()
    
    return results, start_dt, end_dt


def format_time(minutes_timestamp: int) -> str:
    """
    将分钟时间戳格式化为 yyyy-mm-dd HH:MM 格式
    
    Args:
        minutes_timestamp: 分钟级时间戳
    
    Returns:
        格式化后的时间字符串
    """
    # 分钟时间戳转秒时间戳
    ts = minutes_timestamp * 60
    dt = datetime.fromtimestamp(ts)
    return dt.strftime('%Y-%m-%d %H:%M')


def export_to_csv(days: int) -> Optional[str]:
    """
    导出指定天数的数据到 CSV 文件
    
    Args:
        days: 导出最近多少天的数据
    
    Returns:
        导出的文件路径，失败返回 None
    """
    results, start_dt, end_dt = query_activity_data(days)
    
    if not results:
        print(f"没有找到最近 {days} 天的数据")
        return None
    
    # 生成文件名：PCStateExport(yyyy-mm-dd_yyyy-mm-dd).csv
    start_date_str = start_dt.strftime('%Y-%m-%d')
    end_date_str = end_dt.strftime('%Y-%m-%d')
    
    filename = f"PCStateExport({start_date_str}_{end_date_str}).csv"
    filepath = os.path.join(get_export_dir(), filename)
    
    # 写入 CSV
    with open(filepath, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.writer(f)
        # 写入表头
        writer.writerow(['time', 'is_active', 'prog_name'])
        
        # 写入数据
        for row in results:
            time_minutes, is_active, prog_name = row
            # 格式化时间
            formatted_time = format_time(time_minutes)
            writer.writerow([formatted_time, is_active, prog_name])
    
    print(f"已导出 {len(results)} 条记录到: {filepath}")
    return filepath


def main():
    """命令行入口"""
    if len(sys.argv) < 2:
        print("用法: python exporter_csv.py <天数>")
        print("示例: python exporter_csv.py 7")
        sys.exit(1)
    
    try:
        days = int(sys.argv[1])
    except ValueError:
        print("天数必须是整数")
        sys.exit(1)
    
    if days not in [7, 30, 90]:
        print("天数必须是 7、30 或 90")
        sys.exit(1)
    
    export_to_csv(days)


if __name__ == '__main__':
    main()
