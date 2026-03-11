import { useEffect, useRef, useState } from 'react'

interface StateBlockChartProps {
  slots: number[]
  size?: number
  dayStartHour?: number
}

const COLORS = ['#eee', '#cce5ff', '#99ccff', '#66b2ff', '#3399ff', '#007bff']
const ROWS = 24
const COLS = 12
const SIZE = 16
const GAP = 1.5

export function StateBlockChart({ slots, size = SIZE, dayStartHour = 0 }: StateBlockChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [tooltip, setTooltip] = useState<{ show: boolean; text: string; x: number; y: number }>({
    show: false, text: '', x: 0, y: 0
  })

  // 计算格子位置
  const cellX = calculatePositions(COLS, size, GAP, true)
  const cellY = calculatePositions(ROWS, size, GAP, false)

  const width = cellX[COLS - 1] + size
  const height = cellY[ROWS - 1] + size

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, width, height)

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const idx = r * COLS + c
        const val = Math.min(slots[idx] || 0, 5)
        ctx.fillStyle = COLORS[val]

        const x = cellX[c]
        const y = cellY[r]

        ctx.beginPath()
        roundRect(ctx, x, y, size, size, 2)
        ctx.fill()
      }
    }
  }, [slots, width, height, cellX, cellY, size])

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    let col = -1, row = -1
    for (let c = 0; c < COLS; c++) {
      if (x >= cellX[c] && x < cellX[c] + size) { col = c; break }
    }
    for (let r = 0; r < ROWS; r++) {
      if (y >= cellY[r] && y < cellY[r] + size) { row = r; break }
    }

    if (col >= 0 && row >= 0) {
      const actualHour = (row + dayStartHour) % 24
      const isNextDay = row >= (24 - dayStartHour) && dayStartHour > 0
      const startMin = col * 5
      const endMin = startMin + 5
      const timeStr = isNextDay 
        ? `${String(actualHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}-${String(actualHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')} (次日)`
        : `${String(actualHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}-${String(actualHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`
      setTooltip({ show: true, text: timeStr, x: x + 10, y: y - 25 })
    } else {
      setTooltip({ show: false, text: '', x: 0, y: 0 })
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ background: '#fafafa', borderRadius: 4 }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip({ show: false, text: '', x: 0, y: 0 })}
      />
      {tooltip.show && (
        <div style={{
          position: 'absolute',
          left: tooltip.x,
          top: tooltip.y,
          background: '#333',
          color: '#fff',
          padding: '4px 8px',
          borderRadius: 4,
          fontSize: 12,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}>
          {tooltip.text}
        </div>
      )}
    </div>
  )
}

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

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
}