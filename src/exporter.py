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


def get_recent_dates(days: int = 31) -> List[str]:
    """获取最近N天的日期列表"""
    dates = []
    today = date.today()
    for i in range(days):
        d = today - timedelta(days=i)
        dates.append(d.strftime('%Y%m%d'))  # 格式改为 YYYYMMDD
    return dates


# def get_date_range_with_offset(target_date: date, start_hour: int) -> tuple:
#     """
#     根据一天起始时间获取实际的时间范围
    
#     Args:
#         target_date: 目标日期
#         start_hour: 一天起始小时（0或4）
    
#     Returns:
#         (开始日期, 开始小时, 结束日期, 结束小时)
    
#     Examples:
#         target_date=2025-01-01, start_hour=0  -> (2025-01-01, 0, 2025-01-01, 23)
#         target_date=2025-01-01, start_hour=4  -> (2025-01-01, 4, 2025-01-02, 3)
#     """
#     if start_hour == 0:
#         return target_date, 0, target_date, 23
#     else:
#         start_date = target_date
#         end_date = target_date + timedelta(days=1)
#         return start_date, start_hour, end_date, start_hour - 1


# def get_slots_for_custom_day(target_date: date, start_hour: int) -> List[int]:
#     """
#     获取自定义起始时间的一天的槽位数据
    
#     Args:
#         target_date: 目标日期
#         start_hour: 一天起始小时（0或4）
    
#     Returns:
#         288个槽位的活跃计数
#     """
#     backend = SQLiteStorage()
    
#     if start_hour == 0:
#         # 标准模式：直接获取当天数据
#         return backend.get_slots(target_date)
    
#     # 自定义起始时间模式：需要组合两天的数据
#     # 例如 start_hour=4，需要从 target_date 4:00 到 target_date+1 3:59
#     slots = [0] * 288
    
#     # 第一部分：target_date 的 start_hour 到 23:59
#     first_date_slots = backend.get_slots(target_date)
#     for hour in range(start_hour, 24):
#         for minute_slot in range(12):
#             src_idx = hour * 12 + minute_slot
#             dst_hour = hour - start_hour
#             dst_idx = dst_hour * 12 + minute_slot
#             slots[dst_idx] = first_date_slots[src_idx]
    
#     # 第二部分：target_date+1 的 0:00 到 start_hour-1:59
#     next_date = target_date + timedelta(days=1)
#     next_date_slots = backend.get_slots(next_date)
#     for hour in range(0, start_hour):
#         for minute_slot in range(12):
#             src_idx = hour * 12 + minute_slot
#             dst_hour = 24 - start_hour + hour
#             dst_idx = dst_hour * 12 + minute_slot
#             slots[dst_idx] = next_date_slots[src_idx]
    
#     return slots


def merge_hourly_data(app_hourly: List[dict], window_hourly: List[dict]) -> List[dict]:
    """
    合并应用和窗口数据为活动应用
    规则：如果进程名为空或无效，则使用窗口标题
    
    Args:
        app_hourly: 基于进程名的每小时数据
        window_hourly: 基于窗口标题的每小时数据
    
    Returns:
        合并后的每小时数据
    """
    merged = []
    
    for i in range(max(len(app_hourly), len(window_hourly))):
        app_data = app_hourly[i] if i < len(app_hourly) else {}
        window_data = window_hourly[i] if i < len(window_hourly) else {}
        
        hour_merged = {}
        
        # 添加所有应用数据（非空）
        for app_name, value in app_data.items():
            if app_name:  # 非空字符串
                hour_merged[app_name] = hour_merged.get(app_name, 0) + value
        
        # 对于窗口数据，如果这一小时没有有效的应用名，使用窗口标题
        has_valid_app = any(app for app in app_data.keys() if app)
        
        if not has_valid_app:
            for window_name, value in window_data.items():
                if window_name:  # 窗口标题非空
                    hour_merged[window_name] = hour_merged.get(window_name, 0) + value
        
        merged.append(hour_merged)
    
    return merged


