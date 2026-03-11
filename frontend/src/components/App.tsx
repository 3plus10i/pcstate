import { useState } from 'react'
import { StateBlockChart } from './StateBlockChart'

// 全局变量类型声明
declare global {
  const RECORD_DATA: number[][]
  const DATES: string[]
  const APP_VERSION: string
  const DAY_START_HOUR: number
}

function formatDate(dateStr: string): string {
  const weekDays = ['日', '一', '二', '三', '四', '五', '六']
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth() + 1}/${d.getDate()}(${weekDays[d.getDay()]})`
}

function getDateInfo(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  
  // 星期几
  const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  const weekDay = weekDays[d.getDay()]
  
  // 第几周
  const firstDay = new Date(d.getFullYear(), 0, 1)
  const pastDays = Math.floor((d.getTime() - firstDay.getTime()) / (24 * 60 * 60 * 1000))
  const weekNum = Math.ceil((pastDays + firstDay.getDay() + 1) / 7)
  
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${weekDay} 第${weekNum}周`
}

function formatDuration(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return `${h}h${m}m`
  }
  return `${minutes}min`
}

export function App() {
  const [selectedIndex, setSelectedIndex] = useState(0)

  const slots = RECORD_DATA?.[selectedIndex] || []
  const dateStr = DATES?.[selectedIndex] || ''
  const activeSlots = slots.filter(v => v > 0).length
  const activeMinutes = activeSlots * 5
  const activeHours = Math.floor(activeMinutes / 60)
  const activeMins = activeMinutes % 60

  const version = typeof APP_VERSION !== 'undefined' ? APP_VERSION : '1.0.0'
  const dayStartHour = typeof DAY_START_HOUR !== 'undefined' ? DAY_START_HOUR : 0
  const now = new Date()
  const generatedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  return (
    <div style={{ padding: '40px 20px', minHeight: '100vh', background: '#f0f2f5' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{
          background: '#fff',
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          padding: 24,
          marginBottom: 16
        }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20, color: 'rgba(0,0,0,0.85)' }}>
            PCState - PC活跃状态记录器
          </h1>

          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
            {/* 左侧日期列表 */}
            <div style={{
              flexShrink: 0,
              width: 160,
              fontSize: 14,
              color: 'rgba(0,0,0,0.45)',
              background: '#fff',
              borderRadius: 4,
              border: '1px solid #d9d9d9',
              overflow: 'hidden'
            }}>
              <div style={{
                fontWeight: 500,
                color: 'rgba(0,0,0,0.65)',
                padding: '8px 12px',
                background: '#fafafa',
                borderBottom: '1px solid #d9d9d9'
              }}>
                近14天活跃
              </div>
              <div>
                {DATES?.map((date, i) => {
                  const mins = (RECORD_DATA[i]?.filter(v => v > 0).length || 0) * 5
                  return (
                    <div
                      key={date}
                      onClick={() => setSelectedIndex(i)}
                      style={{
                        padding: '8px 12px',
                        borderBottom: '1px solid #e8e8e8',
                        cursor: 'pointer',
                        background: selectedIndex === i ? '#1890ff' : 'transparent',
                        color: selectedIndex === i ? '#fff' : 'inherit'
                      }}
                    >
                      <span style={{ display: 'inline-block', width: 70 }}>{formatDate(date)}</span>
                      <span style={{
                        color: selectedIndex === i ? '#fff' : '#1890ff',
                        fontWeight: 500
                      }}>
                        {formatDuration(mins)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 右侧图表区域 */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {/* 图形区域标题 */}
              <div style={{
                width: '100%',
                fontSize: 16,
                fontWeight: 500,
                color: 'rgba(0,0,0,0.85)',
                marginBottom: 16,
                padding: '8px 0',
                borderBottom: '1px solid #e8e8e8'
              }}>
                {getDateInfo(dateStr)}
              </div>

              {/* 时间标签 + 格子图 */}
              <div style={{ position: 'relative', marginLeft: 44, marginTop: 24 }}>
                {/* 顶部时间标签 */}
                {[0, 3, 6, 9].map(col => {
                  const cellX = calculateCellX(col)
                  return (
                    <div key={col} style={{
                      position: 'absolute',
                      top: -20,
                      left: cellX,
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
                    top: calculateCellY(row) + 8,
                    fontSize: 11,
                    color: 'rgba(0,0,0,0.45)',
                    textAlign: 'right',
                    width: 32,
                    transform: 'translateY(-50%)'
                  }}>
                    {formatHourLabel(row, dayStartHour)}
                  </div>
                ))}

                <StateBlockChart slots={slots} dayStartHour={dayStartHour} />
              </div>

              {/* 格子图附属文字 */}
              <div style={{
                marginTop: 20,
                fontSize: 13,
                color: 'rgba(0,0,0,0.45)',
                padding: '12px 16px',
                background: '#fafafa',
                borderRadius: 4,
                lineHeight: 1.6
              }}>
                <p>
                  {activeHours === 0
                    ? `活跃时间${activeMins}分钟，已点亮${activeSlots}个小格`
                    : `活跃时间${activeHours}小时${activeMins}分钟，已点亮${activeSlots}个小格`
                  } · 每个小格表示5分钟，格子颜色越深表示越繁忙。
                </p>
                {dayStartHour > 0 && (
                  <p>
                    当前一天起始时间：凌晨{dayStartHour}时（带*号表示次日时间）
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 页脚 */}
        <div style={{
          textAlign: 'center',
          padding: '24px 20px',
          fontSize: 13,
          color: 'rgba(0,0,0,0.45)',
          lineHeight: 1.8
        }}>
          PCState v{version} · PC活跃状态记录器 ·{' '}
          <a href="https://github.com/3plus10i/pcstate" target="_blank" rel="noopener" style={{ color: '#0084ffb0', textDecoration: 'none' }}>
            项目主页
          </a>
          <br />
          数据页生成于 {generatedDate}
        </div>
      </div>
    </div>
  )
}

// 计算格子位置（与 StateBlockChart 保持一致）
const SIZE = 16
const GAP = 1.5

function calculateCellX(col: number): number {
  const positions = [0]
  let acc = SIZE
  for (let i = 1; i < 12; i++) {
    acc += i % 3 === 0 ? GAP * 2 : GAP
    positions[i] = acc
    acc += SIZE
  }
  return positions[col] || 0
}

function calculateCellY(row: number): number {
  const positions = [0]
  let acc = SIZE
  for (let i = 1; i < 24; i++) {
    acc += i % 4 === 0 ? GAP * 4 : GAP
    positions[i] = acc
    acc += SIZE
  }
  return positions[row] || 0
}

function formatHourLabel(row: number, dayStartHour: number): string {
  const actualHour = (row + dayStartHour) % 24
  const isNextDay = row >= (24 - dayStartHour) && dayStartHour > 0
  return isNextDay ? `${actualHour}时*` : `${actualHour}时`
}
