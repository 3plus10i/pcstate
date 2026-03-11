import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'

interface StateBlockChartEChartsProps {
  slots: number[]
  size?: number
}

const COLORS = ['#eee', '#cce5ff', '#99ccff', '#66b2ff', '#3399ff', '#007bff']
const ROWS = 24
const COLS = 12
const SIZE = 16
const GAP = 1.5
const PADDING = 10

export function StateBlockChartECharts({ slots, size = SIZE }: StateBlockChartEChartsProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstanceRef = useRef<echarts.ECharts | null>(null)

  const calculatePositions = (count: number, size: number, gap: number, isHour: boolean): number[] => {
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

    const data: any[] = []
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const idx = r * COLS + c
        const val = Math.min(slots[idx] || 0, 5)
        data.push({
          x: PADDING + cellX[c],
          y: PADDING + cellY[r],
          width: size,
          height: size,
          value: val,
          row: r,
          col: c,
          timeStr: `${String(r).padStart(2, '0')}:${String(c * 5).padStart(2, '0')}-${String(r).padStart(2, '0')}:${String(c * 5 + 5).padStart(2, '0')}`
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
            if (!dataItem) return {}

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
                fill: COLORS[dataItem.value]
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
  }, [slots, size])

  const cellX = calculatePositions(COLS, size, GAP, true)
  const cellY = calculatePositions(ROWS, size, GAP, false)
  const chartWidth = cellX[COLS - 1] + size + PADDING * 2
  const chartHeight = cellY[ROWS - 1] + size + PADDING * 2

  return (
    <div
      ref={chartRef}
      style={{
        width: chartWidth,
        height: chartHeight
      }}
    />
  )
}
