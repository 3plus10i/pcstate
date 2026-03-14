# PCState 技术文档

## 架构概览

```
pcstate/
├── main.py               # 程序入口
├── build.py              # 打包脚本（含版本同步）
├── version.py            # 版本号
├── requirements.txt      # Python依赖
├── src/                  # Python核心模块
│   ├── __init__.py
│   ├── main.py           # 托盘程序主循环
│   ├── idle_detector.py  # 空闲检测（Windows API）
│   ├── recorder.py       # 记录层接口
│   ├── sqlite.py         # SQLite存储
│   ├── config.py         # 配置管理
│   ├── startup_manager.py # 开机启动管理
│   ├── utils.py         # 工具函数
│   └── exporter.py      # 数据导出
├── frontend/             # React + Vite 前端
│   ├── index.html
│   ├── package.json      # 版本号自动同步
│   ├── vite.config.ts    # 输出到 ../viewer/
│   └── src/
│       ├── main.tsx
│       ├── index.css
│       └── components/
│           ├── App.tsx           # 主界面
│           └── HeatmapChart.tsx # 热力图组件
├── viewer/               # 前端构建输出(单文件输出)
│   └── index.html
└── public/               # 静态资源
    ├── icon_active.ico   # 活跃图标
    └── icon_idle.ico     # 闲置图标
```

---

## 核心模块

### 1. 空闲检测 (`src/idle_detector.py`)

**原理**: 调用 Windows API 获取最后输入时间

```python
# 核心逻辑
kernel32.GetTickCount64() - user32.GetLastInputInfo()
```

**接口**:
- `get_idle_duration() -> int`: 返回用户无键鼠操作的秒数
- `is_active(threshold=300) -> bool`: 判断是否活跃状态

**使用场景**: 主循环每分钟检测一次，闲置时间 < 60秒判定为活跃

---

### 2. 存储层 (`src/sqlite.py`)

**表结构**:
```sql
-- 活动记录表
CREATE TABLE activity (
    date TEXT NOT NULL,
    minute INTEGER NOT NULL,  -- 一天中的第几分钟 (0-1439)
    is_active INTEGER NOT NULL,  -- 是否活跃 (0/1)
    window_title TEXT,  -- 活动窗口标题
    process_name TEXT,  -- 活动程序名
    PRIMARY KEY (date, minute)
)

-- 配置表
CREATE TABLE config (
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (key)
)
```

**核心接口**:
```python
def get_record_path(target_date) -> str      # 获取存储路径
def write(hour, minute, is_active, window_title, process_name) -> None  # 写入活跃记录
def read_by_date(target_date) -> [str]    # 读取时间记录（HHMM格式）
def get_slots(target_date) -> [int]       # 获取槽位统计（288个）
def get_config(key, default) -> str        # 获取配置值
def set_config(key, value) -> None        # 设置配置值
def get_day_start_hour() -> int           # 获取一天起始小时
def set_day_start_hour(hour) -> None      # 设置一天起始小时
```

**特点**:
- 单文件数据库：程序根目录下的 `pcstate.db`
- 配置统一存储：用户配置（如一天起始时间）存储在数据库中
- 支持数据更新：同一分钟多次记录会更新为最新状态
- 使用 UPSERT 语法避免重复插入

---

### 3. 记录接口 (`src/recorder.py`)

**核心接口**:
```python
def write_record(record: str) -> None         # 写入 HHMM 记录
def read_records_by_date(record_date: str) -> []  # 读取日期记录
def get_slots_by_date(target_date) -> []   # 获取槽位统计
def get_record_path(target_date) -> str    # 获取记录文件路径
def get_record_files() -> []             # 获取记录文件列表
```

---

### 4. 数据导出 (`src/exporter.py`)

**核心函数**:

```python
def export_data() -> (str, int):
    """导出最近14天数据到 temp/data.js"""
    # 生成 RECORD_DATA, DATES, APP_VERSION 全局变量

def get_viewer_files() -> (str, str):
    """从 viewer 目录复制资源到 temp 目录"""
    # 在 index.html 中插入 <script src="data.js"></script>
```

**数据注入**:
- 运行时生成 `temp/data.js`
- 全局变量: `RECORD_DATA`, `DATES`, `APP_VERSION`

---

### 5. 托盘程序 (`src/main.py`)

**主循环**:
```python
def check_and_report():
    """每分钟检测一次"""
    idle_time = get_idle_duration()
    is_active = idle_time < 60
    
    # 获取活动窗口信息
    window_title, process_name = get_active_window_info()
    
    # 记录上一分钟
    recorder.write_record(f"{hour:02d}{minute:02d}")
    
    # 写入数据库
    backend.write(hour, minute, is_active, window_title, process_name)
    
    # 更新托盘图标
    update_tray_icon('active' if is_active else 'idle')
    
    time.sleep(60)
```

