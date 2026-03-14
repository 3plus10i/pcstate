import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'

interface WeeklyAppPieChartProps {
  weekAppTotals: Record<string, number>  // 应用总时长（已处理<5%合并）
}

export function WeeklyAppPieChart({ weekAppTotals }: WeeklyAppPieChartProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstanceRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!chartRef.current) return

    if (!chartInstanceRef.current) {
      chartInstanceRef.current = echarts.init(chartRef.current)
    }
    const chart = chartInstanceRef.current
    chart.clear()

    if (!weekAppTotals || Object.keys(weekAppTotals).length === 0) {
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

    // 准备饼图数据
    const pieData = Object.entries(weekAppTotals)
      .map(([app, minutes]) => ({
        name: app,
        value: minutes
      }))
      .sort((a, b) => b.value - a.value)

    const colors = [
      '#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1',
      '#eb2f96', '#fa8c16', '#13c2c2', '#2f54eb', '#a0d911'
    ]

    const option: echarts.EChartsOption = {
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
          const minutes = params.value
          const hours = Math.floor(minutes / 60)
          const mins = minutes % 60
          const timeStr = hours > 0 ? `${hours}h${mins}m` : `${mins}m`
          return `${params.name}<br/>${timeStr} (${params.percent}%)`
        }
      },
      legend: {
        orient: 'vertical',
        left: 'left',
        itemWidth: 12,
        itemHeight: 12,
        textStyle: {
          fontSize: 11,
          color: 'rgba(0,0,0,0.65)'
        },
        formatter: (name: string) => {
          const minutes = weekAppTotals[name] || 0
          const hours = Math.floor(minutes / 60)
          const mins = minutes % 60
          if (hours > 0) {
            return `${name} (${hours}h${mins}m)`
          }
          return `${name} (${mins}m)`
        }
      },
      series: [
        {
          name: '应用时长',
          type: 'pie',
          radius: ['40%', '75%'],
          center: ['60%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 4,
            borderColor: '#fff',
            borderWidth: 2
          },
          label: {
            show: false,
            position: 'center'
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 14,
              fontWeight: 'bold'
            }
          },
          labelLine: {
            show: false
          },
          data: pieData,
          color: colors
        }
      ]
    }

    chart.setOption(option, { notMerge: true })

    const handleResize = () => chart.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [weekAppTotals])

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
