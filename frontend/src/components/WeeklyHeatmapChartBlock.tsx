import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
// import { formatDateToYYYYMMDD } from '../dataProcessor'

interface WeeklyHeatmapChartBlockProps {
  hourlyActivity: number[][]  // 7×24矩阵
  days: string[]  // 7天的日期字符串
  dayStartHour: number
}

function interpolateColor(startColor: string, endColor: string, steps: number): string[] {
  const hex2rgb = (hex: string) => ({
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16)
  })
  
  const rgb2hex = (r: number, g: number, b: number) => 
    `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`
  
  const start = hex2rgb(startColor)
  const end = hex2rgb(endColor)
  const colors: string[] = []
  
  for (let i = 0; i < steps; i++) {
    const ratio = i / (steps - 1)
    const r = start.r + (end.r - start.r) * ratio
    const g = start.g + (end.g - start.g) * ratio
    const b = start.b + (end.b - start.b) * ratio
    colors.push(rgb2hex(r, g, b))
  }
  
  return colors
}

const COLORS = ['#eee', ...interpolateColor('#cce5ff', '#007bff', 60)]
const ROWS = 7  // 7天
const COLS = 24  // 24小时
const SIZE = 24
const GAP = 2
const PADDING = 10

function calculatePositions(count: number, size: number, gap: number): number[] {
  const positions = [0]
  let acc = size
  for (let i = 1; i < count; i++) {
    acc += gap
    positions[i] = acc
    acc += size
  }
  return positions
}

function formatDateLabel(dateStr: string): string {
  const normalized = dateStr.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')
  const d = new Date(normalized + 'T00:00:00')
  const weekDays = ['日', '一', '二', '三', '四', '五', '六']
  return `${d.getMonth() + 1}/${d.getDate()}(${weekDays[d.getDay()]})`
}

export function WeeklyHeatmapChartBlock({ hourlyActivity, days, dayStartHour }: WeeklyHeatmapChartBlockProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstanceRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!chartRef.current) return

    if (!chartInstanceRef.current) {
      chartInstanceRef.current = echarts.init(chartRef.current)
    }
    const chart = chartInstanceRef.current
    chart.clear()

    const cellX = calculatePositions(COLS, SIZE, GAP)
    const cellY = calculatePositions(ROWS, SIZE, GAP)
    const width = cellX[COLS - 1] + SIZE + PADDING * 2
    const height = cellY[ROWS - 1] + SIZE + PADDING * 2

    // 重要：hourlyActivity[day][hourIdx] 中，hourIdx=0 就是 dayStartHour 时
    // 不需要再像日热力图那样做小时转换，因为数据已经处理好了
    const data: any[] = []
    for (let day = 0; day < ROWS; day++) {
      for (let hourIdx = 0; hourIdx < COLS; hourIdx++) {
        const activity = hourlyActivity[day]?.[hourIdx] || 0
        const colorIndex = Math.min(activity, 60)
        
        // 计算实际显示的小时（用于标签）
        const displayHour = (dayStartHour + hourIdx) % 24
        
        data.push({
          x: PADDING + cellX[hourIdx],
          y: PADDING + cellY[day],
          width: SIZE,
          height: SIZE,
          value: activity,
          color: COLORS[colorIndex] || COLORS[COLORS.length - 1],
          day: days[day],
          hour: displayHour,
          hourIndex: hourIdx
        })
      }
    }

    const option: echarts.EChartsOption = {
      grid: {
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        containLabel: false
      },
      xAxis: {
        show: false,
        type: 'value',
        min: 0,
        max: width,
        axisTick: { show: false },
        axisLine: { show: false }
      },
      yAxis: {
        show: false,
        type: 'value',
        min: 0,
        max: height,
        inverse: true,
        axisTick: { show: false },
        axisLine: { show: false }
      },
      tooltip: {
        trigger: 'item',
        backgroundColor: '#333',
        textStyle: {
          fontSize: 12,
          color: '#fff'
        },
        padding: [4, 8],
        borderRadius: 4,
        position: (point: number[]) => [point[0] + 10, point[1] - 25],
        formatter: (params: any) => {
          const item = params.data?.[0]
          if (!item) return ''
          
          const dateStr = item.day.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')
          const isNextDay = item.hourIndex >= (24 - dayStartHour) && dayStartHour > 0
          const dayLabel = isNextDay ? '次日' : ''
          
          return `${dateStr} ${item.hour}:00 ${dayLabel}<br/>活跃时间: ${item.value}分钟`
        }
      },
      series: [
        {
          type: 'custom',
          renderItem: (params: any, api: any) => {
            const dataItem = data[params.dataIndex]
            if (!dataItem) return null

            const x = api.coord([dataItem.x, dataItem.y])[0]
            const y = api.coord([dataItem.x, dataItem.y])[1]
            const w = api.size([dataItem.width, dataItem.height])[0]
            const h = api.size([dataItem.width, dataItem.height])[1]

            return {
              type: 'rect',
              shape: {
                x: x - w / 2,
                y: y - h / 2,
                width: w,
                height: h,
                r: 2
              },
              style: {
                fill: dataItem.color
              },
              name: `${dataItem.day}-${dataItem.hour}`
            }
          },
          data: data.map((item) => [item]),
          animation: false
        }
      ]
    }

    chart.setOption(option, { notMerge: true })

    const handleResize = () => chart.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [hourlyActivity, days])

  const cellX = calculatePositions(COLS, SIZE, GAP)
  const cellY = calculatePositions(ROWS, SIZE, GAP)
  const chartWidth = cellX[COLS - 1] + SIZE + PADDING * 2
  const chartHeight = cellY[ROWS - 1] + SIZE + PADDING * 2

  // 准备显示的小时顺序（从dayStartHour开始）
  const hours = Array.from({ length: 24 }, (_, i) => i)
  const displayHours = dayStartHour > 0 
    ? [...hours.slice(dayStartHour), ...hours.slice(0, dayStartHour)]
    : hours

  return (
    <div style={{ position: 'relative', marginLeft: 60, marginTop: 24 }}>
      {/* 顶部小时标签（从dayStartHour开始） */}
      {[0, 6, 12, 18].map(offset => {
        const displayHour = (dayStartHour + offset) % 24
        return (
          <div key={offset} style={{
            position: 'absolute',
            top: -20,
            left: PADDING + cellX[offset],
            fontSize: 11,
            color: 'rgba(0,0,0,0.45)',
            transform: 'translateX(-50%)',
            whiteSpace: 'nowrap'
          }}>
            {displayHour}:00
          </div>
        )
      })}

      {/* 左侧日期标签 */}
      {days.map((day, index) => (
        <div key={day} style={{
          position: 'absolute',
          left: -50,
          top: PADDING + cellY[index] + 8,
          fontSize: 11,
          color: 'rgba(0,0,0,0.45)',
          textAlign: 'right',
          width: 42,
          transform: 'translateY(-50%)'
        }}>
          {formatDateLabel(day)}
        </div>
      ))}

      <div
        ref={chartRef}
        style={{
          width: chartWidth,
          height: chartHeight
        }}
      />
    </div>
  )
}
