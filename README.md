# PCState

一个简单的Win桌面端小工具，挂在托盘里记录你每天用电脑的时间。

![screenshot](screenshot-v1.1.png)

## 功能

- 后台静默运行，每分钟检查一次键鼠操作，有操作则记录为活跃状态
- 右键点托盘图标，使用看时间报表等功能

## 安装和运行

方法1 推荐使用exe文件，直接双击运行即可。

方法2 使用源码运行，需要Python环境：
```bash
pip install pywin32
python main.py
```

启动后会在右下角托盘，绿点表示监测到刚才有操作，灰点是闲置。

## 看报表

右键托盘 → 查看报表，会打开一个网页，显示最近14天的活跃情况。

格子颜色越深，表示那5分钟里你越忙。

## 打包成exe

```bash
python build.py --release
```

在 `release/` 目录拿到单文件 `PCStateMonitor.exe`，可以不需要Python环境运行。

## 文件说明

```
├── main.py          # 主程序
├── public/          # 图标和报表模板
├── logs/            # 每天的日志
└── temp/            # 生成的报表页面
```

日志一天一个文件，格式是 `HHMM`。

## 项目主页

https://github.com/3plus10i/pcstate

---

Windows only。需要一直开着才能记录，关了就停了。
