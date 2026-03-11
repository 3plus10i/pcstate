import { useState } from 'react'
import { StateBlockChart } from './StateBlockChart'
import { HourlyBarChart } from './HourlyBarChart'
import { AppPieChart } from './AppPieChart'
import { AppStackedBarChart } from './AppStackedBarChart'
import { WindowStackedBarChart } from './WindowStackedBarChart'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

// 全局变量类型声明
declare global {
  const RECORD_DATA: number[][]
  const DATES: string[]
  const APP_DATA: Record<string, number>[]
  const WINDOW_DATA: Record<string, number>[]
  const HOURLY_APP_DATA: Record<string, number>[][]
  const HOURLY_WINDOW_DATA: Record<string, number>[][]
  const APP_VERSION: string
  const DAY_START_HOUR: number
}

interface HourlyDataItem {
  [key: string]: number
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
  // 使用全局变量或默认值
  const recordData = typeof RECORD_DATA !== 'undefined' ? RECORD_DATA : []
  const dates = typeof DATES !== 'undefined' ? DATES : []
  const version = typeof APP_VERSION !== 'undefined' ? APP_VERSION : '1.0.0'
  const dayStartHour = typeof DAY_START_HOUR !== 'undefined' ? DAY_START_HOUR : 0
  
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [viewMode, setViewMode] = useState('day') // day, week, month
  const [chartType, setChartType] = useState('mosaic') // 暂时只实现马赛克图
  
