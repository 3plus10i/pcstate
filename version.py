"""
版本与编译配置 - 单点修改
修改此文件即可更新版本号和存储后端配置
"""

# ============ 版本信息 ============

VERSION_PARTS = (1, 6, 3, 3)
VERSION = ".".join(map(str, VERSION_PARTS))

COMPANY_NAME = "3plus10i"
FILE_DESCRIPTION = "PC活跃状态记录器"
PRODUCT_NAME = "PCState"
COPYRIGHT = "Copyright (C) 2025 3plus10i"


# ============ 存储配置 ============

# SQLite 配置
SQLITE_CONFIG = {
    'retention_days': 30  # 数据保留天数
}
