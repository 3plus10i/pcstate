"""
闲置检测模块 - 使用 Windows API 获取最后输入时间
"""
import ctypes
from ctypes import wintypes
import time


# Windows API: GetLastInputInfo, GetTickCount64
# https://docs.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getlastinputinfo
user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32

class LASTINPUTINFO(ctypes.Structure):
    _fields_ = [
        ('cbSize', wintypes.UINT),
        ('dwTime', wintypes.DWORD),
    ]


def get_idle_duration() -> int:
    """
    获取系统闲置时长（秒）
    返回自用户最后输入以来的秒数
    """
    lii = LASTINPUTINFO()
    lii.cbSize = ctypes.sizeof(LASTINPUTINFO)
    
    if user32.GetLastInputInfo(ctypes.byref(lii)):
        # 获取系统运行时间（毫秒），GetTickCount64 返回 ULONGLONG，不会溢出
        kernel32.GetTickCount64.restype = ctypes.c_ulonglong
        tick_count = kernel32.GetTickCount64()
        # 计算闲置时长（秒）
        idle_ms = tick_count - lii.dwTime
        return idle_ms // 1000
    else:
        # 如果获取失败，返回大数（视为不活跃）
        return 1000000000


def is_active(threshold: int = 300) -> bool:
    """
    判断当前是否处于活跃状态
    
    Args:
        threshold: 闲置阈值（秒），默认300秒（5分钟）
    
    Returns:
        True = 活跃, False = 闲置
    """
    idle_time = get_idle_duration()
    return idle_time < threshold


if __name__ == '__main__':
    # 测试
    print(f"当前闲置时长: {get_idle_duration()} 秒")
    print(f"当前状态: {'活跃' if is_active() else '闲置'}")