  // 日期选择器停留在当天日期
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())

  // 检查是否有数据
  const hasData = recordData.length > 0 && dates.length > 0
  
  // 确保selectedIndex在有效范围内
  const safeSelectedIndex = hasData ? Math.min(selectedIndex, recordData.length - 1) : 0
  
  const slots = hasData ? (recordData[safeSelectedIndex] || []) : []
  const dateStr = hasData ? (dates[safeSelectedIndex] || '') : ''
  const appData = hasData ? (typeof APP_DATA !== 'undefined' ? APP_DATA[safeSelectedIndex] : {}) : {}
  const hourlyAppData = hasData ? (typeof HOURLY_APP_DATA !== 'undefined' && HOURLY_APP_DATA[safeSelectedIndex] ? HOURLY_APP_DATA[safeSelectedIndex] : []) : []
  const hourlyWindowData = hasData ? (typeof HOURLY_WINDOW_DATA !== 'undefined' && HOURLY_WINDOW_DATA[safeSelectedIndex] ? HOURLY_WINDOW_DATA[safeSelectedIndex] : []) : []
  const activeSlots = slots.filter(v => v > 0).length
  const activeMinutes = activeSlots * 5
  const activeHours = Math.floor(activeMinutes / 60)
  const activeMins = activeMinutes % 60

  const now = new Date()
  const generatedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  // 计算当前日期的 M/D 格式
  const currentDate = new Date(dateStr + 'T00:00:00')
  const displayDate = `${currentDate.getMonth() + 1}/${currentDate.getDate()}`

  // 格式化日期为 yyyymmdd 格式
  const formatDateToYYYYMMDD = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}${month}${day}`
  }

  // 处理日期选择
  const handleDateChange = (date: Date | null) => {
    if (date) {
      setSelectedDate(date)
      // 这里可以根据选择的日期更新 selectedIndex
      // 暂时简化处理，实际项目中需要根据日期找到对应的索引
    }
  }

  // 模拟日期切换（暂时简化实现）
  const handlePrevDate = () => {
    if (hasData && safeSelectedIndex < recordData.length - 1) {
      setSelectedIndex(safeSelectedIndex + 1)
      // 更新 selectedDate
      const newDate = new Date(currentDate)
      newDate.setDate(newDate.getDate() - 1)
      setSelectedDate(newDate)
    } else {
      // 无数据时，只更新日期选择器
      const newDate = new Date(selectedDate)
      newDate.setDate(newDate.getDate() - 1)
      setSelectedDate(newDate)
    }
  }

  const handleNextDate = () => {
    if (hasData && safeSelectedIndex > 0) {
      setSelectedIndex(safeSelectedIndex - 1)
      // 更新 selectedDate
      const newDate = new Date(currentDate)
      newDate.setDate(newDate.getDate() + 1)
      setSelectedDate(newDate)
    } else {
      // 无数据时，只更新日期选择器
      const newDate = new Date(selectedDate)
      newDate.setDate(newDate.getDate() + 1)
      setSelectedDate(newDate)
    }
  }

  return (
    <div style={{ padding: '40px 20px', minHeight: '100vh', background: '#f0f2f5' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        {/* 顶部标题栏 */}
        <div style={{
          background: '#fff',
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          padding: '16px 24px',
          marginBottom: 16
        }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'rgba(0,0,0,0.85)', margin: 0 }}>
            PCState - PC活跃状态记录器 - 统计报表
          </h1>
        </div>

        {/* 主内容区域 */}
        <div style={{
          background: '#fff',
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          padding: 24,
          marginBottom: 16,
          display: 'flex',
          gap: 24
        }}>
          {/* 左侧控制面板 */}
          <div style={{
            flexShrink: 0,
            minWidth: 250,
            display: 'flex',
            flexDirection: 'column',
            gap: 24
          }}>
            {/* 视图切换 */}
            <div>
              <div style={{
                fontSize: 14,
                fontWeight: 500,
                color: 'rgba(0,0,0,0.65)',
                marginBottom: 8
              }}>
                时长区间选择
              </div>
              <div style={{
                background: '#fff',
                borderRadius: 4,
                border: '1px solid #d9d9d9',
                overflow: 'hidden'
              }}>
                <div
                  onClick={() => setViewMode('day')}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    background: viewMode === 'day' ? '#1890ff' : 'transparent',
                    color: viewMode === 'day' ? '#fff' : 'rgba(0,0,0,0.45)',
                    borderBottom: '1px solid #e8e8e8'
                  }}
                >
                  日视图
                </div>
                <div
                  onClick={() => setViewMode('week')}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    background: viewMode === 'week' ? '#1890ff' : 'transparent',
                    color: viewMode === 'week' ? '#fff' : 'rgba(0,0,0,0.45)',
                    borderBottom: '1px solid #e8e8e8'
                  }}
                >
                  周视图
                </div>
                <div
                  onClick={() => setViewMode('month')}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    background: viewMode === 'month' ? '#1890ff' : 'transparent',
                    color: viewMode === 'month' ? '#fff' : 'rgba(0,0,0,0.45)'
                  }}
                >
                  月视图
                </div>
              </div>
            </div>

            {/* 起始日期选择 */}
            <div>
              <div style={{
                fontSize: 14,
                fontWeight: 500,
                color: 'rgba(0,0,0,0.65)',
                marginBottom: 8
              }}>
                起始日期选择
              </div>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                width: '100%',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: '100%',
                  overflow: 'hidden',
                  fontSize: 12
                }}>
                  <DatePicker
                    selected={selectedDate}
                    onChange={handleDateChange}
                    inline
                    dateFormat="yyyyMMdd"
                  />
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: 8
                }}>
                  <button
                    onClick={handlePrevDate}
                    style={{
                      padding: '6px 12px',
                      border: '1px solid #d9d9d9',
                      background: '#fff',
                      cursor: 'pointer',
                      fontSize: 14,
                      borderRadius: 4
                    }}
                  >
                    前一天
                  </button>
                  <button
                    onClick={handleNextDate}
                    style={{
                      padding: '6px 12px',
                      border: '1px solid #d9d9d9',
                      background: '#fff',
                      cursor: 'pointer',
                      fontSize: 14,
                      borderRadius: 4
                    }}
                  >
                    后一天
                  </button>
                </div>
              </div>
            </div>

            {/* 图表类型选择 */}
            <div>
              <div style={{
                fontSize: 14,
                fontWeight: 500,
                color: 'rgba(0,0,0,0.65)',
                marginBottom: 8
              }}>
                图表类型选择
              </div>
              <div style={{
                fontSize: 12,
                color: 'rgba(0,0,0,0.45)',
                marginBottom: 8
              }}>
                (不同时间视图，选项也不同)
              </div>
              <div style={{
                background: '#fff',
                borderRadius: 4,
                border: '1px solid #d9d9d9',
                overflow: 'hidden'
              }}>
                <div
                  onClick={() => setChartType('mosaic')}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    background: chartType === 'mosaic' ? '#1890ff' : 'transparent',
                    color: chartType === 'mosaic' ? '#fff' : 'rgba(0,0,0,0.45)'
                  }}
                >
                  活跃马赛克图
                </div>
                <div
                  onClick={() => setChartType('hourly')}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    background: chartType === 'hourly' ? '#1890ff' : 'transparent',
                    color: chartType === 'hourly' ? '#fff' : 'rgba(0,0,0,0.45)',
                    borderTop: '1px solid #e8e8e8'
                  }}
                >
                  活跃小时柱状图
                </div>
                <div
                  onClick={() => setChartType('appPie')}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    background: chartType === 'appPie' ? '#1890ff' : 'transparent',
                    color: chartType === 'appPie' ? '#fff' : 'rgba(0,0,0,0.45)',
                    borderTop: '1px solid #e8e8e8'
                  }}
                >
                  应用时长饼图
                </div>
                <div
                  onClick={() => setChartType('appStack')}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    background: chartType === 'appStack' ? '#1890ff' : 'transparent',
                    color: chartType === 'appStack' ? '#fff' : 'rgba(0,0,0,0.45)',
                    borderTop: '1px solid #e8e8e8'
                  }}
                >
                  应用时长堆叠柱状图
                </div>
                <div
                  onClick={() => setChartType('windowStack')}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    background: chartType === 'windowStack' ? '#1890ff' : 'transparent',
                    color: chartType === 'windowStack' ? '#fff' : 'rgba(0,0,0,0.45)',
                    borderTop: '1px solid #e8e8e8'
                  }}
                >
                  窗口时长堆叠柱状图
                </div>
              </div>
            </div>
          </div>

          {/* 右侧图表区域 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {/* 图标题 */}
            <div style={{
              width: '100%',
              fontSize: 16,
              fontWeight: 500,
              color: 'rgba(0,0,0,0.85)',
              marginBottom: 16,
              padding: '8px 0',
              borderBottom: '1px solid #e8e8e8',
              textAlign: 'center'
            }}>
              {getDateInfo(dateStr)} - {
                chartType === 'mosaic' ? '马赛克图' :
                chartType === 'hourly' ? '活跃小时柱状图' :
                chartType === 'appPie' ? '应用时长饼图' :
                chartType === 'appStack' ? '应用时长堆叠柱状图' :
                '窗口时长堆叠柱状图'
              }
            </div>

            {/* 图表主体 */}
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              {hasData ? (
                <>
                  {chartType === 'mosaic' && (
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
                  )}
                  {chartType === 'hourly' && (
                    <div style={{ width: '100%', padding: '20px' }}>
                      <HourlyBarChart slots={slots} dayStartHour={dayStartHour} />
                    </div>
                  )}
                  {chartType === 'appPie' && (
                    <div style={{ width: '100%', padding: '20px' }}>
                      <AppPieChart appData={appData} />
                    </div>
                  )}
                  {chartType === 'appStack' && (
                    <div style={{ width: '100%', padding: '20px' }}>
                      <AppStackedBarChart hourlyAppData={hourlyAppData} dayStartHour={dayStartHour} />
                    </div>
                  )}
                  {chartType === 'windowStack' && (
                    <div style={{ width: '100%', padding: '20px' }}>
                      <WindowStackedBarChart hourlyWindowData={hourlyWindowData} dayStartHour={dayStartHour} />
                    </div>
                  )}
                </>
              ) : (
                <div style={{
                  fontSize: 16,
                  color: 'rgba(0,0,0,0.45)',
                  textAlign: 'center',
                  padding: '40px 0'
                }}>
                  无数据
                </div>
              )}
            </div>

            {/* 图说明 */}
            <div style={{
              marginTop: 20,
              fontSize: 13,
              color: 'rgba(0,0,0,0.45)',
              padding: '12px 16px',
              background: '#fafafa',
              borderRadius: 4,
              lineHeight: 1.6
            }}>
              {hasData ? (
                <>
                  {chartType === 'mosaic' && (
                    <>
                      <p>
                        活跃马赛克图：每个小格表示5分钟，格子颜色越深表示越繁忙。
                      </p>
                      <p>
                        {activeHours === 0
                          ? `活跃时间${activeMins}分钟，已点亮${activeSlots}个小格`
                          : `活跃时间${activeHours}小时${activeMins}分钟，已点亮${activeSlots}个小格`
                        }
                      </p>
                      {dayStartHour > 0 && (
                        <p>
                          当前一天起始时间：凌晨{dayStartHour}时（带*号表示次日时间）
                        </p>
                      )}
                    </>
                  )}
                  {chartType === 'hourly' && (
                    <>
                      <p>
                        活跃小时柱状图：显示每个小时的活跃时长，柱状图越高表示该小时越繁忙。
                      </p>
                      <p>
                        {activeHours === 0
                          ? `活跃时间${activeMins}分钟`
                          : `活跃时间${activeHours}小时${activeMins}分钟`
                        }
                      </p>
                    </>
                  )}
                  {chartType === 'appPie' && (
                    <>
                      <p>
                        应用时长饼图：展示不同应用的活跃时长占比，5%以上有图例，5%以下合并到"其他"。
                      </p>
                      <p>
                        {activeHours === 0
                          ? `活跃时间${activeMins}分钟`
                          : `活跃时间${activeHours}小时${activeMins}分钟`
                        }
                      </p>
                    </>
                  )}
                  {chartType === 'appStack' && (
                    <>
                      <p>
                        应用时长堆叠柱状图：显示每个小时内不同应用的活跃时长，堆叠显示便于对比。
                      </p>
                      <p>
                        {activeHours === 0
                          ? `活跃时间${activeMins}分钟`
                          : `活跃时间${activeHours}小时${activeMins}分钟`
                        }
                      </p>
                    </>
                  )}
                  {chartType === 'windowStack' && (
                    <>
                      <p>
                        窗口时长堆叠柱状图：显示每个小时内不同窗口的活跃时长，堆叠显示便于对比。
                      </p>
                      <p>
                        {activeHours === 0
                          ? `活跃时间${activeMins}分钟`
                          : `活跃时间${activeHours}小时${activeMins}分钟`
                        }
                      </p>
                    </>
                  )}
                </>
              ) : (
                <p>
                  暂无数据记录，请稍后再试。
                </p>
              )}
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
