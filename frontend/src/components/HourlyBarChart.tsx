import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'

interface HourlyBarChartProps {
  slots: number[]
}

export function HourlyBarChart({ slots }: HourlyBarChartProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstanceRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!chartRef.current) return

    if (!chartInstanceRef.current) {
      chartInstanceRef.current = echarts.init(chartRef.current)
    }
    const chart = chartInstanceRef.current
    chart.clear()

    const hours = Array.from({ length: 24 }, (_, i) => `${i}时`)
    const data = Array.from({ length: 24 }, (_, i) => {
      let activeMinutes = 0
      for (let j = 0; j < 12; j++) {
        const slotIndex = i * 12 + j
        if (slotIndex < slots.length && slots[slotIndex] > 0) {
          activeMinutes += 5
        }
      }
      return activeMinutes
    })

    const option: echarts.EChartsOption = {
      grid: {
        left: 60,
        right: 20,
        top: 40,
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
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#fff',
        borderColor: '#e8e8e8',
        borderWidth: 1,
        textStyle: {
          fontSize: 12,
          color: 'rgba(0,0,0,0.85)'
        },
        padding: [8, 12],
        formatter: (params: any) => {
          const item = params[0]
          return `${item.name}：${item.value}分钟`
        }
      },
      series: [
        {
          type: 'bar',
          data: data,
          itemStyle: {
            color: '#1890ff',
            borderRadius: [4, 4, 0, 0]
          },
          emphasis: {
            itemStyle: {
              color: '#40a9ff'
            }
          },
          barWidth: '60%'
        }
      ]
    }

    chart.setOption(option, { notMerge: true })

    const handleResize = () => chart.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [slots])

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