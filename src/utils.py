"""
工具函数模块
"""

import os
import sys


def get_script_dir() -> str:
    """获取脚本所在目录
    
    Returns:
        脚本/可执行文件所在目录路径
    """
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    else:
        # 向上两层目录：src/utils.py -> src/ -> pcstate/
        return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def get_temp_dir() -> str:
    """获取临时目录
    
    Returns:
        临时目录路径
    """
    temp_dir = os.path.join(get_script_dir(), 'temp')
    os.makedirs(temp_dir, exist_ok=True)
    return temp_dir


def get_records_dir() -> str:
    """获取记录数据文件所在目录
    
    Returns:
        记录数据文件所在目录路径
    """
    # 数据库文件存储在脚本目录根目录
    return get_script_dir()