def export_data() -> str:
    """
    导出数据到 JS 文件（全局变量格式）
    注意：只导出原始数据（按自然日），起始时间偏移由前端处理
    在导出层合并应用和窗口数据为活动应用
    限制导出最近31天的数据

    Returns:
        文件路径
    """
    temp_dir = get_temp_dir()
    output_file = os.path.join(temp_dir, 'data.js')

    dates = get_recent_dates(31)
    backend = SQLiteStorage()
    day_start_hour = config.get_day_start_hour()

    record_list = []

    for date_str in dates:
        target_date = datetime.strptime(date_str, '%Y%m%d').date()
        
        # 获取每小时应用/窗口数据（原始数据）
        hourly_app_durations = backend.get_hourly_app_durations(target_date)
        hourly_window_durations = backend.get_hourly_window_durations(target_date)
        
        # 合并应用和窗口数据为活动应用
        hourly_merged = merge_hourly_data(hourly_app_durations, hourly_window_durations)
        
        # 获取slots数据（自然日每5分钟的is_active之和）
        slots = backend.get_slots(target_date)
        
        # 检查是否有数据
        has_data = any(len(hour_data) > 0 for hour_data in hourly_merged)

        # 构建记录项
        record_item = {
            "date": date_str,
            "slots": slots,
            "app_hourly": hourly_merged if has_data else [{} for _ in range(24)],
            "window_hourly": hourly_window_durations if has_data else [{} for _ in range(24)],
        }
        record_list.append(record_item)

    # 新数据结构
    pcstate_data = {
        "version": VERSION,
        "day_start_hour": day_start_hour,
        "record": record_list
    }

    # 直接导出为全局变量格式（不是 ES Module）
    js_content = f"window.PCSTATE_DATA = {json.dumps(pcstate_data, ensure_ascii=False)};\n"

    # 写入 temp 目录（生产环境使用）
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(js_content)

    return output_file


def inject_data_script(html_content: str) -> str:
    """
    在 HTML 中注入数据脚本
    
    Args:
        html_content: 原始 HTML 内容
        
    Returns:
        注入数据脚本后的 HTML 内容
    """
    # 生成数据脚本
    temp_dir = get_temp_dir()
    data_file = os.path.join(temp_dir, 'data.js')
    
    # 读取数据文件内容
    data_script_content = ''
    if os.path.exists(data_file):
        with open(data_file, 'r', encoding='utf-8') as f:
            data_script_content = f.read()
    else:
        # 如果没有数据文件，使用默认数据
        data_script_content = 'window.PCSTATE_DATA = {version: "1.0.0", day_start_hour: 0, record: []};'
    
    # 将 ES Module 格式转换为普通脚本格式
    data_script_content = data_script_content.replace(
        'export const PCSTATE_DATA = ',
        'window.PCSTATE_DATA = '
    )
    
    # 创建 script 标签
    data_script_tag = f'<script>\n{data_script_content}\n</script>'
    
    # 替换占位符
    html_content = html_content.replace(
        '<!-- DATA_SCRIPT_PLACEHOLDER -->',
        data_script_tag
    )
    
    return html_content


def get_viewer_files() -> Tuple[str, str]:
    """
    复制 viewer 资源到 temp 目录

    Returns:
        (html路径, 资源目录路径)
    """
    viewer_dir = get_viewer_dir()
    temp_dir = get_temp_dir()

    # 复制 index.html 并注入数据脚本
    html_src = os.path.join(viewer_dir, 'index.html')
    html_dst = os.path.join(temp_dir, 'index.html')

    if os.path.exists(html_src):
        with open(html_src, 'r', encoding='utf-8') as f:
            html_content = f.read()
        
        # 注入数据脚本
        html_content = inject_data_script(html_content)
        
        with open(html_dst, 'w', encoding='utf-8') as f:
            f.write(html_content)

    # 返回 html 路径和 temp 目录（用于浏览器打开）
    return html_dst, temp_dir


def prepare_viewer() -> str:
    """
    准备检视器：导出数据 + 复制页面文件

    Returns:
        HTML 文件路径
    """
    data_file = export_data()
    print(f"已生成数据文件: {data_file}")

    html_path, assets_path = get_viewer_files()
    print(f"页面文件: {html_path}")

    return html_path


if __name__ == '__main__':
    html = prepare_viewer()
    print(f"\n打开: {html}")
