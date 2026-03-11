import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'

interface AppPieChartProps {
  appData: Record<string, number>
}

export function AppPieChart({ appData }: AppPieChartProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstanceRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!chartRef.current) return

    if (!chartInstanceRef.current) {
      chartInstanceRef.current = echarts.init(chartRef.current)
    }
    const chart = chartInstanceRef.current
    chart.clear()

    const entries = Object.entries(appData)
    
    if (entries.length === 0) {
      chart.clear()
      chart.setOption({
        title: {
          text: '暂无应用数据',
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

    const total = entries.reduce((sum, [_, value]) => sum + value, 0)
    
    if (total === 0) {
      chart.clear()
      chart.setOption({
        title: {
          text: '暂无应用数据',
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

    const data = entries
      .map(([name, value]) => {
        const percentage = (value / total) * 100
        return {
          name: name,
          value: value,
          percentage: percentage
        }
      })
      .sort((a, b) => b.value - a.value)

    const topApps = data.filter(item => item.percentage >= 5)
    const otherApps = data.filter(item => item.percentage < 5)
    
    let displayData = [...topApps]
    if (otherApps.length > 0) {
      const otherValue = otherApps.reduce((sum, item) => sum + item.value, 0)
      displayData.push({
        name: '其他',
        value: otherValue,
        percentage: (otherValue / total) * 100
      })
    }

    const colors = [
      '#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1',
      '#eb2f96', '#fa8c16', '#13c2c2', '#2f54eb', '#a0d911'
    ]

    const option: echarts.EChartsOption = {
      title: {
        show: false
      },
      animation: false,
      tooltip: {
        trigger: 'item',
        backgroundColor: '#fff',
        borderColor: '#e8e8e8',
        borderWidth: 1,
        textStyle: {
          fontSize: 12,
          color: 'rgba(0,0,0,0.85)'
        },
        padding: [8, 12],
        formatter: (params: any) => {
          const item = params
          return `${item.name}：${item.value}分钟 (${item.percentage.toFixed(1)}%)`
        }
      },
      legend: {
        orient: 'vertical',
        right: 10,
        top: 'center',
        itemWidth: 12,
        itemHeight: 12,
        textStyle: {
          fontSize: 12,
          color: 'rgba(0,0,0,0.65)'
        },
        data: displayData.map(item => item.name)
      },
      series: [
        {
          type: 'pie' as const,
          radius: ['40%', '70%'],
          center: ['35%', '50%'],
          data: displayData,
          itemStyle: {
            borderRadius: 4,
            borderColor: '#fff',
            borderWidth: 2
          },
          label: {
            show: false
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          }
        }
      ],
      color: colors
    }

    chart.setOption(option, { notMerge: true })

    const handleResize = () => chart.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [appData])

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