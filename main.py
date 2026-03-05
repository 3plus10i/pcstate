"""
PC状态监控客户端 - 主入口
系统托盘运行，定时检测PC活跃状态
使用 Windows API 实现托盘，无需 PIL
"""
import threading
import time
import os
import sys
import platform
import subprocess
import webbrowser
from datetime import datetime, timedelta

import win32api
import win32gui
import win32con

# 导入本地模块
import idle_detector
import logger


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
        return os.path.dirname(os.path.abspath(__file__))


def get_resource_path(relative_path):
    """获取资源文件路径（打包后从_MEIPASS解压目录读取）"""
    if getattr(sys, 'frozen', False):
        # PyInstaller 打包后，资源文件在 _MEIPASS 临时目录
        base_path = sys._MEIPASS
    else:
        # 开发环境，资源文件在项目目录
        base_path = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base_path, relative_path)


def create_window():
    """创建隐藏窗口用于接收托盘消息"""
    wc = win32gui.WNDCLASS()
    wc.hInstance = win32api.GetModuleHandle(None)
    wc.lpszClassName = "PCStateMonitor"
    wc.lpfnWndProc = wnd_proc

    class_atom = win32gui.RegisterClass(wc)
    hwnd = win32gui.CreateWindow(
        class_atom,
        "PC State Monitor",
        0,
        0, 0, 0, 0,
        0, 0, wc.hInstance, None
    )
    return hwnd


def wnd_proc(hwnd, msg, wparam, lparam):
    """窗口消息处理"""
    global running

    if msg == win32con.WM_USER + 1:  # 托盘图标点击
        if lparam == win32con.WM_RBUTTONUP:  # 右键
            show_menu(hwnd)
        elif lparam == win32con.WM_LBUTTONDBLCLK:  # 双击
            open_viewer()

    elif msg == win32con.WM_COMMAND:
        cmd = wparam & 0xFFFF
        if cmd == 1000:
            open_project_homepage()
        elif cmd == 1001:
            open_viewer()
        elif cmd == 1002:
            open_log_file()
        elif cmd == 1003:
            open_install_dir()
        elif cmd == 1004:
            running = False
            win32gui.DestroyWindow(hwnd)

    elif msg == win32con.WM_DESTROY:
        running = False
        win32gui.PostQuitMessage(0)

    return win32gui.DefWindowProc(hwnd, msg, wparam, lparam)


def load_icon(icon_path):
    """加载图标文件，失败时返回None"""
    if not os.path.exists(icon_path):
        return None
    try:
        # 使用ExtractIconEx加载图标文件（更兼容的方式）
        import win32ui
        large, small = win32gui.ExtractIconEx(icon_path, 0)
        if small:
            return small[0]
        if large:
            return large[0]
    except Exception as e:
        print(f"加载图标失败 {icon_path}: {e}")
    return None


def add_tray_icon(hwnd, status='idle'):
    """添加系统托盘图标"""
    global hwnd_active, hwnd_idle

    # 加载图标（从资源目录读取，打包后在_MEIPASS）
    icon_active_path = get_resource_path(os.path.join('public', 'icon_active.ico'))
    icon_idle_path = get_resource_path(os.path.join('public', 'icon_idle.ico'))

    # 尝试加载自定义图标，失败则使用系统图标
    hicon_active = load_icon(icon_active_path)
    if hicon_active is None:
        hicon_active = win32gui.LoadIcon(0, win32con.IDI_APPLICATION)
        print("使用系统默认活跃图标")
    else:
        print(f"成功加载活跃图标: {icon_active_path}")

    hicon_idle = load_icon(icon_idle_path)
    if hicon_idle is None:
        hicon_idle = win32gui.LoadIcon(0, win32con.IDI_APPLICATION)
        print("使用系统默认闲置图标")
    else:
        print(f"成功加载闲置图标: {icon_idle_path}")

    hwnd_active = hicon_active
    hwnd_idle = hicon_idle

    hicon = hicon_active if status == 'active' else hicon_idle

    # 添加托盘图标
    flags = win32gui.NIF_ICON | win32gui.NIF_MESSAGE | win32gui.NIF_TIP
    nid = (
        hwnd,           # 窗口句柄
        0,              # 托盘图标ID
        flags,          # 标志
        win32con.WM_USER + 1,  # 回调消息
        hicon,          # 图标句柄
        "PC状态监控"     # 提示文本
    )

    win32gui.Shell_NotifyIcon(win32gui.NIM_ADD, nid)


def update_tray_icon(status):
    """更新托盘图标"""
    global hwnd_active, hwnd_idle

    hicon = hwnd_active if status == 'active' else hwnd_idle
    pc_name = platform.node()

    flags = win32gui.NIF_ICON | win32gui.NIF_TIP
    nid = (
        hwnd,
        0,
        flags,
        0,
        hicon,
        f"PC监控 - {pc_name} ({'活跃' if status == 'active' else '闲置'})"
    )

    win32gui.Shell_NotifyIcon(win32gui.NIM_MODIFY, nid)


def open_project_homepage():
    """打开项目主页"""
    webbrowser.open('https://github.com/3plus10i/pcstate')


