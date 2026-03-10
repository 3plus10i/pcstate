"""
用户配置管理
存储在 logs/config.json 文件中
"""

import os
import sys
import json
from typing import Dict, Any


def get_config_dir() -> str:
    """获取配置目录"""
    if getattr(sys, 'frozen', False):
        base_dir = os.path.dirname(sys.executable)
    else:
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base_dir, 'logs')


def get_config_path() -> str:
    """获取配置文件路径"""
    config_dir = get_config_dir()
    os.makedirs(config_dir, exist_ok=True)
    return os.path.join(config_dir, 'config.json')


def load_config() -> Dict[str, Any]:
    """加载配置"""
    config_path = get_config_path()
    
    if not os.path.exists(config_path):
        return {'day_start_hour': 0}  # 默认午夜0时
    
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {'day_start_hour': 0}


def save_config(config: Dict[str, Any]) -> None:
    """保存配置"""
    config_path = get_config_path()
    with open(config_path, 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=2, ensure_ascii=False)


def get_day_start_hour() -> int:
    """获取一天起始小时（0或4）"""
    config = load_config()
    return config.get('day_start_hour', 0)


def set_day_start_hour(hour: int) -> None:
    """设置一天起始小时"""
    if hour not in [0, 4]:
        raise ValueError("day_start_hour must be 0 or 4")
    
    config = load_config()
    config['day_start_hour'] = hour
    save_config(config)


if __name__ == '__main__':
    # 测试
    print(f"配置文件: {get_config_path()}")
    print(f"当前一天起始时间: {get_day_start_hour()}时")
