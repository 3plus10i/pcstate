import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'

interface WeeklyAppBarChartProps {
  hourlyAppData: Record<string, number>[][]  // 7×24的应用数据
  days: string[]  // 7天的日期字符串
  weekAppTotals: Record<string, number>  // 用于判断哪些应用合并到"其他"
  dayStartHour: number
}

export function WeeklyAppBarChart({ hourlyAppData, days, weekAppTotals, dayStartHour }: WeeklyAppBarChartProps) {
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
    const totalMinutes = Object.values(weekAppTotals).reduce((sum, m) => sum + m, 0)
    const smallApps = new Set<string>()
    Object.entries(weekAppTotals).forEach(([app, minutes]) => {
      const percentage = totalMinutes > 0 ? minutes / totalMinutes : 0
      if (percentage < 0.05) {
        smallApps.add(app)
      } else {
        allApps.add(app)
      }
    })
    allApps.add('其他')
    
    // 处理7天的数据
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
      const data = dailyAppTotals.map(dayTotals => dayTotals[app] || 0)
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

    // 准备x轴标签
    const xAxisData = days.map(day => {
      const dateStr = day.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')
      const d = new Date(dateStr + 'T00:00:00')
      const weekDays = ['日', '一', '二', '三', '四', '五', '六']
      return `${d.getMonth() + 1}/${d.getDate()}\n${weekDays[d.getDay()]}`
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
        formatter: (params: any[]) => {
          if (!params || params.length === 0) return ''
          
          const dayIndex = params[0].dataIndex
          const dayLabel = xAxisData[dayIndex]
          let totalMinutes = 0
          const appData: { app: string; minutes: number; color: string }[] = []
          
          params.forEach(param => {
            const minutes = param.value
            totalMinutes += minutes
            if (minutes > 0) {
              appData.push({
                app: param.seriesName,
                minutes,
                color: param.color
              })
            }
          })
          
          // 按时长排序
          appData.sort((a, b) => b.minutes - a.minutes)
          
          let html = `<div style="font-weight: bold; margin-bottom: 8px;">${dayLabel}</div>`
          html += `<div style="margin-bottom: 4px;">总计: ${Math.floor(totalMinutes / 60)}h${totalMinutes % 60}m</div>`
          
          appData.forEach(item => {
            const hours = Math.floor(item.minutes / 60)
            const mins = item.minutes % 60
            const timeStr = hours > 0 ? `${hours}h${mins}m` : `${mins}m`
            const percentage = totalMinutes > 0 ? Math.round(item.minutes / totalMinutes * 100) : 0
            
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
          fontSize: 11,
          color: 'rgba(0,0,0,0.65)',
          lineHeight: 16
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
      series: seriesData
    }

    chart.setOption(option, { notMerge: true })

    const handleResize = () => chart.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [hourlyAppData, days, weekAppTotals, dayStartHour])

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