def show_menu(hwnd):
    """显示托盘菜单"""
    menu = win32gui.CreatePopupMenu()
    win32gui.AppendMenu(menu, win32con.MF_STRING, 1000, "PCState状态监控")
    win32gui.AppendMenu(menu, win32con.MF_SEPARATOR, 0, "")
    win32gui.AppendMenu(menu, win32con.MF_STRING, 1001, "查看报表")
    win32gui.AppendMenu(menu, win32con.MF_STRING, 1002, "查看日志")
    win32gui.AppendMenu(menu, win32con.MF_STRING, 1003, "安装目录")
    win32gui.AppendMenu(menu, win32con.MF_SEPARATOR, 0, "")
    win32gui.AppendMenu(menu, win32con.MF_STRING, 1004, "退出")

    # 显示菜单
    pos = win32gui.GetCursorPos()
    win32gui.SetForegroundWindow(hwnd)
    win32gui.TrackPopupMenu(
        menu,
        win32con.TPM_LEFTALIGN | win32con.TPM_BOTTOMALIGN,
        pos[0], pos[1],
        0, hwnd, None
    )
    win32gui.PostMessage(hwnd, win32con.WM_NULL, 0, 0)


def open_log_file():
    """用系统默认程序打开日志文件"""
    log_path = logger.get_log_path()
    if os.path.exists(log_path):
        os.startfile(log_path)
    else:
        print("日志文件尚未创建")


def generate_data_js():
    """生成数据JS文件（内嵌gen_data.py功能）"""
    import json
    from datetime import date, timedelta

    def get_recent_dates(days=14):
        dates = []
        today = date.today()
        for i in range(days):
            d = today - timedelta(days=i)
            dates.append(d.strftime('%Y-%m-%d'))
        return dates

    def parse_log_file(filepath):
        slots = [0] * 288
        if not os.path.exists(filepath):
            return slots

        minute_set = set()
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and len(line) == 4:
                        minute_set.add(line)
        except Exception:
            return slots

        for minute_str in minute_set:
            try:
                hour = int(minute_str[:2])
                minute = int(minute_str[2:4])
                slot = hour * 12 + minute // 5
                if 0 <= slot < 288:
                    slots[slot] = min(slots[slot] + 1, 5)
            except ValueError:
                continue
        return slots

    script_dir = get_script_dir()
    log_dir = os.path.join(script_dir, 'logs')
    temp_dir = os.path.join(script_dir, 'temp')
    os.makedirs(temp_dir, exist_ok=True)
    output_file = os.path.join(temp_dir, 'data.js')

    log_data = []
    dates = get_recent_dates(14)

    for date_str in dates:
        filename = os.path.join(log_dir, f'pcstate-{date_str}.log')
        slots = parse_log_file(filename)
        log_data.append(slots)

    js_content = f"const LOG_DATA = {json.dumps(log_data, ensure_ascii=False)};\n"
    js_content += f"const DATES = {json.dumps(dates, ensure_ascii=False)};\n"

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(js_content)

    valid_days = sum(1 for slots in log_data if sum(slots) > 0)
    print(f"已生成 data.js，{valid_days} 天有效数据")
    return True


def open_viewer():
    """生成数据并打开可视化报表"""
    import shutil
    script_dir = get_script_dir()
    temp_dir = os.path.join(script_dir, 'temp')
    viewer_template = get_resource_path(os.path.join('public', 'viewer.html'))
    viewer_path = os.path.join(temp_dir, 'viewer.html')

    # 确保temp目录存在
    os.makedirs(temp_dir, exist_ok=True)

    # 生成数据文件
    try:
        generate_data_js()
    except Exception as e:
        print(f"生成数据失败: {e}")
        return

    # 复制viewer.html模板到temp目录
    if os.path.exists(viewer_template):
        shutil.copy2(viewer_template, viewer_path)
        print(f"已复制报表模板到: {viewer_path}")
    else:
        print(f"报表模板不存在: {viewer_template}")
        return

    # 打开temp目录下的viewer.html
    if os.path.exists(viewer_path):
        os.startfile(viewer_path)
    else:
        print("报表文件不存在")


def open_install_dir():
    """打开安装目录"""
    script_dir = get_script_dir()
    os.startfile(script_dir)


def check_and_report():
    """检测当前状态并记录"""
    global current_status

    interval = 60  # 固定1分钟

    while running:
        now = datetime.now()

        # 检查上一分钟是否有活动
        idle_time = idle_detector.get_idle_duration()
        is_active = idle_time < 60

        new_status = 'active' if is_active else 'idle'

        # 如果上一分钟有活动，记录上一分钟
        if is_active:
            check_time = now - timedelta(minutes=1)
            record = f"{check_time.hour:02d}{check_time.minute:02d}"
            logger.write_log(record)

        # 状态变化时更新托盘图标
        if new_status != current_status:
            current_status = new_status
            update_tray_icon(new_status)

        # 等待下一次检测
        time.sleep(interval)


def main():
    """主函数"""
    global hwnd

    pc_name = platform.node()
    print(f"PC监控启动: {pc_name}")
    print(f"检测间隔: 60 秒（固定）")

    # 创建隐藏窗口
    hwnd = create_window()

    # 添加托盘图标
    add_tray_icon(hwnd, 'idle')

    # 启动后台检测线程
    check_thread = threading.Thread(target=check_and_report, daemon=True)
    check_thread.start()

    # 消息循环
    win32gui.PumpMessages()

    # 清理托盘图标
    nid = (hwnd, 0)
    win32gui.Shell_NotifyIcon(win32gui.NIM_DELETE, nid)


if __name__ == '__main__':
    main()
