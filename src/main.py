"""
PCState - PC活跃状态记录器
系统托盘运行，定时检测PC活跃状态
使用 Windows API 实现托盘
"""

import threading
import time
import os
import sys
import platform
import webbrowser
from datetime import datetime, timedelta

import win32api
import win32gui
import win32con

from src import idle_detector, logger, startup_manager, config
from version import VERSION
from src.exporter import export_data, get_viewer_files


# 全局状态
current_status = 'idle'
running = True
hwnd = None
hwnd_active = None
hwnd_idle = None


def get_script_dir():
    """获取脚本所在目录（exe所在目录，用于logs/temp等运行时文件）"""
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    else:
        return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def create_window():
    """创建隐藏窗口用于接收托盘消息"""
    wc = win32gui.WNDCLASS()
    wc.hInstance = win32api.GetModuleHandle(None)
    wc.lpszClassName = "PCStateMonitor"
    wc.lpfnWndProc = wnd_proc

    class_atom = win32gui.RegisterClass(wc)
    hwnd = win32gui.CreateWindow(
        class_atom, "PC State Monitor", 0,
        0, 0, 0, 0, 0, 0, wc.hInstance, None
    )
    return hwnd


def wnd_proc(hwnd, msg, wparam, lparam):
    """窗口消息处理"""
    global running

    if msg == win32con.WM_USER + 1:
        if lparam == win32con.WM_RBUTTONUP:
            show_menu(hwnd)
        elif lparam == win32con.WM_LBUTTONDBLCLK:
            open_viewer()

    elif msg == win32con.WM_COMMAND:
        cmd = wparam & 0xFFFF
        if cmd == 1000:
            webbrowser.open('https://github.com/3plus10i/pcstate')
        elif cmd == 1001:
            open_viewer()
        elif cmd == 1003:
            os.startfile(get_script_dir())
        elif cmd == 1004:
            running = False
            win32gui.DestroyWindow(hwnd)
        elif cmd == 1005:
            toggle_startup()
        elif cmd == 1010:  # 午夜0时
            config.set_day_start_hour(0)
        elif cmd == 1011:  # 凌晨4时
            config.set_day_start_hour(4)

    elif msg == win32con.WM_DESTROY:
        running = False
        win32gui.PostQuitMessage(0)

    return win32gui.DefWindowProc(hwnd, msg, wparam, lparam)


def load_icon(icon_path):
    """加载图标文件"""
    if not os.path.exists(icon_path):
        return None
    try:
        large, small = win32gui.ExtractIconEx(icon_path, 0)
        return small[0] if small else (large[0] if large else None)
    except Exception:
        return None


def add_tray_icon(hwnd, status='idle'):
    """添加系统托盘图标"""
    global hwnd_active, hwnd_idle

    if getattr(sys, 'frozen', False):
        base_path = sys._MEIPASS
    else:
        base_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    icon_active = load_icon(os.path.join(base_path, 'public', 'icon_active.ico'))
    icon_idle = load_icon(os.path.join(base_path, 'public', 'icon_idle.ico'))

    if icon_active is None:
        icon_active = win32gui.LoadIcon(0, win32con.IDI_APPLICATION)
    if icon_idle is None:
        icon_idle = win32gui.LoadIcon(0, win32con.IDI_APPLICATION)

    hwnd_active = icon_active
    hwnd_idle = icon_idle

    hicon = icon_active if status == 'active' else icon_idle
    nid = (hwnd, 0, win32gui.NIF_ICON | win32gui.NIF_MESSAGE | win32gui.NIF_TIP,
           win32con.WM_USER + 1, hicon, "PCState - PC活跃状态记录器")
    win32gui.Shell_NotifyIcon(win32gui.NIM_ADD, nid)


