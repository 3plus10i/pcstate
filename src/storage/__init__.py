"""
存储层 - 统一的存储后端接口
通过配置项切换不同存储实现
"""

from .base import StorageBackend
from .factory import get_backend

__all__ = ['StorageBackend', 'get_backend']
