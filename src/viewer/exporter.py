"""
数据导出器 - 提取数据文件和页面资源
"""

import os
import sys
import json
import shutil
from datetime import date, timedelta
from typing import List, Tuple

from src.version import VERSION
from src.storage import get_backend


def get_script_dir() -> str:
    """获取脚本所在目录"""
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    else:
        return os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def get_temp_dir() -> str:
    """获取临时目录"""
    temp_dir = os.path.join(get_script_dir(), 'temp')
    os.makedirs(temp_dir, exist_ok=True)
    return temp_dir


def get_viewer_dir() -> str:
    """获取 viewer 资源目录"""
    if getattr(sys, 'frozen', False):
        return os.path.join(sys._MEIPASS, 'viewer')
    else:
        return os.path.join(get_script_dir(), 'viewer')


def get_recent_dates(days: int = 14) -> List[str]:
    """获取最近N天的日期列表"""
    dates = []
    today = date.today()
    for i in range(days):
        d = today - timedelta(days=i)
        dates.append(d.strftime('%Y-%m-%d'))
    return dates


def export_data() -> Tuple[str, int]:
    """
    导出数据到 JS 文件

    Returns:
        (文件路径, 有效天数)
    """
    temp_dir = get_temp_dir()
    output_file = os.path.join(temp_dir, 'data.js')

    log_data = []
    dates = get_recent_dates(14)
    backend = get_backend()

    for date_str in dates:
        target_date = date.fromisoformat(date_str)
        slots = backend.get_slots(target_date)
        log_data.append(slots)

    js_content = f"const LOG_DATA = {json.dumps(log_data, ensure_ascii=False)};\n"
    js_content += f"const DATES = {json.dumps(dates, ensure_ascii=False)};\n"
    js_content += f"const APP_VERSION = '{VERSION}';\n"

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(js_content)

    valid_days = sum(1 for slots in log_data if sum(slots) > 0)
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

    # 复制 index.html
    html_src = os.path.join(viewer_dir, 'index.html')
    html_dst = os.path.join(temp_dir, 'index.html')

    if os.path.exists(html_src):
        # 修改 index.html，在 </body> 前插入 data.js 引用
        with open(html_src, 'r', encoding='utf-8') as f:
            html_content = f.read()

        # 在 </body> 前插入 data.js 脚本
        if '</body>' in html_content:
            html_content = html_content.replace('</body>', '    <script src="data.js"></script>\n</body>')

        with open(html_dst, 'w', encoding='utf-8') as f:
            f.write(html_content)

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
