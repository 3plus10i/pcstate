"""SQLite 存储模块
单文件数据库，支持查询扩展
"""

import os
from datetime import date
from typing import List, Optional

from src.utils import get_script_dir


class SQLiteStorage:
    """SQLite 数据库存储"""

    def __init__(self):
        self._db_path = self._get_db_path()
        self._init_db()

    def _get_db_path(self) -> str:
        base_dir = get_script_dir()
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
        
        # 创建配置表
        conn.execute('''
            CREATE TABLE IF NOT EXISTS config (
                key TEXT NOT NULL,
                value TEXT NOT NULL,
                PRIMARY KEY (key)
            )
        ''')
        
        # 插入默认配置
        conn.execute('''
            INSERT OR IGNORE INTO config (key, value) VALUES ('day_start_hour', '4')
        ''')

        conn.commit()
        conn.close()

    def get_record_path(self, target_date: Optional[date] = None) -> str:
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

    def get_app_durations(self, target_date: date, day_start_hour: int = 0) -> dict:
        """获取应用时长数据
        
        Args:
            target_date: 目标日期
            day_start_hour: 一天起始小时（0或4）
        
        Returns:
            字典，key为应用名，value为活跃分钟数
        """
        import sqlite3
        from datetime import timedelta

        app_durations = {}
        
        if day_start_hour == 0:
            # 标准模式：只查询当天数据
            date_str = target_date.isoformat()
            conn = sqlite3.connect(self._db_path)
            cursor = conn.execute(
                'SELECT minute, process_name, is_active FROM activity WHERE date = ?',
                (date_str,)
            )
            for row in cursor:
                minute_of_day = row[0]
                process_name = row[1] or '未知'
                is_active = row[2]
                
                if is_active:
                    if process_name not in app_durations:
                        app_durations[process_name] = 0
                    app_durations[process_name] += 1
            conn.close()
        else:
            # 自定义起始时间模式：查询当天4:00-23:59和次日0:00-3:59
            # 当天4:00-23:59
            date_str = target_date.isoformat()
            conn = sqlite3.connect(self._db_path)
            cursor = conn.execute(
                'SELECT minute, process_name, is_active FROM activity WHERE date = ?',
                (date_str,)
            )
            for row in cursor:
                minute_of_day = row[0]
                process_name = row[1] or '未知'
                is_active = row[2]
                
                if is_active and minute_of_day >= day_start_hour * 60:
                    if process_name not in app_durations:
                        app_durations[process_name] = 0
                    app_durations[process_name] += 1
            conn.close()
            
            # 次日0:00-3:59
            next_date = target_date + timedelta(days=1)
            next_date_str = next_date.isoformat()
            conn = sqlite3.connect(self._db_path)
            cursor = conn.execute(
                'SELECT minute, process_name, is_active FROM activity WHERE date = ?',
                (next_date_str,)
            )
            for row in cursor:
                minute_of_day = row[0]
                process_name = row[1] or '未知'
                is_active = row[2]
                
                if is_active and minute_of_day < day_start_hour * 60:
                    if process_name not in app_durations:
                        app_durations[process_name] = 0
                    app_durations[process_name] += 1
            conn.close()

        return app_durations

    def get_window_durations(self, target_date: date, day_start_hour: int = 0) -> dict:
        """获取窗口时长数据
        
        Args:
            target_date: 目标日期
            day_start_hour: 一天起始小时（0或4）
        
        Returns:
            字典，key为窗口标题，value为活跃分钟数
        """
        import sqlite3
        from datetime import timedelta

        window_durations = {}
        
        if day_start_hour == 0:
            # 标准模式：只查询当天数据
            date_str = target_date.isoformat()
            conn = sqlite3.connect(self._db_path)
            cursor = conn.execute(
                'SELECT minute, window_title, is_active FROM activity WHERE date = ?',
                (date_str,)
            )
            for row in cursor:
                minute_of_day = row[0]
                window_title = row[1] or '未知'
                is_active = row[2]
                
                if is_active:
                    if window_title not in window_durations:
                        window_durations[window_title] = 0
                    window_durations[window_title] += 1
            conn.close()
        else:
            # 自定义起始时间模式：查询当天4:00-23:59和次日0:00-3:59
            # 当天4:00-23:59
            date_str = target_date.isoformat()
            conn = sqlite3.connect(self._db_path)
            cursor = conn.execute(
                'SELECT minute, window_title, is_active FROM activity WHERE date = ?',
                (date_str,)
            )
            for row in cursor:
                minute_of_day = row[0]
                window_title = row[1] or '未知'
                is_active = row[2]
                
                if is_active and minute_of_day >= day_start_hour * 60:
                    if window_title not in window_durations:
                        window_durations[window_title] = 0
                    window_durations[window_title] += 1
            conn.close()
            
            # 次日0:00-3:59
            next_date = target_date + timedelta(days=1)
            next_date_str = next_date.isoformat()
            conn = sqlite3.connect(self._db_path)
            cursor = conn.execute(
                'SELECT minute, window_title, is_active FROM activity WHERE date = ?',
                (next_date_str,)
            )
            for row in cursor:
                minute_of_day = row[0]
                window_title = row[1] or '未知'
                is_active = row[2]
                
                if is_active and minute_of_day < day_start_hour * 60:
                    if window_title not in window_durations:
                        window_durations[window_title] = 0
                    window_durations[window_title] += 1
            conn.close()

        return window_durations

    def get_hourly_app_durations(self, target_date: date, day_start_hour: int = 0) -> List[dict]:
        """获取每小时的应用时长数据
        
        Args:
            target_date: 目标日期
            day_start_hour: 一天起始小时（0或4）
        
        Returns:
            24个元素的列表，每个元素是一个字典，key为应用名，value为该小时内的活跃分钟数
        """
        import sqlite3
        from datetime import timedelta

        hourly_data = [{} for _ in range(24)]
        
        if day_start_hour == 0:
            # 标准模式：只查询当天数据
            date_str = target_date.isoformat()
            conn = sqlite3.connect(self._db_path)
            cursor = conn.execute(
                'SELECT minute, process_name, is_active FROM activity WHERE date = ?',
                (date_str,)
            )
            for row in cursor:
                minute_of_day = row[0]
                process_name = row[1] or '未知'
                is_active = row[2]
                
                if is_active:
                    hour = minute_of_day // 60
                    if 0 <= hour < 24:
                        if process_name not in hourly_data[hour]:
                            hourly_data[hour][process_name] = 0
                        hourly_data[hour][process_name] += 1
            conn.close()
        else:
            # 自定义起始时间模式：查询当天4:00-23:59和次日0:00-3:59
            # 当天4:00-23:59，映射到0-19位置
            date_str = target_date.isoformat()
            conn = sqlite3.connect(self._db_path)
            cursor = conn.execute(
                'SELECT minute, process_name, is_active FROM activity WHERE date = ?',
                (date_str,)
            )
            for row in cursor:
                minute_of_day = row[0]
                process_name = row[1] or '未知'
                is_active = row[2]
                
                if is_active and minute_of_day >= day_start_hour * 60:
                    hour = minute_of_day // 60
                    adjusted_hour = hour - day_start_hour
                    if process_name not in hourly_data[adjusted_hour]:
                        hourly_data[adjusted_hour][process_name] = 0
                    hourly_data[adjusted_hour][process_name] += 1
            conn.close()
            
            # 次日0:00-3:59，映射到20-23位置
            next_date = target_date + timedelta(days=1)
            next_date_str = next_date.isoformat()
            conn = sqlite3.connect(self._db_path)
            cursor = conn.execute(
                'SELECT minute, process_name, is_active FROM activity WHERE date = ?',
                (next_date_str,)
            )
            for row in cursor:
                minute_of_day = row[0]
                process_name = row[1] or '未知'
                is_active = row[2]
                
                if is_active and minute_of_day < day_start_hour * 60:
                    hour = minute_of_day // 60
                    adjusted_hour = 24 - day_start_hour + hour
                    if process_name not in hourly_data[adjusted_hour]:
                        hourly_data[adjusted_hour][process_name] = 0
                    hourly_data[adjusted_hour][process_name] += 1
            conn.close()
        
        return hourly_data

    def get_hourly_window_durations(self, target_date: date, day_start_hour: int = 0) -> List[dict]:
        """获取每小时的窗口时长数据
        
        Args:
            target_date: 目标日期
            day_start_hour: 一天起始小时（0或4）
        
        Returns:
            24个元素的列表，每个元素是一个字典，key为窗口标题，value为该小时内的活跃分钟数
        """
        import sqlite3
        from datetime import timedelta

        hourly_data = [{} for _ in range(24)]
        
        if day_start_hour == 0:
            # 标准模式：只查询当天数据
            date_str = target_date.isoformat()
            conn = sqlite3.connect(self._db_path)
            cursor = conn.execute(
                'SELECT minute, window_title, is_active FROM activity WHERE date = ?',
                (date_str,)
            )
            for row in cursor:
                minute_of_day = row[0]
                window_title = row[1] or '未知'
                is_active = row[2]
                
                if is_active:
                    hour = minute_of_day // 60
                    if 0 <= hour < 24:
                        if window_title not in hourly_data[hour]:
                            hourly_data[hour][window_title] = 0
                        hourly_data[hour][window_title] += 1
            conn.close()
        else:
            # 自定义起始时间模式：查询当天4:00-23:59和次日0:00-3:59
            # 当天4:00-23:59，映射到0-19位置
            date_str = target_date.isoformat()
            conn = sqlite3.connect(self._db_path)
            cursor = conn.execute(
                'SELECT minute, window_title, is_active FROM activity WHERE date = ?',
                (date_str,)
            )
            for row in cursor:
                minute_of_day = row[0]
                window_title = row[1] or '未知'
                is_active = row[2]
                
                if is_active and minute_of_day >= day_start_hour * 60:
                    hour = minute_of_day // 60
                    adjusted_hour = hour - day_start_hour
                    if window_title not in hourly_data[adjusted_hour]:
                        hourly_data[adjusted_hour][window_title] = 0
                    hourly_data[adjusted_hour][window_title] += 1
            conn.close()
            
            # 次日0:00-3:59，映射到20-23位置
            next_date = target_date + timedelta(days=1)
            next_date_str = next_date.isoformat()
            conn = sqlite3.connect(self._db_path)
            cursor = conn.execute(
                'SELECT minute, window_title, is_active FROM activity WHERE date = ?',
                (next_date_str,)
            )
            for row in cursor:
                minute_of_day = row[0]
                window_title = row[1] or '未知'
                is_active = row[2]
                
                if is_active and minute_of_day < day_start_hour * 60:
                    hour = minute_of_day // 60
                    adjusted_hour = 24 - day_start_hour + hour
                    if window_title not in hourly_data[adjusted_hour]:
                        hourly_data[adjusted_hour][window_title] = 0
                    hourly_data[adjusted_hour][window_title] += 1
            conn.close()
        
        return hourly_data

    def get_config(self, key: str, default: str = '') -> str:
        """获取配置值"""
        import sqlite3
        conn = sqlite3.connect(self._db_path)
        cursor = conn.execute(
            'SELECT value FROM config WHERE key = ?',
            (key,)
        )
        row = cursor.fetchone()
        conn.close()
        return row[0] if row else default

    def set_config(self, key: str, value: str) -> None:
        """设置配置值"""
        import sqlite3
        conn = sqlite3.connect(self._db_path)
        conn.execute(
            'INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)',
            (key, value)
        )
        conn.commit()
        conn.close()

    def get_day_start_hour(self) -> int:
        """获取一天起始小时"""
        value = self.get_config('day_start_hour', '0')
        try:
            return int(value)
        except ValueError:
            return 0

    def set_day_start_hour(self, hour: int) -> None:
        """设置一天起始小时"""
        if hour not in [0, 4]:
            raise ValueError("day_start_hour must be 0 or 4")
        self.set_config('day_start_hour', str(hour))
