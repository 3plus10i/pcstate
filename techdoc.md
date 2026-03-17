# PCState 技术文档

## 1. 项目概述

PCState 是一个运行在 Windows 系统托盘中的小工具，记录用户每天使用电脑的时间分布和各应用的运行时长。

### 核心功能
- **空闲检测**：通过 Windows API 检测用户是否有键鼠操作
- **活动记录**：每分钟记录活跃状态、程序名、窗口标题
- **数据可视化**：前端热力图、饼图、柱状图展示活跃数据
- **托盘运行**：最小化到系统托盘，开机自启

---

## 2. 项目结构

```
pcstate/
├── main.py                 # 程序入口
├── build.py                 # 打包脚本
├── version.py               # 版本号 (如 1.8.0.0)
├── requirements.txt         # Python 依赖
│
├── src/                    # Python 后端模块
│   ├── main.py             # 托盘程序 + 主循环
│   ├── idle_detector.py   # 空闲检测 (Windows API)
│   ├── sqlite.py           # SQLite 存储层
│   ├── config.py           # 配置管理 (配置表的wrapper)
│   ├── exporter.py         # 数据导出 (生成前端数据)
│   ├── startup_manager.py  # 开机启动管理
│   └── utils.py            # 路径工具函数
│
├── frontend/               # React 前端源码
│   ├── src/
│   │   ├── main.tsx       # 前端入口
│   │   ├── components/    # 各种图表组件
│   │   └── App.tsx       # 主界面
│   ├── vite.config.ts    # Vite 配置
│   └── package.json      # 前端依赖
│
├── viewer/                 # 前端构建产物 (HTML/JS/CSS)
├── temp/                   # 运行时临时目录 (data.js + index.html)
├── public/                 # 静态资源 (图标 .ico)
└── pcstate.db              # SQLite 数据库
```

---

## 3. 核心模块详解

### 3.1 主循环 (main.py)

程序启动后创建系统托盘图标，后台启动一个线程执行 `check_and_report()`：

```python
def check_and_report():
    while running:
        # 1. 检测空闲时间
        idle_time = idle_detector.get_idle_duration()  # 秒
        
        # 2. 判断活跃状态 (闲置 < 60秒 = 活跃)
        is_active = idle_time < 60
        
        # 3. 获取活动窗口信息
        window_title, process_name = idle_detector.get_active_window_info()
        
        # 4. 记录上一分钟的数据
        check_time = datetime.now() - timedelta(minutes=1)
        backend.write(check_time.hour, check_time.minute, is_active, 
                     window_title, process_name, check_time.date())
        
        # 5. 更新托盘图标
        update_tray_icon('active' if is_active else 'idle')
        
        # 6. 休眠 60 秒
        time.sleep(60)
```

**注意**：
- 记录的是"上一分钟"的数据，而非当前时刻
- 每分钟检测一次，休眠期间不占用 CPU

---

### 3.2 空闲检测 (idle_detector.py)

调用 Windows API 获取用户最后输入时间：

```python
# 核心原理
last_input = user32.GetLastInputInfo()      # 最后输入时间 (tick)
now = kernel32.GetTickCount64()              # 当前时间 (tick)
idle_seconds = (now - last_input) // 1000   # 转换为秒
```

还提供 `get_active_window_info()` 获取前台窗口的标题和进程名。

---

### 3.3 数据库存储 (sqlite.py)

**表结构**：

```sql
-- 活动记录表
CREATE TABLE activity (
    time INTEGER PRIMARY KEY,       -- 分钟级时间戳 (Unix分钟数)
    is_active INTEGER NOT NULL,     -- 是否活跃 (0/1)
    prog_name TEXT,                 -- 程序名 (存入时去除 .exe 后缀)
    win_title TEXT                  -- 窗口标题 (存入时截断64字符)
);

-- 配置表
CREATE TABLE config (
    key TEXT PRIMARY KEY,
    value TEXT
);
```

**关键字段说明**：
- `time`：1970-01-01 到该时刻的分钟数，作为主键可唯一确定一分钟
- `prog_name`：如 `chrome.exe` 存入时变为 `chrome`
- `win_title`：原始窗口标题，截断到64字符

**核心接口**：

```python
# 写入一条活动记录
backend.write(hour, minute, is_active, window_title, process_name, date)

# 读取某天的活跃时间点 (返回 HHMM 格式列表)
backend.read_by_date(target_date)

# 获取某天的应用时长 {app_name: 分钟数}
backend.get_app_durations(target_date)

# 获取某天的窗口时长 {window_title: 分钟数}
backend.get_window_durations(target_date)

# 获取每小时的应用/窗口数据 (用于前端图表)
backend.get_hourly_app_durations(target_date)  # List[dict]
backend.get_hourly_window_durations(target_date)

# 获取每5分钟的槽位数据 (288个元素，每个0-5)
backend.get_slots(target_date)

# 配置管理
backend.get_timezone()       # 获取时区偏移 (默认8)
backend.set_timezone(offset) # 设置时区偏移 (-12~14)
backend.get_day_start_hour() # 获取一天起始小时 (0或4)
backend.set_day_start_hour(hour)
```

