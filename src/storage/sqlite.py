"""
SQLite 存储后端（预留实现）
单文件数据库，支持查询扩展
"""

import os
import sys
from datetime import date, datetime
from typing import List, Optional

from .base import StorageBackend


class SQLiteStorage(StorageBackend):
    """SQLite 数据库存储"""
    
    def __init__(self):
        self._db_path = self._get_db_path()
        self._init_db()
    
    def _get_db_path(self) -> str:
        if getattr(sys, 'frozen', False):
            base_dir = os.path.dirname(sys.executable)
        else:
            # src/storage -> src -> 项目根目录
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        logs_dir = os.path.join(base_dir, 'logs')
        os.makedirs(logs_dir, exist_ok=True)
        return os.path.join(logs_dir, 'pcstate.db')
    
    def _init_db(self):
        """初始化数据库表结构"""
        import sqlite3
        conn = sqlite3.connect(self._db_path)
        conn.execute('''
            CREATE TABLE IF NOT EXISTS activity (
                date TEXT NOT NULL,
                minute INTEGER NOT NULL,
                count INTEGER DEFAULT 1,
                PRIMARY KEY (date, minute)
            )
        ''')
        conn.commit()
        conn.close()
    
    def get_log_path(self, target_date: Optional[date] = None) -> str:
        return self._db_path
    
    def write(self, hour: int, minute: int) -> None:
        import sqlite3
        date_str = date.today().isoformat()
        minute_of_day = hour * 60 + minute
        
        conn = sqlite3.connect(self._db_path)
        conn.execute('''
            INSERT INTO activity (date, minute, count)
            VALUES (?, ?, 1)
            ON CONFLICT(date, minute) DO UPDATE SET count = count + 1
        ''', (date_str, minute_of_day))
        conn.commit()
        conn.close()
    
    def read_by_date(self, target_date: date) -> List[str]:
        import sqlite3
        date_str = target_date.isoformat()
        
        conn = sqlite3.connect(self._db_path)
        cursor = conn.execute(
            'SELECT minute FROM activity WHERE date = ? AND count > 0',
            (date_str,)
        )
        result = []
        for row in cursor:
            minute_of_day = row[0]
            hour = minute_of_day // 60
            min_part = minute_of_day % 60
            result.append(f"{hour:02d}{min_part:02d}")
        conn.close()
        
        return result
    
    def get_slots(self, target_date: date) -> List[int]:
        import sqlite3
        date_str = target_date.isoformat()
        
        slots = [0] * 288
        conn = sqlite3.connect(self._db_path)
        cursor = conn.execute(
            'SELECT minute, count FROM activity WHERE date = ?',
            (date_str,)
        )
        for row in cursor:
            minute_of_day = row[0]
            count = row[1]
            hour = minute_of_day // 60
            min_part = minute_of_day % 60
            slot = hour * 12 + min_part // 5
            if 0 <= slot < 288:
                slots[slot] = min(slots[slot] + count, 5)
        conn.close()
        
        return slots
