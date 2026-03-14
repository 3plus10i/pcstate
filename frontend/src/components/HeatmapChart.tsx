import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'

interface HeatmapChartProps {
  values: number[]
  size?: number
  dayStartHour?: number
  showLabels?: boolean
  selectedDate?: Date
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

const COLORS = ['#eee', ...interpolateColor('#cce5ff', '#007bff', 5)]
const BORDER_COLOR = COLORS[COLORS.length - 1]  // 最蓝的颜色
const ROWS = 24
const COLS = 12
const SIZE = 16
const GAP = 1.5
const PADDING = 10

function calculatePositions(count: number, size: number, gap: number, isHour: boolean): number[] {
  const positions = [0]
  let acc = size
  for (let i = 1; i < count; i++) {
    const g = isHour ? (i % 3 === 0 ? gap * 2 : gap) : (i % 4 === 0 ? gap * 4 : gap)
    acc += g
    positions[i] = acc
    acc += size
  }
  return positions
}

function getTimeDisplay(row: number, col: number, dayStartHour: number): string {
  const actualHour = (row + dayStartHour) % 24
  const isNextDay = row >= (24 - dayStartHour) && dayStartHour > 0
  const startMin = col * 5
  const endMin = startMin + 5
  const timeLabel = `${String(actualHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}-${String(actualHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`
  return isNextDay ? `${timeLabel} (次日)` : timeLabel
}

function formatHourLabel(row: number, dayStartHour: number): string {
  const actualHour = (row + dayStartHour) % 24
  const isNextDay = row >= (24 - dayStartHour) && dayStartHour > 0
  return isNextDay ? `${actualHour}时*` : `${actualHour}时`
}

export function HeatmapChart({ values, size = SIZE, dayStartHour = 0, showLabels = true, selectedDate }: HeatmapChartProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstanceRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!chartRef.current) return

    if (!chartInstanceRef.current) {
      chartInstanceRef.current = echarts.init(chartRef.current)
    }
    const chart = chartInstanceRef.current
    chart.clear()

    const cellX = calculatePositions(COLS, size, GAP, true)
    const cellY = calculatePositions(ROWS, size, GAP, false)
    const width = cellX[COLS - 1] + size + PADDING * 2
    const height = cellY[ROWS - 1] + size + PADDING * 2

    // 计算当前时间对应的格子（仅当显示的是今天时）
    const now = new Date()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const compareDate = selectedDate || today
    const isToday = now.toDateString() === compareDate.toDateString()
    
    let currentRow = -1
    let currentCol = -1
    
    if (isToday) {
      const currentHour = now.getHours()
      const currentMinute = now.getMinutes()
      
      // 计算当前小时在dayStartHour调整后的行
      currentRow = (currentHour - dayStartHour + 24) % 24
      currentCol = Math.floor(currentMinute / 5)
    }

    const data: any[] = []
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const idx = r * COLS + c
        const val = Math.min(values[idx] || 0, 5)

        data.push({
          x: PADDING + cellX[c],
          y: PADDING + cellY[r],
          width: size,
          height: size,
          value: val,
          timeStr: getTimeDisplay(r, c, dayStartHour),
          isCurrent: isToday && r === currentRow && c === currentCol
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
          return item?.timeStr || ''
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

            const isCurrent = dataItem.isCurrent
            
            return {
              type: 'rect',
              shape: {
                x: x - w / 2,
                y: y - h / 2,
                width: w,
                height: h,
                r: isCurrent ? SIZE / 2 : 2
              },
              style: {
                fill: COLORS[dataItem.value],
                lineWidth: isCurrent ? 1 : 0,
                stroke: isCurrent ? BORDER_COLOR : undefined
              },
              name: dataItem.timeStr
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
  }, [values, size, dayStartHour])

  const cellX = calculatePositions(COLS, size, GAP, true)
  const cellY = calculatePositions(ROWS, size, GAP, false)
  const chartWidth = cellX[COLS - 1] + size + PADDING * 2
  const chartHeight = cellY[ROWS - 1] + size + PADDING * 2

  return (
    <div style={{ position: 'relative', marginLeft: showLabels ? 44 : 0, marginTop: showLabels ? 24 : 0 }}>
      {showLabels && (
        <>
          {/* 顶部时间标签 */}
          {[0, 3, 6, 9].map(col => {
            return (
              <div key={col} style={{
                position: 'absolute',
                top: -20,
                left: PADDING + cellX[col],
                fontSize: 11,
                color: 'rgba(0,0,0,0.45)',
                transform: 'translateX(-50%)',
                whiteSpace: 'nowrap'
              }}>
                {col * 5}分
              </div>
            )
          })}

          {/* 左侧时间标签 */}
          {[0, 4, 8, 12, 16, 20, 23].map(row => (
            <div key={row} style={{
              position: 'absolute',
              left: -40,
              top: PADDING + cellY[row] + 8,
              fontSize: 11,
              color: 'rgba(0,0,0,0.45)',
              textAlign: 'right',
              width: 32,
              transform: 'translateY(-50%)'
            }}>
              {formatHourLabel(row, dayStartHour)}
            </div>
          ))}
        </>
      )}

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