**数据迁移**：
- 程序启动时检查表结构
- 如发现旧结构 (`date` + `minute`)，自动迁移到新结构 (`time`)
- 迁移时会转换时间戳、处理程序名和窗口标题

---

### 3.4 配置管理 (config.py)

对 `SQLiteStorage` 的封装，提供更简洁的 API：

```python
from src import config

config.get_day_start_hour()    # 获取一天起始时间
config.set_day_start_hour(4)   # 设置为凌晨4点
config.get_timezone()          # 获取时区偏移
config.set_timezone(8)         # 设置为 UTC+8
```

---

### 3.5 数据导出 (exporter.py)

前端需要 JSON 格式的数据，此模块负责：

1. **export_data()**: 从数据库读取最近31天的数据，生成 `temp/data.js`

```javascript
// 输出格式
window.PCSTATE_DATA = {
    version: "1.8.0.0",
    day_start_hour: 4,        // 一天起始时间
    timezone: 8,               // 时区偏移
    record: [
        {
            date: "20260317",
            slots: [0,1,2,3,...],     // 288个槽位，每5分钟活跃计数
            app_hourly: [{},{},...],  // 24小时，每小时 {app: 分钟数}
            window_hourly: [{},{},...]
        },
        ...
    ]
};
```

2. **get_viewer_files()**: 将构建好的前端页面复制到 temp 目录

---

### 3.6 开机启动 (startup_manager.py)

通过 Windows 启动文件夹管理：

```python
startup_manager.is_startup_enabled()    # 检查是否已启用
startup_manager.add_to_startup()        # 添加到开机启动
startup_manager.remove_from_startup()   # 移除开机启动
```

---

## 4. 前端架构

### 技术栈
- **React 18** + TypeScript
- **Vite 5** (构建工具)
- **ECharts** (图表库)

### 数据流

```
SQLite DB
    │
    ▼
export_data() ──► temp/data.js
                         │
viewer/index.html ───────┼────► inject_data_script()
                                        │
                                        ▼
                               temp/index.html
                                        │
                                        ▼
                              浏览器打开 (os.startfile)

```

### 组件结构

```
App.tsx
├── 日期选择器 (选择查看哪天的数据)
├── 视图切换 (日/周/月)
└── 图表区域
    ├── HeatmapChart      # 热力图 (格子图)
    ├── AppPieChart       # 应用时长饼图
    └── AppBarChart       # 应用时长柱状图
```

---

## 5. 打包与发布

### 构建命令

```bash
# 完整构建
python build.py --release

# 跳过前端构建 (仅重打包 Python)
python build.py --skip-frontend
```

### 构建流程

1. **版本同步**: `build.py` 读取 `version.py`，同步到 `package.json`
2. **前端构建**: `npm run build` → 输出到 `viewer/`，采用单文件模型，以避免跨域问题
3. **Python 打包**: `PyInstaller` 打包为单文件 exe
4. **生成发布**: 复制到 `release/pcstate-{版本}/`

### PyInstaller 配置

```python
--name=PCStateMonitor      # exe 名称
--onefile                  # 单文件模式
--windowed                 # 无控制台窗口
--add-data=viewer;viewer   # 前端资源
--add-data=src;src         # Python 模块
--add-data=public;public   # 图标资源
```

---

## 6. 运行时文件

程序运行后会产生以下文件：

```
程序目录/
├── pcstate.db          # SQLite 数据库 (活动记录 + 配置)
├── temp/               # 临时目录
│   ├── data.js        # 导出的数据 (JSON)
│   ├── index.html     # 前端页面
│   └── assets/        # 前端资源 (JS/CSS/图片)目前不使用这一项
└── PCStateMonitor.exe # 主程序
```

---

## 7. 关键设计决策

### 7.1 为什么用 SQLite 而非文件？

- **查询效率**：按日期查询、聚合统计等操作更高效
- **单文件**：数据库本身是单文件，便于携带
- **原子性**：写入天然原子，无需额外处理

### 7.2 为什么每分钟记录一次？

- 时间粒度足够细，满足"查看一天用电脑情况"的需求
- 存储空间友好 (每分钟1条，一年约 50万条，< 100MB)

### 7.3 为什么用托盘而非窗口？

- 工具类应用，最小化到托盘最合适
- 不影响用户正常使用其他应用

### 7.4 前端为什么用单文件输出？

- 防止跨域问题
- 浏览器直接打开 HTML 即可查看，无需启动服务器

---

## 8. 开发指南

### 本地运行

```bash
# 安装依赖
pip install -r requirements.txt

# 启动程序
python main.py
```

### 修改数据库结构

修改 `sqlite.py` 中的表结构定义后，程序启动时会自动检测并迁移旧数据。

### 添加新配置项

1. 在 `sqlite.py` 的 `_init_db()` 中添加默认值
2. 在 `config.py` 中添加 getter/setter 函数

### 添加新图表

1. 在 `frontend/src/components/` 中创建新组件
2. 在 `App.tsx` 中引入并使用
