"""
配置文件 - 存储方案选择
"""

# 存储方案魔数: 'text' | 'tdr'
STORAGE_MODE = 'tdr'

# TDR 配置（仅当 STORAGE_MODE == 'tdr' 时使用）
TDR_CONFIG = {
    'length': 20160,     # 14天分钟数 (14 * 1440)
    'step': 60000,       # 1分钟(毫秒)
    'bit_width': 1,      # 二值数据
    'remarks': '{"desc": "PCState", "vmap": {"0": "Idle", "1": "Active"}, "pad": "0"}'
}
