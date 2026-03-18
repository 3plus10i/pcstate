"""
Windows 通知模块
使用 win11toast 发送系统通知
"""
import sys
import os


def get_icon_path():
    """获取程序图标路径"""
    if getattr(sys, 'frozen', False):
        base_path = sys._MEIPASS
    else:
        base_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base_path, 'public', 'icon_active.ico')


def show_notification(title: str, message: str):
    """
    发送系统通知
    
    Args:
        title: 通知标题
        message: 通知内容
    """
    try:
        from win11toast import toast
        
        icon_path = get_icon_path()
        if not os.path.exists(icon_path):
            icon_path = None
        
        toast(title, message, icon=icon_path)
    except Exception as e:
        print(f"发送通知失败: {e}")
