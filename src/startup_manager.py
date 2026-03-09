"""
开机启动管理模块
管理 Windows 启动文件夹中的快捷方式
"""
import os
import sys
import winshell
from win32com.client import Dispatch


def get_startup_path():
    """获取用户启动文件夹路径"""
    return winshell.startup()


def get_shortcut_path():
    """获取快捷方式完整路径"""
    startup_dir = get_startup_path()
    return os.path.join(startup_dir, 'PCStateMonitor.lnk')


def is_startup_enabled():
    """检查是否已设置开机启动"""
    return os.path.exists(get_shortcut_path())


def add_to_startup():
    """添加开机启动"""
    try:
        # 获取程序路径
        if getattr(sys, 'frozen', False):
            # 打包后的 exe
            target_path = sys.executable
        else:
            # 开发环境
            target_path = os.path.abspath(sys.argv[0])
        
        shortcut_path = get_shortcut_path()
        
        # 创建快捷方式
        shell = Dispatch('WScript.Shell')
        shortcut = shell.CreateShortCut(shortcut_path)
        shortcut.Targetpath = target_path
        shortcut.WorkingDirectory = os.path.dirname(target_path)
        shortcut.IconLocation = target_path
        shortcut.save()
        
        return True
    except Exception as e:
        print(f"添加开机启动失败: {e}")
        return False


def remove_from_startup():
    """移除开机启动"""
    try:
        shortcut_path = get_shortcut_path()
        if os.path.exists(shortcut_path):
            os.remove(shortcut_path)
        return True
    except Exception as e:
        print(f"移除开机启动失败: {e}")
        return False
