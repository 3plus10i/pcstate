import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'

interface HourlyDataItem {
  [key: string]: number
}

interface AppBarChartProps {
  hourlyAppData: HourlyDataItem[]
  dayStartHour: number
}

export function AppBarChart({ hourlyAppData, dayStartHour }: AppBarChartProps) {
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

    const hours = Array.from({ length: 24 }, (_, i) => {
      const hour = (i + dayStartHour) % 24
      return `${hour}时`
    })
    
    const allApps = new Set<string>()
    const appTotalDuration = new Map<string, number>()
    
    hourlyAppData.forEach(hourData => {
      if (hourData && typeof hourData === 'object') {
        Object.keys(hourData).forEach(app => {
          allApps.add(app)
          appTotalDuration.set(app, (appTotalDuration.get(app) || 0) + (hourData[app] || 0))
        })
      }
    })
    
    const sortedApps = Array.from(appTotalDuration.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
    
    const top10Apps = sortedApps.map(entry => entry[0])
    
    if (top10Apps.length === 0) {
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

    const colors = [
      '#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1',
      '#eb2f96', '#fa8c16', '#13c2c2', '#2f54eb', '#a0d911'
    ]

    const appColors = new Map<string, string>()
    top10Apps.forEach((app, index) => {
      appColors.set(app, colors[index % colors.length])
    })
    appColors.set('其他', '#d9d9d9')

    const seriesData = []
    
    for (let i = 0; i < 5; i++) {
      const app = top10Apps[i]
      if (!app) break
      
      const data = hourlyAppData.map(hourData => {
        if (!hourData || typeof hourData !== 'object') return 0
        return hourData[app] || 0
      })
      
      seriesData.push({
        name: app,
        type: 'bar' as const,
        stack: 'total',
        data: data,
        itemStyle: {
          color: appColors.get(app),
          borderColor: '#fff',
          borderWidth: 1
        }
      })
    }
    
    const otherData = hourlyAppData.map(hourData => {
      if (!hourData || typeof hourData !== 'object') return 0
      let total = 0
      top10Apps.slice(0, 5).forEach(app => {
        total += (hourData[app] || 0)
      })
      const hourTotal = Object.values(hourData).reduce((sum, val) => sum + val, 0)
      return hourTotal - total
    })
    
    seriesData.push({
      name: '其他',
      type: 'bar' as const,
      stack: 'total',
      data: otherData,
      itemStyle: {
        color: '#d9d9d9',
        borderColor: '#fff',
        borderWidth: 1
      }
    })

    const option: echarts.EChartsOption = {
      title: {
        show: false
      },
      animation: false,
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
          const displayHour = parseInt(hour.replace('时', ''))
          let originalHourIndex: number
          
          if (displayHour >= dayStartHour) {
            originalHourIndex = displayHour - dayStartHour
          } else {
            originalHourIndex = displayHour + 24 - dayStartHour
          }
          
          const hourData = hourlyAppData[originalHourIndex]
          
          if (!hourData || typeof hourData !== 'object') {
            return `${hour}<br/>无数据`
          }
          
          const appEntries = Object.entries(hourData)
            .filter(([_, value]) => value > 0)
            .sort((a, b) => b[1] - a[1])
          
          if (appEntries.length === 0) {
            return `${hour}<br/>无数据`
          }
          
          let tableHtml = `<table style="border-collapse: collapse; width: 100%;">`
          tableHtml += `<tr style="border-bottom: 1px solid #e8e8e8;">`
          tableHtml += `<th style="padding: 4px 8px; text-align: left; font-weight: bold; color: rgba(0,0,0,0.85);">${hour}</th>`
          tableHtml += `<th style="padding: 4px 8px; text-align: right; font-weight: bold; color: rgba(0,0,0,0.85);">时长(分钟)</th>`
          tableHtml += `</tr>`
          
          appEntries.forEach(([app, value]) => {
            const color = appColors.get(app) || '#d9d9d9'
            tableHtml += `<tr style="border-bottom: 1px solid #f0f0f0;">`
            tableHtml += `<td style="padding: 4px 8px; text-align: left;">`
            tableHtml += `<span style="display: inline-block; width: 10px; height: 10px; background: ${color}; border-radius: 2px; margin-right: 6px;"></span>`
            tableHtml += `${app}</td>`
            tableHtml += `<td style="padding: 4px 8px; text-align: right; color: rgba(0,0,0,0.85);">${value}</td>`
            tableHtml += `</tr>`
          })
          
          tableHtml += `</table>`
          return tableHtml
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
        data: top10Apps
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
      series: seriesData
    }

    chart.setOption(option, { notMerge: true })

    const handleResize = () => chart.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [hourlyAppData])

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
