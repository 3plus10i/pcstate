import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'

interface WeeklyHeatmapChartProps {
  hourlyActivity: number[][]  // 7×24矩阵
  days: string[]  // 7天的日期字符串
  dayStartHour: number
}

export function WeeklyHeatmapChart({ hourlyActivity, days, dayStartHour }: WeeklyHeatmapChartProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstanceRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!chartRef.current) return

    if (!chartInstanceRef.current) {
      chartInstanceRef.current = echarts.init(chartRef.current)
    }
    const chart = chartInstanceRef.current
    chart.clear()

    // 准备热力图数据: [x, y, value]
    const heatmapData: [number, number, number][] = []
    const hours = Array.from({ length: 24 }, (_, i) => i)
    
    // 如果dayStartHour > 0，需要调整小时标签顺序
    const displayHours = dayStartHour > 0 
      ? [...hours.slice(dayStartHour), ...hours.slice(0, dayStartHour)]
      : hours
    
    hourlyActivity.forEach((dayData, dayIndex) => {
      dayData.forEach((activity, hourIndex) => {
        // 使用displayHours的顺序，但x坐标用原始hourIndex
        const x = displayHours.indexOf(hourIndex)
        heatmapData.push([x, dayIndex, activity])
      })
    })

    const option: echarts.EChartsOption = {
      tooltip: {
        position: 'top',
        backgroundColor: '#fff',
        borderColor: '#e8e8e8',
        borderWidth: 1,
        textStyle: {
          color: 'rgba(0,0,0,0.85)'
        },
        padding: [8, 12],
        formatter: (params: any) => {
          const hour = displayHours[params.data[0]]
          const day = days[params.data[1]]
          const activity = params.data[2]
          const dateStr = day.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')
          return `${dateStr} ${hour}:00<br/>活跃时间: ${activity}分钟`
        }
      },
      grid: {
        left: 80,
        right: 20,
        top: 40,
        bottom: 60
      },
      xAxis: {
        type: 'category',
        data: displayHours.map(h => `${h}时`),
        splitArea: {
          show: true
        },
        axisLabel: {
          fontSize: 11,
          color: 'rgba(0,0,0,0.65)'
        }
      },
      yAxis: {
        type: 'category',
        data: days.map(day => {
          const dateStr = day.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')
          const d = new Date(dateStr + 'T00:00:00')
          const weekDays = ['日', '一', '二', '三', '四', '五', '六']
          return `${d.getMonth() + 1}/${d.getDate()}(${weekDays[d.getDay()]})`
        }),
        splitArea: {
          show: true
        },
        axisLabel: {
          fontSize: 11,
          color: 'rgba(0,0,0,0.65)'
        }
      },
      visualMap: {
        min: 0,
        max: 60,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 20,
        inRange: {
          color: ['#d9d9d9', '#1890ff']  // 灰色到蓝色渐变
        },
        text: ['高', '低'],
        textStyle: {
          color: 'rgba(0,0,0,0.65)'
        }
      },
      series: [{
        name: '活跃度',
        type: 'heatmap',
        data: heatmapData,
        label: {
          show: false
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }]
    }

    chart.setOption(option, { notMerge: true })

    const handleResize = () => chart.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [hourlyActivity, days, dayStartHour])

  return (
    <div
      ref={chartRef}
      style={{
        width: '100%',
        height: '400px'
      }}
    />
  )
}
