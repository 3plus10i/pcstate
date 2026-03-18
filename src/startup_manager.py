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


def get_current_program_path():
    """获取当前程序路径"""
    if getattr(sys, 'frozen', False):
        return sys.executable
    else:
        return os.path.abspath(sys.argv[0])


def get_shortcut_target():
    """获取快捷方式指向的目标路径，不存在则返回 None"""
    shortcut_path = get_shortcut_path()
    if not os.path.exists(shortcut_path):
        return None
    try:
        shell = Dispatch('WScript.Shell')
        shortcut = shell.CreateShortCut(shortcut_path)
        return shortcut.Targetpath
    except Exception:
        return None


def is_startup_enabled():
    """检查是否已设置开机启动，如果快捷方式指向错误则自动修复"""
    shortcut_path = get_shortcut_path()
    if not os.path.exists(shortcut_path):
        return False
    
    current_path = get_current_program_path()
    target_path = get_shortcut_target()
    
    # 快捷方式存在但指向不正确，修复它
    if target_path and os.path.normpath(target_path) != os.path.normpath(current_path):
        print(f"检测到快捷方式指向旧版本，正在修复: {target_path} -> {current_path}")
        add_to_startup()
    
    return True


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
