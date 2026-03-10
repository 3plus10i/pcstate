"""SQLite 存储模块
单文件数据库，支持查询扩展
"""

import os
import sys
from datetime import date
from typing import List, Optional


class SQLiteStorage:
    """SQLite 数据库存储"""

    def __init__(self):
        self._db_path = self._get_db_path()
        self._init_db()

    def _get_db_path(self) -> str:
        if getattr(sys, 'frozen', False):
            base_dir = os.path.dirname(sys.executable)
        else:
            # src -> 项目根目录
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        return os.path.join(base_dir, 'pcstate.db')

    def _init_db(self):
        """初始化数据库表结构"""
        import sqlite3
        conn = sqlite3.connect(self._db_path)

        # 检查表是否存在以及是否有新字段
        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='activity'")
        table_exists = cursor.fetchone() is not None

        if table_exists:
            # 检查是否有新字段
            cursor = conn.execute("PRAGMA table_info(activity)")
            columns = {row[1] for row in cursor}
            if 'is_active' not in columns:
                # 迁移旧表结构
                conn.execute('''
                    CREATE TABLE activity_new (
                        date TEXT NOT NULL,
                        minute INTEGER NOT NULL,
                        is_active INTEGER NOT NULL,
                        window_title TEXT,
                        process_name TEXT,
                        PRIMARY KEY (date, minute)
                    )
                ''')
                # 迁移旧数据（count > 0 视为活跃）
                conn.execute('''
                    INSERT INTO activity_new (date, minute, is_active, window_title, process_name)
                    SELECT date, minute,
                           CASE WHEN count > 0 THEN 1 ELSE 0 END,
                           '', '' FROM activity
                ''')
                conn.execute('DROP TABLE activity')
                conn.execute('ALTER TABLE activity_new RENAME TO activity')
        else:
            # 创建新表
            conn.execute('''
                CREATE TABLE activity (
                    date TEXT NOT NULL,
                    minute INTEGER NOT NULL,
                    is_active INTEGER NOT NULL,
                    window_title TEXT,
                    process_name TEXT,
                    PRIMARY KEY (date, minute)
                )
            ''')

        conn.commit()
        conn.close()

    def get_log_path(self, target_date: Optional[date] = None) -> str:
        return self._db_path

    def write(self, hour: int, minute: int, is_active: bool,
              window_title: str = "", process_name: str = "") -> None:
        import sqlite3
        date_str = date.today().isoformat()
        minute_of_day = hour * 60 + minute

        conn = sqlite3.connect(self._db_path)
        conn.execute('''
            INSERT INTO activity (date, minute, is_active, window_title, process_name)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(date, minute) DO UPDATE SET
                is_active = excluded.is_active,
                window_title = excluded.window_title,
                process_name = excluded.process_name
        ''', (date_str, minute_of_day, 1 if is_active else 0, window_title, process_name))
        conn.commit()
        conn.close()

    def read_by_date(self, target_date: date) -> List[str]:
        import sqlite3
        date_str = target_date.isoformat()

        conn = sqlite3.connect(self._db_path)
        cursor = conn.execute(
            'SELECT minute FROM activity WHERE date = ? AND is_active = 1',
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
            'SELECT minute, is_active FROM activity WHERE date = ?',
            (date_str,)
        )
        for row in cursor:
            minute_of_day = row[0]
            is_active = row[1]
            if is_active:
                hour = minute_of_day // 60
                min_part = minute_of_day % 60
                slot = hour * 12 + min_part // 5
                if 0 <= slot < 288:
                    slots[slot] = min(slots[slot] + 1, 5)
        conn.close()

        return slots
