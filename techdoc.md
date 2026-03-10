# PCState 技术文档

## 架构概览

```
pcstate/
├── main.py               # 程序入口
├── build.py              # 打包脚本（含版本同步）
├── version.py            # 版本号 + 存储配置（单点修改）
├── requirements.txt      # Python依赖
├── src/                  # Python核心模块
│   ├── __init__.py
│   ├── main.py           # 托盘程序主循环
│   ├── idle_detector.py  # 空闲检测（Windows API）
│   ├── logger.py         # 存储层接口
│   ├── sqlite.py         # SQLite存储
│   ├── startup_manager.py # 开机启动管理
│   └── viewer/           # 数据导出
│       ├── __init__.py
│       └── exporter.py   # 导出data.js + 复制前端资源
├── frontend/             # React + Vite 前端
│   ├── index.html
│   ├── package.json      # 版本号自动同步
│   ├── vite.config.ts    # 输出到 ../viewer/
│   └── src/
│       ├── main.tsx
│       ├── index.css
│       └── components/
│           ├── App.tsx           # 主界面
│           └── StateBlockChart.tsx # 热力图组件
├── viewer/               # 前端构建输出
│   ├── index.html
│   └── assets/
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
CREATE TABLE activity (
    date TEXT NOT NULL,
    minute INTEGER NOT NULL,  -- 一天中的第几分钟 (0-1439)
    count INTEGER DEFAULT 1,  -- 活跃次数
    PRIMARY KEY (date, minute)
)
```

**核心接口**:
```python
def get_log_path(target_date) -> str      # 获取存储路径
def write(hour, minute) -> None           # 写入活跃记录
def read_by_date(target_date) -> [str]    # 读取时间记录（HHMM格式）
def get_slots(target_date) -> [int]       # 获取槽位统计（288个）
```

**特点**:
- 单文件数据库：程序根目录下的 `pcstate.db`
- 支持数据聚合：同一分钟多次活跃会累加 count
- 使用 UPSERT 语法避免重复插入

---

### 3. 日志接口 (`src/logger.py`)

**核心接口**:
```python
def write_log(record: str) -> None         # 写入 HHMM 记录
def read_log_by_date(log_date: str) -> []  # 读取日期记录
def get_slots_by_date(target_date) -> []   # 获取槽位统计
```

---

### 4. 数据导出 (`src/viewer/exporter.py`)

**核心函数**:

```python
def export_data() -> (str, int):
    """导出最近14天数据到 temp/data.js"""
    # 生成 LOG_DATA, DATES, APP_VERSION 全局变量

def get_viewer_files() -> (str, str):
    """复制 viewer 资源到 temp 目录"""
    # 在 index.html 中插入 <script src="data.js"></script>
```

**数据注入**:
- 运行时生成 `temp/data.js`
- 全局变量: `LOG_DATA`, `DATES`, `APP_VERSION`

---

### 5. 托盘程序 (`src/main.py`)

**主循环**:
```python
def check_and_report():
    """每分钟检测一次"""
    idle_time = get_idle_duration()
    if idle_time < 60:  # 活跃
        # 记录上一分钟
        logger.write_log(f"{hour:02d}{minute:02d}")
        update_tray_icon('active')
    else:  # 闲置
        update_tray_icon('idle')
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
- **可视化**: Canvas 2D

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

#### StateBlockChart.tsx

**功能**: Canvas绘制热力图

**参数**:
- `slots`: 288个槽位的活跃计数 (0-5)
- `size`: 格子大小 (默认16px)

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
├── pcstate.db          # SQLite 数据库
├── temp/                # 临时文件
│   ├── data.js         # 导出的数据
│   ├── index.html      # 前端页面
│   └── assets/         # 前端资源
└── PCStateMonitor.exe
```

**路径计算**:
```python
# 开发环境
base_dir = dirname(dirname(dirname(__file__)))

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
- Canvas 2D

---

## 设计原则

1. **高内聚低耦合**: 模块职责单一
2. **最小化实现**: 只实现必要功能，不过度设计
3. **单点修改**: 版本号、存储配置在根目录 `version.py` 统一管理
