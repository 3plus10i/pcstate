"""
用户配置管理
存储在 SQLite 数据库中
"""

from src.sqlite import SQLiteStorage


# 模块级存储实例（延迟初始化）
_backend = None


def _get_backend() -> SQLiteStorage:
    """获取存储后端单例"""
    global _backend
    if _backend is None:
        _backend = SQLiteStorage()
    return _backend


def get_day_start_hour() -> int:
    """获取一天起始小时（0或4）"""
    return _get_backend().get_day_start_hour()


def set_day_start_hour(hour: int) -> None:
    """设置一天起始小时"""
    _get_backend().set_day_start_hour(hour)


if __name__ == '__main__':
    # 测试
    print(f"当前一天起始时间: {get_day_start_hour()}时")
    # 测试设置
    set_day_start_hour(4)
    print(f"设置后一天起始时间: {get_day_start_hour()}时")
    # 恢复默认
    set_day_start_hour(0)
    print(f"恢复默认后一天起始时间: {get_day_start_hour()}时")