def update_tray_icon(status):
    """更新托盘图标"""
    hicon = hwnd_active if status == 'active' else hwnd_idle
    nid = (hwnd, 0, win32gui.NIF_ICON | win32gui.NIF_TIP, 0, hicon,
           f"PCState - {platform.node()} ({'活跃' if status == 'active' else '闲置'})")
    win32gui.Shell_NotifyIcon(win32gui.NIM_MODIFY, nid)


def toggle_startup():
    """切换开机启动状态"""
    if startup_manager.is_startup_enabled():
        startup_manager.remove_from_startup()
    else:
        startup_manager.add_to_startup()


def show_menu(hwnd):
    """显示托盘菜单"""
    menu = win32gui.CreatePopupMenu()
    win32gui.AppendMenu(menu, win32con.MF_STRING, 1000, f"PCState v{VERSION}")
    win32gui.AppendMenu(menu, win32con.MF_SEPARATOR, 0, "")
    
    startup_text = "开机启动: 已启用" if startup_manager.is_startup_enabled() else "开机启动: 未启用"
    win32gui.AppendMenu(menu, win32con.MF_STRING, 1005, startup_text)
    
    # 一天起始时间子菜单
    submenu = win32gui.CreatePopupMenu()
    day_start = config.get_day_start_hour()
    
    midnight_check = win32con.MF_CHECKED if day_start == 0 else win32con.MF_STRING
    dawn_check = win32con.MF_CHECKED if day_start == 4 else win32con.MF_STRING
    
    win32gui.AppendMenu(submenu, midnight_check, 1010, "午夜0时")
    win32gui.AppendMenu(submenu, dawn_check, 1011, "凌晨4时")
    
    # 将子菜单附加到主菜单
    win32gui.AppendMenu(menu, win32con.MF_POPUP, submenu, "一天起始时间")
    
    win32gui.AppendMenu(menu, win32con.MF_SEPARATOR, 0, "")
    win32gui.AppendMenu(menu, win32con.MF_STRING, 1001, "查看报表")
    win32gui.AppendMenu(menu, win32con.MF_STRING, 1003, "打开程序目录")
    win32gui.AppendMenu(menu, win32con.MF_SEPARATOR, 0, "")
    win32gui.AppendMenu(menu, win32con.MF_STRING, 1004, "退出")

    pos = win32gui.GetCursorPos()
    win32gui.SetForegroundWindow(hwnd)
    win32gui.TrackPopupMenu(menu, win32con.TPM_LEFTALIGN | win32con.TPM_BOTTOMALIGN,
                            pos[0], pos[1], 0, hwnd, None)
    win32gui.PostMessage(hwnd, win32con.WM_NULL, 0, 0)


def open_viewer():
    """打开数据检视页面"""
    try:
        # 导出数据
        data_file, valid_days = export_data()
        print(f"已生成数据: {valid_days} 天")
        
        # 获取页面文件
        html_path, _ = get_viewer_files()
        
        if os.path.exists(html_path):
            os.startfile(html_path)
        else:
            print(f"页面文件不存在: {html_path}")
    except Exception as e:
        print(f"打开检视器失败: {e}")


def check_and_report():
    """检测当前状态并记录"""
    global current_status

    while running:
        now = datetime.now()
        idle_time = idle_detector.get_idle_duration()
        is_active = idle_time < 60
        new_status = 'active' if is_active else 'idle'

        if is_active:
            check_time = now - timedelta(minutes=1)
            record = f"{check_time.hour:02d}{check_time.minute:02d}"
            logger.write_log(record)

        if new_status != current_status:
            current_status = new_status
            update_tray_icon(new_status)

        time.sleep(60)


def main():
    """主函数"""
    global hwnd
    print(f"PCState启动: {platform.node()}")

    hwnd = create_window()
    add_tray_icon(hwnd, 'idle')

    threading.Thread(target=check_and_report, daemon=True).start()
    win32gui.PumpMessages()

    win32gui.Shell_NotifyIcon(win32gui.NIM_DELETE, (hwnd, 0))


if __name__ == '__main__':
    main()
