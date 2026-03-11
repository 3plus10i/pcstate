import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'

interface HourlyDataItem {
  [key: string]: number
}

interface WindowStackedBarChartProps {
  hourlyWindowData: HourlyDataItem[]
}

export function WindowStackedBarChart({ hourlyWindowData }: WindowStackedBarChartProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstanceRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!chartRef.current) return

    if (!chartInstanceRef.current) {
      chartInstanceRef.current = echarts.init(chartRef.current)
    }
    const chart = chartInstanceRef.current
    chart.clear()

    if (!hourlyWindowData || hourlyWindowData.length === 0) {
      chart.clear()
      chart.setOption({
        title: {
          text: '数据文件需要更新\n请重新运行数据导出程序',
          left: 'center',
          top: 'center',
          textStyle: {
            fontSize: 14,
            color: 'rgba(0,0,0,0.45)',
            lineHeight: 20
          }
        }
      })
      return
    }

    const hours = Array.from({ length: 24 }, (_, i) => `${i}时`)
    
    const allWindows = new Set<string>()
    hourlyWindowData.forEach(hourData => {
      if (hourData && typeof hourData === 'object') {
        Object.keys(hourData).forEach(window => allWindows.add(window))
      }
    })
    
    const windowList = Array.from(allWindows)
    
    if (windowList.length === 0) {
      chart.clear()
      chart.setOption({
        title: {
          text: '暂无窗口数据',
          left: 'center',
          top: 'center',
          textStyle: {
            fontSize: 14,
            color: 'rgba(0,0,0,0.45)'
          }
        }
      })
      return
    }
    
    const seriesData = windowList.map(window => {
      const data = hourlyWindowData.map(hourData => (hourData && typeof hourData === 'object') ? (hourData[window] || 0) : 0)
      return {
        name: window,
        type: 'bar',
        stack: 'total',
        data: data
      }
    })

    const colors = [
      '#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1',
      '#eb2f96', '#fa8c16', '#13c2c2', '#2f54eb', '#a0d911',
      '#fadb14', '#9254de', '#ffec3d', '#ff7a45', '#ffc53d'
    ]

    const option: echarts.EChartsOption = {
      title: {
        show: false
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        },
        backgroundColor: '#fff',
        borderColor: '#e8e8e8',
        borderWidth: 1,
        textStyle: {
          fontSize: 12,
          color: 'rgba(0,0,0,0.85)'
        },
        padding: [8, 12],
        formatter: (params: any) => {
          const hour = params[0].name
          let total = 0
          let items = params.map((item: any) => {
            total += item.value
            return `${item.seriesName}：${item.value}分钟`
          })
          return `${hour} 总计：${total}分钟<br/>${items.join('<br/>')}`
        }
      },
      legend: {
        orient: 'horizontal',
        top: 0,
        left: 'center',
        itemWidth: 12,
        itemHeight: 12,
        textStyle: {
          fontSize: 11,
          color: 'rgba(0,0,0,0.65)'
        },
        data: windowList
      },
      grid: {
        left: 60,
        right: 20,
        top: 80,
        bottom: 60,
        containLabel: false
      },
      xAxis: {
        type: 'category',
        data: hours,
        axisLabel: {
          rotate: 45,
          fontSize: 11,
          color: 'rgba(0,0,0,0.65)'
        },
        axisLine: {
          lineStyle: {
            color: '#e8e8e8'
          }
        },
        axisTick: {
          lineStyle: {
            color: '#e8e8e8'
          }
        }
      },
      yAxis: {
        type: 'value',
        name: '分钟',
        nameTextStyle: {
          fontSize: 12,
          color: 'rgba(0,0,0,0.65)'
        },
        axisLabel: {
          fontSize: 11,
          color: 'rgba(0,0,0,0.65)'
        },
        axisLine: {
          lineStyle: {
            color: '#e8e8e8'
          }
        },
        axisTick: {
          lineStyle: {
            color: '#e8e8e8'
          }
        },
        splitLine: {
          lineStyle: {
            color: '#f0f0f0'
          }
        }
      },
      series: seriesData,
      color: colors
    }

    chart.setOption(option, { notMerge: true })

    const handleResize = () => chart.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [hourlyWindowData])

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