import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'

interface MonthlyAppBarChartProps {
  hourlyAppData: Record<string, number>[][]  // 30×24的应用数据
  days: string[]  // 30天的日期字符串
  monthAppTotals: Record<string, number>  // 用于判断哪些应用合并到"其他"
  dayStartHour: number
}

export function MonthlyAppBarChart({ hourlyAppData, days, monthAppTotals, dayStartHour }: MonthlyAppBarChartProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstanceRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!chartRef.current) return

    if (!chartInstanceRef.current) {
      chartInstanceRef.current = echarts.init(chartRef.current)
    }
    const chart = chartInstanceRef.current
    chart.clear()

    if (!hourlyAppData || hourlyAppData.length === 0) {
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

    // 准备数据：按天汇总应用时长，并合并小应用
    const dailyAppTotals: Record<string, number>[] = []
    const allApps = new Set<string>()
    
    // 找出需要合并到"其他"的应用
    const totalMinutes = Object.values(monthAppTotals).reduce((sum, m) => sum + m, 0)
    const smallApps = new Set<string>()
    Object.entries(monthAppTotals).forEach(([app, minutes]) => {
      const percentage = totalMinutes > 0 ? minutes / totalMinutes : 0
      if (percentage < 0.05) {
        smallApps.add(app)
      } else {
        allApps.add(app)
      }
    })
    allApps.add('其他')
    
    // 处理30天的数据
    hourlyAppData.forEach(dayHourlyData => {
      const dayTotals: Record<string, number> = {}
      let otherMinutes = 0
      
      // 汇总当天的应用时长
      dayHourlyData.forEach(hourData => {
        Object.entries(hourData).forEach(([app, minutes]) => {
          if (smallApps.has(app)) {
            otherMinutes += minutes
          } else {
            dayTotals[app] = (dayTotals[app] || 0) + minutes
          }
        })
      })
      
      if (otherMinutes > 0) {
        dayTotals['其他'] = otherMinutes
      }
      
      dailyAppTotals.push(dayTotals)
    })
    
    // 准备堆叠数据
    const apps = Array.from(allApps)
    const colors = [
      '#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1',
      '#eb2f96', '#fa8c16', '#13c2c2', '#2f54eb', '#a0d911'
    ]
    
    const seriesData = apps.map((app, index) => {
      const data = dailyAppTotals.map(dayTotals => (dayTotals[app] || 0) / 60)
      return {
        name: app,
        type: 'bar' as const,
        stack: 'day',
        data: data,
        itemStyle: {
          color: colors[index % colors.length],
          borderColor: '#fff',
          borderWidth: 1
        }
      }
    })

    // 准备x轴标签（显示月/日和周几）
    const xAxisData = days.map((day) => {
      const dateStr = day.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')
      const d = new Date(dateStr + 'T00:00:00')
      const weekDays = ['日', '一', '二', '三', '四', '五', '六']
      return `${d.getMonth() + 1}/${d.getDate()}(${weekDays[d.getDay()]})`
    })

    const option: echarts.EChartsOption = {
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
          if (!params || params.length === 0) return ''
          
          const dayIndex = params[0].dataIndex
          const dayLabel = xAxisData[dayIndex]
          let totalHours = 0
          const appData: { app: string; hours: number; color: string }[] = []

          params.forEach((param: any) => {
            const hours = param.value
            totalHours += hours
            if (hours > 0) {
              appData.push({
                app: param.seriesName,
                hours,
                color: param.color
              })
            }
          })

          // 按时长排序
          appData.sort((a, b) => b.hours - a.hours)

          let html = `<div style="font-weight: bold; margin-bottom: 8px;">${dayLabel}</div>`
          html += `<div style="margin-bottom: 4px;">总计: ${totalHours.toFixed(1)}h</div>`

          appData.forEach(item => {
            const timeStr = item.hours >= 1 ? `${item.hours.toFixed(1)}h` : `${Math.round(item.hours * 60)}m`
            const percentage = totalHours > 0 ? Math.round(item.hours / totalHours * 100) : 0
            
            html += `<div style="margin: 2px 0;">
              <span style="display: inline-block; width: 10px; height: 10px; background: ${item.color}; border-radius: 2px; margin-right: 6px;"></span>
              ${item.app}: ${timeStr} (${percentage}%)
            </div>`
          })
          
          return html
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
        }
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
        data: xAxisData,
        axisLabel: {
          rotate: 45,
          fontSize: 11,
          color: 'rgba(0,0,0,0.65)',
          lineHeight: 16,
          interval: 0
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
        name: '小时',
        nameTextStyle: {
          fontSize: 12,
          color: 'rgba(0,0,0,0.65)'
        },
        axisLabel: {
          fontSize: 11,
          color: 'rgba(0,0,0,0.65)',
          formatter: (value: number) => value.toString()
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
      series: seriesData
    }

    chart.setOption(option, { notMerge: true })

    const handleResize = () => chart.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [hourlyAppData, days, monthAppTotals, dayStartHour])

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