**托盘功能**:
- 右键菜单: 查看记录、开机启动、打开目录、退出
- 图标状态: 🟢 活跃 / ⚪ 闲置
- 双击: 打开数据检视页面

---

## 前端 (`frontend/`)

### 技术栈

- **框架**: React 18 + TypeScript
- **构建工具**: Vite 5
- **可视化**: ECharts

### 构建流程

```bash
cd frontend
npm install
npm run build  # 输出到 ../viewer/
```

**Vite 配置** (`vite.config.ts`):
```typescript
{
  base: './',           // 相对路径
  build: {
    outDir: '../viewer',
    emptyOutDir: true,
    assetsDir: 'assets'
  }
}
```

### 核心组件

#### App.tsx

**功能**:
- 显示近14天活跃列表
- 日期选择器
- 活跃统计（小时/分钟）

**布局**: 左侧日期列表 + 右侧热力图

#### HeatmapChart.tsx

**功能**: ECharts 绘制热力图

**参数**:
- `slots`: 288个槽位的活跃计数 (0-5)
- `size`: 格子大小 (默认16px)
- `dayStartHour`: 一天起始小时 (默认0)

**配色**:
```javascript
const COLORS = ['#eee', '#cce5ff', '#99ccff', '#66b2ff', '#3399ff', '#007bff']
//              空闲     1次      2次      3次      4次      5次+
```

**交互**: 鼠标悬停显示时间范围

---

## 版本管理

### 单点修改

**所有版本号在根目录 `version.py` 统一管理**:

```python
VERSION = "1.6.0.0"          # 4段版本号
VERSION_PARTS = (1, 6, 0, 0)  # 用于Windows文件属性
```

### 自动同步

`build.py` 在构建前端时自动同步版本号:

```python
def sync_frontend_version():
    """将 version.py 的版本号同步到 package.json"""
    # 1.6.0.0 -> 1.6.0 (去掉第4段)
```

**执行时机**: `python build.py` 构建前端前自动同步

---

## 打包流程

### 快速打包

```bash
python build.py --release
```

### 详细流程

1. **清理**: 删除 `build/`, `dist/`, `*.spec`
2. **构建前端**:
   - 同步版本号到 `package.json`
   - `npm install` (如果需要)
   - `npm run build` → 输出到 `viewer/`
3. **打包Python**:
   - 生成 `build/version_info.txt` (Windows版本信息)
   - PyInstaller打包 → `dist/PCStateMonitor.exe`
4. **创建发布包**: 复制到 `release/pcstate-{VERSION}/`

### PyInstaller参数

```python
pyinstaller \
    --name=PCStateMonitor \
    --onefile \              # 单文件
    --windowed \             # 无控制台
    --add-data=viewer;viewer \   # 前端构建产物
    --add-data=src;src \         # Python模块
    --icon=public/icon_active.ico \
    --version-file=build/version_info.txt \
    src/main.py
```

### 打包参数

```bash
python build.py              # 完整构建
python build.py --skip-frontend  # 跳过前端构建
python build.py --clean      # 仅清理
python build.py --release    # 创建发布包
```

---

## 运行时文件

```
程序目录/
├── pcstate.db          # SQLite 数据库（含记录数据和配置）
├── temp/                # 临时文件
│   ├── data.js         # 导出的数据
│   ├── index.html      # 前端页面
│   └── assets/         # 前端资源
└── PCStateMonitor.exe
```

**路径计算**:
```python
# 开发环境
base_dir = dirname(dirname(abspath(__file__)))

# 打包后
base_dir = dirname(sys.executable)
```

---

## 关键设计

### 1. 槽位统计

**定义**: 每天288个槽位（24h × 12槽/h），每槽代表5分钟

**映射规则**:
```python
slot = hour * 12 + minute // 5  # 0-287
slots[slot] = min(slots[slot] + 1, 5)  # 上限5次
```

**用途**: 前端热力图渲染，颜色深浅表示活跃程度

---

### 2. 资源路径管理

**开发环境**:
```python
# 前端资源
base_path = dirname(dirname(abspath(__file__)))
icon_path = join(base_path, 'public', 'icon_active.ico')

# 前端构建产物
viewer_dir = join(base_path, 'viewer')
```

**打包后**:
```python
# 前端资源
base_path = sys._MEIPASS  # PyInstaller临时目录
icon_path = join(base_path, 'public', 'icon_active.ico')

# 前端构建产物
viewer_dir = join(sys._MEIPASS, 'viewer')
```

---

## 技术栈总结

**后端**:
- Python 3.12+
- pywin32 (Windows API)
- winshell (开机启动管理)
- PyInstaller (打包)
- SQLite3 (数据库，标准库)

**前端**:
- React 18 + TypeScript
- Vite 5
- ECharts

---

## 设计原则

1. **高内聚低耦合**: 模块职责单一
2. **最小化实现**: 只实现必要功能，不过度设计
3. **单点修改**: 版本号在根目录 `version.py` 统一管理
