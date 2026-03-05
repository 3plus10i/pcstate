"""
生成数据JS文件
读取logs目录下最近14天的日志，生成data.js供viewer.html使用
"""
import os
import json
from datetime import date, timedelta


def get_script_dir():
    return os.path.dirname(os.path.abspath(__file__))


def get_recent_dates(days=14):
    """获取最近N天的日期列表（最新的在前）"""
    dates = []
    today = date.today()
    for i in range(days):
        d = today - timedelta(days=i)
        dates.append(d.strftime('%Y-%m-%d'))
    return dates


def parse_log_file(filepath):
    """
    解析日志文件
    返回: 288长度数组，每个元素0-5表示该5分钟时间片活跃次数
    """
    # 初始化288个时间片，全部为0
    slots = [0] * 288
    
    if not os.path.exists(filepath):
        return slots
    
    # 使用集合去重（同一分钟可能多次记录）
    minute_set = set()
    with open(filepath, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and len(line) == 4:  # HHMM格式
                minute_set.add(line)
    
    # 统计每个时间片出现的分钟数
    for minute_str in minute_set:
        try:
            hour = int(minute_str[:2])
            minute = int(minute_str[2:4])
            
            # 计算时间片索引
            slot = hour * 12 + minute // 5
            
            if 0 <= slot < 288:
                slots[slot] += 1
        except ValueError:
            continue
    
    return slots


def generate_js():
    """生成JS文件"""
    script_dir = get_script_dir()
    log_dir = os.path.join(script_dir, 'logs')
    temp_dir = os.path.join(script_dir, 'temp')
    os.makedirs(temp_dir, exist_ok=True)
    output_file = os.path.join(temp_dir, 'data.js')
    
    # 14天的数据（每个元素是一天的288个时间片）
    log_data = []
    dates = get_recent_dates(14)
    
    for date_str in dates:
        filename = os.path.join(log_dir, f'pcstate-{date_str}.log')
        slots = parse_log_file(filename)
        log_data.append(slots)
    
    # 生成JS内容
    js_content = f"const LOG_DATA = {json.dumps(log_data, ensure_ascii=False)};\n"
    js_content += f"const DATES = {json.dumps(dates, ensure_ascii=False)};\n"
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(js_content)
    
    # 统计有效数据
    valid_days = sum(1 for slots in log_data if sum(slots) > 0)
    print(f"已生成 data.js，{valid_days} 天有效数据")


if __name__ == '__main__':
    generate_js()
