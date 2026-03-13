"""
数据导出器 - 提取数据文件和页面资源
"""

import os
import sys
import json
import shutil
from datetime import date, datetime, timedelta
from typing import List, Tuple

from version import VERSION
from src.sqlite import SQLiteStorage
from src import config
from src.utils import get_script_dir, get_temp_dir


def get_viewer_dir() -> str:
    """获取 viewer 资源目录"""
    if getattr(sys, 'frozen', False):
        return os.path.join(sys._MEIPASS, 'viewer')
    else:
        return os.path.join(get_script_dir(), 'viewer')


def get_recent_dates(days: int = 30) -> List[str]:
    """获取最近N天的日期列表"""
    dates = []
    today = date.today()
    for i in range(days):
        d = today - timedelta(days=i)
        dates.append(d.strftime('%Y%m%d'))  # 格式改为 YYYYMMDD
    return dates


def get_date_range_with_offset(target_date: date, start_hour: int) -> tuple:
    """
    根据一天起始时间获取实际的时间范围
    
    Args:
        target_date: 目标日期
        start_hour: 一天起始小时（0或4）
    
    Returns:
        (开始日期, 开始小时, 结束日期, 结束小时)
    
    Examples:
        target_date=2025-01-01, start_hour=0  -> (2025-01-01, 0, 2025-01-01, 23)
        target_date=2025-01-01, start_hour=4  -> (2025-01-01, 4, 2025-01-02, 3)
    """
    if start_hour == 0:
        return target_date, 0, target_date, 23
    else:
        start_date = target_date
        end_date = target_date + timedelta(days=1)
        return start_date, start_hour, end_date, start_hour - 1


def get_slots_for_custom_day(target_date: date, start_hour: int) -> List[int]:
    """
    获取自定义起始时间的一天的槽位数据
    
    Args:
        target_date: 目标日期
        start_hour: 一天起始小时（0或4）
    
    Returns:
        288个槽位的活跃计数
    """
    backend = SQLiteStorage()
    
    if start_hour == 0:
        # 标准模式：直接获取当天数据
        return backend.get_slots(target_date)
    
    # 自定义起始时间模式：需要组合两天的数据
    # 例如 start_hour=4，需要从 target_date 4:00 到 target_date+1 3:59
    slots = [0] * 288
    
    # 第一部分：target_date 的 start_hour 到 23:59
    first_date_slots = backend.get_slots(target_date)
    for hour in range(start_hour, 24):
        for minute_slot in range(12):
            src_idx = hour * 12 + minute_slot
            dst_hour = hour - start_hour
            dst_idx = dst_hour * 12 + minute_slot
            slots[dst_idx] = first_date_slots[src_idx]
    
    # 第二部分：target_date+1 的 0:00 到 start_hour-1:59
    next_date = target_date + timedelta(days=1)
    next_date_slots = backend.get_slots(next_date)
    for hour in range(0, start_hour):
        for minute_slot in range(12):
            src_idx = hour * 12 + minute_slot
            dst_hour = 24 - start_hour + hour
            dst_idx = dst_hour * 12 + minute_slot
            slots[dst_idx] = next_date_slots[src_idx]
    
    return slots


def export_data() -> Tuple[str, int]:
    """
    导出数据到 JS 文件
    注意：只导出原始数据（按自然日），起始时间偏移由前端处理

    Returns:
        (文件路径, 有效天数)
    """
    temp_dir = get_temp_dir()
    output_file = os.path.join(temp_dir, 'data.js')

    dates = get_recent_dates(30)
    backend = SQLiteStorage()
    day_start_hour = config.get_day_start_hour()

    record_list = []

    for date_str in dates:
        target_date = datetime.strptime(date_str, '%Y%m%d').date()
        
        # 直接获取原始数据（按自然日），不做偏移处理
        slots = backend.get_slots(target_date)
        has_data = sum(slots) > 0
        
        # 获取每小时应用/窗口数据（原始数据）
        hourly_app_durations = backend.get_hourly_app_durations(target_date, 0)
        hourly_window_durations = backend.get_hourly_window_durations(target_date, 0)

        # 构建记录项
        record_item = {
            "date": date_str,
            "slots": slots if has_data else [],
            "app_hourly": hourly_app_durations if has_data else [{} for _ in range(24)],
            "window_hourly": hourly_window_durations if has_data else [{} for _ in range(24)],
        }
        record_list.append(record_item)

    # 新数据结构
    pcstate_data = {
        "version": VERSION,
        "day_start_hour": day_start_hour,
        "record": record_list
    }

    js_content = f"export const PCSTATE_DATA = {json.dumps(pcstate_data, ensure_ascii=False)};\n"

    # 写入 temp 目录（生产环境使用）
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(js_content)

    valid_days = sum(1 for r in record_list if len(r["slots"]) > 0 and sum(r["slots"]) > 0)
    return output_file, valid_days


def get_viewer_files() -> Tuple[str, str]:
    """
    复制 viewer 资源到 temp 目录

    Returns:
        (html路径, 资源目录路径)
    """
    viewer_dir = get_viewer_dir()
    temp_dir = get_temp_dir()

    # 复制 assets 目录（如果存在）
    assets_src = os.path.join(viewer_dir, 'assets')
    assets_dst = os.path.join(temp_dir, 'assets')

    if os.path.exists(assets_src):
        if os.path.exists(assets_dst):
            shutil.rmtree(assets_dst)
        shutil.copytree(assets_src, assets_dst)

    # 复制 index.html（data.js 引用已在源文件中硬编码）
    html_src = os.path.join(viewer_dir, 'index.html')
    html_dst = os.path.join(temp_dir, 'index.html')

    if os.path.exists(html_src):
        shutil.copy2(html_src, html_dst)

    return html_dst, assets_dst


def prepare_viewer() -> str:
    """
    准备检视器：导出数据 + 复制页面文件

    Returns:
        HTML 文件路径
    """
    data_file, valid_days = export_data()
    print(f"已生成数据文件: {data_file}")
    print(f"有效数据: {valid_days} 天")

    html_path, assets_path = get_viewer_files()
    print(f"页面文件: {html_path}")

    return html_path


if __name__ == '__main__':
    html = prepare_viewer()
    print(f"\n打开: {html}")
