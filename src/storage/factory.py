"""
存储后端工厂
根据配置返回对应的存储实现
"""

_backends = {}


def get_backend():
    """
    获取当前配置的存储后端实例
    
    Returns:
        StorageBackend 实例
    """
    from src.version import STORAGE_MODE
    
    if STORAGE_MODE not in _backends:
        if STORAGE_MODE == 'text':
            from .text import TextStorage
            _backends['text'] = TextStorage()
        elif STORAGE_MODE == 'tdr':
            from .tdr_backend import TDRStorage
            _backends['tdr'] = TDRStorage()
        elif STORAGE_MODE == 'sqlite':
            from .sqlite import SQLiteStorage
            _backends['sqlite'] = SQLiteStorage()
        else:
            raise ValueError(f"未知的存储模式: {STORAGE_MODE}")
    
    return _backends[STORAGE_MODE]
