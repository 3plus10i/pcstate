"""
版本与编译配置 - 单点修改
修改此文件即可更新版本号和存储后端配置
"""

# ============ 版本信息 ============

VERSION_PARTS = (1, 5, 0, 0)
VERSION = ".".join(map(str, VERSION_PARTS))

COMPANY_NAME = "3plus10i"
FILE_DESCRIPTION = "PC活跃状态记录器"
PRODUCT_NAME = "PCState"
COPYRIGHT = "Copyright (C) 2025 3plus10i"


# ============ 存储配置（编译时确定） ============

# 存储后端: 'text' | 'tdr' | 'sqlite'
STORAGE_MODE = 'sqlite'

# TDR 配置
TDR_CONFIG = {
    'length': 20160,     # 14天分钟数 (14 * 1440)
    'step': 60000,       # 1分钟(毫秒)
    'bit_width': 1,      # 二值数据
    'remarks': '{"desc": "PCState", "vmap": {"0": "Idle", "1": "Active"}, "pad": "0"}'
}

# SQLite 配置
SQLITE_CONFIG = {
    'retention_days': 30  # 数据保留天数
}
