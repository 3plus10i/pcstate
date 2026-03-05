# PC状态监控客户端

轻量级的PC活动状态监控工具，定时检测键鼠活动并记录到本地日志。

## 功能特点

- ✅ 系统托盘运行，后台静默监控
- ✅ 每分钟检测一次键鼠活动状态
- ✅ 自动记录活动时间点到日志文件
- ✅ 可视化查看活跃状态墙
- ✅ 支持最近14天数据回溯

## 文件结构

```
client/
├── main.py            # 主程序入口
├── idle_detector.py   # Windows闲置检测模块
├── logger.py          # 日志写入模块
├── gen_data.py        # 数据转换脚本
├── public/            # 静态资源目录
│   ├── viewer.html    # 报表模板
│   ├── icon_active.ico # 活跃状态图标（可选）
│   └── icon_idle.ico  # 闲置状态图标（可选）
├── temp/              # 运行时生成的文件
│   ├── viewer.html    # 生成的报表页面
│   └── data.js        # 生成的数据文件
└── logs/              # 日志文件目录
    └── pcstate-YYYY-MM-DD.log
```

## 安装依赖

```bash
pip install pywin32
```

**依赖说明**：
- `pywin32` - Windows API 接口，用于系统托盘功能
- 无需 PIL/Pillow，更轻量级

## 使用方法

### 1. 启动监控

```bash
python main.py
```

程序将在系统托盘显示图标：
- 🟢 绿色圆点 = 活跃状态（最近有键鼠活动）
- ⚪ 灰色圆点 = 闲置状态

**工作原理**：
- 每隔60秒检测一次系统闲置时间
- 如果闲置时间 < 60秒，说明上一分钟有活动
- 将活动时间记录到日志文件（格式：HHMM）

### 2. 日志格式

日志文件：`logs/pcstate-YYYY-MM-DD.log`

格式示例：
```
0832
0833
0835
1621
1622
```

每行记录一个活跃分钟，例如 `1621` 表示 16:21 这一分钟有键鼠活动。

### 3. 可视化查看

点击托盘菜单中的"查看报表"，或手动执行：

```bash
# 生成数据文件
python gen_data.py

# 打开可视化页面（从temp目录）
start temp/viewer.html
```

**可视化说明**：
- 显示最近14天的活跃状态墙
- 每天分为288个时间片（24小时 × 12片/小时）
- 每个时间片5分钟，颜色深浅表示活跃次数（0-5次）
- 点击日期按钮切换查看

**颜色含义**：
- 灰色：无活动
- 浅蓝→深蓝：活跃1-5次

### 4. 托盘菜单

- **PC状态监控**（标题，不可点击）
- ─────────────────
- **查看报表**：自动生成数据并打开可视化页面
- **查看日志**：用记事本打开当天日志文件
- **安装目录**：打开程序所在文件夹
- ─────────────────
- **退出**：停止程序

## 数据转换

`gen_data.py` 将日志转换为可视化数据：

1. 读取最近14天的日志文件
2. 统计每个5分钟时间片的活跃次数
3. 生成 `data.js` 文件供 `viewer.html` 使用

运行后会显示：
```
已生成 data.js，7 天有效数据
```

## 打包为exe（可选）

### 快速打包

```bash
# 安装打包依赖
pip install pyinstaller

# 使用打包脚本
python build.py

# 或创建完整发布包
python build.py --release
```

### 手动打包

```bash
pyinstaller --name=PCStateMonitor \
    --onefile \
    --windowed \
    --add-data=public;public \
    --icon=public/icon_active.ico \
    main.py
```

### 打包说明

- 生成的 `PCStateMonitor.exe` 在 `dist` 目录
- 使用 `--onefile` 打包为单个可执行文件
- 使用 `--windowed` 不显示控制台窗口
- `public/` 目录的资源会被打包进 exe 内部
- 运行时自动创建 `logs/` 和 `temp/` 目录

### 发布包结构

运行 `python build.py --release` 后，`release/` 目录包含：

```
release/
├── PCStateMonitor.exe  # 主程序
├── public/             # 静态资源（备用）
│   ├── icon_active.ico
│   ├── icon_idle.ico
│   └── viewer.html
├── logs/               # 日志目录（空）
├── temp/               # 临时文件目录（空）
└── README.md           # 说明文档
```

用户只需运行 `PCStateMonitor.exe` 即可，程序会自动创建所需目录。

## 技术实现

- **闲置检测**：调用 Windows API `GetLastInputInfo` 获取最后输入时间
- **日志写入**：每天一个文件，追加写入，格式简洁
- **可视化**：Canvas绘制288个格子，颜色映射活跃度
- **状态管理**：系统托盘图标实时反映当前状态

## 自定义图标（可选）

程序支持自定义托盘图标：

1. 准备两个图标文件（16x16 或 32x32 的 `.ico` 格式）：
   - `icon_active.ico` - 活跃状态图标
   - `icon_idle.ico` - 闲置状态图标

2. 将图标文件放在程序同目录下

3. 如果图标文件不存在，程序会使用 Windows 系统默认图标

**提示**：可使用在线工具将 PNG 转换为 ICO 格式。

## 注意事项

- 仅支持 Windows 平台（使用 Windows API）
- 需要保持程序运行才能持续监控
- 日志文件会持续累积，建议定期清理旧日志
- 可视化需要手动运行 `gen_data.py` 更新数据
