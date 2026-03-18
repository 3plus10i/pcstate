"""SQLite 存储模块
单文件数据库，支持查询扩展
"""

import os
from datetime import date, datetime
from typing import List, Optional
import sqlite3
from src.utils import get_script_dir


class SQLiteStorage:
    """SQLite 数据库存储（连接池模式）"""
    
    # 类级别连接（连接池模式）
    _conn: Optional[sqlite3.Connection] = None
    _db_path: Optional[str] = None
    
    def __init__(self):
        # 延迟初始化：只在首次创建实例时设置路径和初始化数据库
        if SQLiteStorage._db_path is None:
            SQLiteStorage._db_path = self._get_db_path()
            self._init_db()
    
    def _get_conn(self) -> sqlite3.Connection:
        """获取数据库连接（延迟初始化，连接池模式）"""
        if SQLiteStorage._conn is None:
            SQLiteStorage._conn = sqlite3.connect(
                SQLiteStorage._db_path,
                check_same_thread=False
            )
        return SQLiteStorage._conn
    
    def close(self) -> None:
        """显式关闭数据库连接"""
        if SQLiteStorage._conn is not None:
            SQLiteStorage._conn.close()
            SQLiteStorage._conn = None

    def _get_db_path(self) -> str:
        base_dir = get_script_dir()
        return os.path.join(base_dir, 'pcstate.db')

    def _init_db(self):
        """初始化数据库表结构"""
        conn = sqlite3.connect(SQLiteStorage._db_path)

        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='activity'")
        table_exists = cursor.fetchone() is not None

        if table_exists:
            cursor = conn.execute("PRAGMA table_info(activity)")
            columns = {row[1] for row in cursor}
            
            if 'time' not in columns:
                cursor = conn.execute("PRAGMA table_info(activity)")
                old_columns = {row[1] for row in cursor}
                
                has_process_name = 'process_name' in old_columns
                has_window_title = 'window_title' in old_columns
                has_count = 'count' in old_columns
                has_is_active = 'is_active' in old_columns
                has_date = 'date' in old_columns
                has_minute = 'minute' in old_columns
                
                if not (has_date and has_minute):
                    print("警告：旧表缺少必要的date或minute字段，无法迁移")
                    conn.close()
                    return
                
                conn.execute('''
                    CREATE TABLE activity_new (
                        time INTEGER NOT NULL,
                        is_active INTEGER NOT NULL,
                        prog_name TEXT,
                        win_title TEXT,
                        PRIMARY KEY (time)
                    )
                ''')
                
                if has_is_active and has_process_name and has_window_title:
                    cursor = conn.execute(
                        'SELECT date, minute, is_active, process_name, window_title FROM activity'
                    )
                    old_data = cursor.fetchall()
                elif has_is_active and has_process_name:
                    cursor = conn.execute(
                        'SELECT date, minute, is_active, process_name FROM activity'
                    )
                    old_data = [(row[0], row[1], row[2], row[3], None) for row in cursor]
                elif has_is_active:
                    cursor = conn.execute(
                        'SELECT date, minute, is_active FROM activity'
                    )
                    old_data = [(row[0], row[1], row[2], None, None) for row in cursor]
                elif has_count and has_process_name and has_window_title:
                    cursor = conn.execute(
                        'SELECT date, minute, count, process_name, window_title FROM activity'
                    )
                    old_data = cursor.fetchall()
                elif has_count and has_process_name:
                    cursor = conn.execute(
                        'SELECT date, minute, count, process_name FROM activity'
                    )
                    old_data = [(row[0], row[1], row[2], row[3], None) for row in cursor]
                elif has_count:
                    cursor = conn.execute(
                        'SELECT date, minute, count FROM activity'
                    )
                    old_data = [(row[0], row[1], row[2], None, None) for row in cursor]
                else:
                    cursor = conn.execute('SELECT date, minute FROM activity')
                    old_data = [(row[0], row[1], 1, None, None) for row in cursor]
                
                if old_data:
                    new_records = []
                    
                    for row in old_data:
                        date_str = row[0]
                        minute_val = row[1]
                        count_val = row[2] if len(row) > 2 else 1
                        process_name = row[3] if len(row) > 3 else None
                        window_title = row[4] if len(row) > 4 else None
                        
                        try:
                            dt = datetime.strptime(date_str, '%Y-%m-%d')
                            dt = dt.replace(hour=minute_val // 60, minute=minute_val % 60)
                            time_minutes = int(dt.timestamp() // 60)
                            
                            is_active = 1 if count_val and count_val > 0 else 0
                            
                            prog_name = ""
                            if process_name:
                                prog_name = process_name[:-4] if process_name.lower().endswith('.exe') else process_name
                            elif window_title:
                                prog_name = window_title[:16]
                            
                            win_title = ""
                            
                            new_records.append((time_minutes, is_active, prog_name, win_title))
                        except Exception as e:
                            print(f"迁移数据出错: {date_str}, {minute_val}: {e}")
                            continue
                    
                    if new_records:
                        conn.executemany(
                            'INSERT OR REPLACE INTO activity_new (time, is_active, prog_name, win_title) VALUES (?, ?, ?, ?)',
                            new_records
                        )
                        print(f"迁移完成，共 {len(new_records)} 条记录")
                
                conn.execute('DROP TABLE activity')
                conn.execute('ALTER TABLE activity_new RENAME TO activity')
        else:
            conn.execute('''
                CREATE TABLE activity (
                    time INTEGER NOT NULL,
                    is_active INTEGER NOT NULL,
                    prog_name TEXT,
                    win_title TEXT,
                    PRIMARY KEY (time)
                )
            ''')
        
        conn.execute('''
            CREATE TABLE IF NOT EXISTS config (
                key TEXT NOT NULL,
                value TEXT NOT NULL,
                PRIMARY KEY (key)
            )
        ''')
        
        conn.execute('''
            INSERT OR IGNORE INTO config (key, value) VALUES ('day_start_hour', '4')
        ''')
        conn.execute('''
            INSERT OR IGNORE INTO config (key, value) VALUES ('timezone', '8')
        ''')

        conn.commit()
        conn.close()

    def get_record_path(self, target_date: Optional[date] = None) -> str:
        return SQLiteStorage._db_path

    def write(self, hour: int, minute: int, is_active: bool,
              window_title: str = "", process_name: str = "", target_date: date = None) -> None:
        
        if target_date is None:
            target_date = date.today()
        
        dt = datetime(target_date.year, target_date.month, target_date.day, hour, minute)
        time_minutes = int(dt.timestamp() // 60)
        
        prog_name = ""
        if process_name:
            prog_name = process_name[:-4] if process_name.lower().endswith('.exe') else process_name
        elif window_title:
            prog_name = window_title[:16]

        win_title = ""

        conn = self._get_conn()
        conn.execute('''
            INSERT INTO activity (time, is_active, prog_name, win_title)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(time) DO UPDATE SET
                is_active = excluded.is_active,
                prog_name = excluded.prog_name,
                win_title = excluded.win_title
        ''', (time_minutes, 1 if is_active else 0, prog_name, win_title))
        conn.commit()

    def read_by_date(self, target_date: date) -> List[str]:
        start_dt = datetime(target_date.year, target_date.month, target_date.day, 0, 0)
        end_dt = datetime(target_date.year, target_date.month, target_date.day, 23, 59)
        start_time = int(start_dt.timestamp() // 60)
        end_time = int(end_dt.timestamp() // 60)

        conn = self._get_conn()
        cursor = conn.execute(
            'SELECT time FROM activity WHERE time >= ? AND time <= ? AND is_active = 1',
            (start_time, end_time)
        )
        result = []
        for row in cursor:
            ts = row[0] * 60
            dt = datetime.fromtimestamp(ts)
            minute_of_day = dt.hour * 60 + dt.minute
            hour = minute_of_day // 60
            min_part = minute_of_day % 60
            result.append(f"{hour:02d}{min_part:02d}")

        return result

    def get_app_durations(self, target_date: date) -> dict:
        """获取应用时长数据（原始数据，不受day_start_hour影响）
        
        Args:
            target_date: 目标日期
        
        Returns:
            字典，key为应用名，value为活跃分钟数
        """
        start_dt = datetime(target_date.year, target_date.month, target_date.day, 0, 0)
        end_dt = datetime(target_date.year, target_date.month, target_date.day, 23, 59)
        start_time = int(start_dt.timestamp() // 60)
        end_time = int(end_dt.timestamp() // 60)

        app_durations = {}
        conn = self._get_conn()
        cursor = conn.execute(
            'SELECT time, prog_name, is_active FROM activity WHERE time >= ? AND time <= ?',
            (start_time, end_time)
        )
        for row in cursor:
            prog_name = row[1] or ''
            is_active = row[2]
            
            if is_active and prog_name:
                if prog_name not in app_durations:
                    app_durations[prog_name] = 0
                app_durations[prog_name] += 1
        return app_durations

    def get_hourly_app_durations(self, target_date: date) -> List[dict]:
        """获取每小时的应用时长数据（原始数据，不受day_start_hour影响）
        
        Args:
            target_date: 目标日期
        
        Returns:
            24个元素的列表，每个元素是一个字典，key为应用名，value为该小时内的活跃分钟数
        """
        start_dt = datetime(target_date.year, target_date.month, target_date.day, 0, 0)
        end_dt = datetime(target_date.year, target_date.month, target_date.day, 23, 59)
        start_time = int(start_dt.timestamp() // 60)
        end_time = int(end_dt.timestamp() // 60)

        hourly_data = [{} for _ in range(24)]
        conn = self._get_conn()
        cursor = conn.execute(
            'SELECT time, prog_name, is_active FROM activity WHERE time >= ? AND time <= ?',
            (start_time, end_time)
        )
        for row in cursor:
            ts = row[0] * 60
            dt = datetime.fromtimestamp(ts)
            hour = dt.hour
            prog_name = row[1] or ''
            is_active = row[2]
            
            if is_active and prog_name and 0 <= hour < 24:
                if prog_name not in hourly_data[hour]:
                    hourly_data[hour][prog_name] = 0
                hourly_data[hour][prog_name] += 1
        
        return hourly_data

    def get_slots(self, target_date: date) -> List[int]:
        """获取自然日每5分钟的活跃槽位数据
        
        Args:
            target_date: 目标日期
        
        Returns:
            288个整数的列表，每个值表示对应5分钟区间内的活跃分钟数（0-5）
        """
        start_dt = datetime(target_date.year, target_date.month, target_date.day, 0, 0)
        end_dt = datetime(target_date.year, target_date.month, target_date.day, 23, 59)
        start_time = int(start_dt.timestamp() // 60)
        end_time = int(end_dt.timestamp() // 60)

        slots = [0] * 288
        
        conn = self._get_conn()
        cursor = conn.execute(
            'SELECT time, is_active FROM activity WHERE time >= ? AND time <= ? ORDER BY time',
            (start_time, end_time)
        )
        
        for row in cursor:
            ts = row[0] * 60
            dt = datetime.fromtimestamp(ts)
            minute_of_day = dt.hour * 60 + dt.minute
            is_active = row[1]
            
            if is_active:
                slot_index = minute_of_day // 5
                if 0 <= slot_index < 288:
                    slots[slot_index] += 1
        
        return slots

    def get_config(self, key: str, default: str = '') -> str:
        """获取配置值"""
        conn = self._get_conn()
        cursor = conn.execute(
            'SELECT value FROM config WHERE key = ?',
            (key,)
        )
        row = cursor.fetchone()
        return row[0] if row else default

    def set_config(self, key: str, value: str) -> None:
        """设置配置值"""
        conn = self._get_conn()
        conn.execute(
            'INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)',
            (key, value)
        )
        conn.commit()

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

    def get_timezone(self) -> int:
        """获取时区偏移值"""
        value = self.get_config('timezone', '8')
        try:
            return int(value)
        except ValueError:
            return 8

    def set_timezone(self, offset: int) -> None:
        """设置时区偏移值"""
        if offset < -12 or offset > 14:
            raise ValueError("timezone must be between -12 and 14")
        self.set_config('timezone', str(offset))
