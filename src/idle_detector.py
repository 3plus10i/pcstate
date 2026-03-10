"""闲置检测模块 - 使用 Windows API 获取最后输入时间和活动窗口信息"""
import ctypes
from ctypes import wintypes
import time
import win32gui
import win32process
import win32api
import win32con


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


def get_active_window_info() -> tuple[str, str]:
    """
    获取当前活动窗口的标题和程序名

    Returns:
        (窗口标题, 程序名)
    """
    try:
        hwnd = win32gui.GetForegroundWindow()
        if not hwnd:
            return "", ""

        # 获取窗口标题
        title = win32gui.GetWindowText(hwnd)

        # 获取进程ID和程序名
        _, pid = win32process.GetWindowThreadProcessId(hwnd)
        try:
            handle = win32api.OpenProcess(win32con.PROCESS_QUERY_INFORMATION, False, pid)
            process_name = win32process.GetModuleFileNameEx(handle, 0)
            process_name = process_name.split('\\')[-1]  # 只取文件名
            win32api.CloseHandle(handle)
        except Exception:
            process_name = ""

        return title, process_name
    except Exception:
        return "", ""


if __name__ == '__main__':
    # 测试
    for i in range(10):
        print(f"当前闲置时长: {get_idle_duration()} 秒")
        print(f"当前状态: {'活跃' if is_active() else '闲置'}")
        title, process = get_active_window_info()
        print(f"活动窗口: {title}")
        print(f"活动程序: {process}")
        time.sleep(1)
