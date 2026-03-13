import { useState, useEffect, useRef, useMemo } from 'react'
import { subDays, format } from 'date-fns'
import { StateBlockChart } from './StateBlockChart'
import { AppPieChart } from './AppPieChart'
import { AppStackedBarChart } from './AppStackedBarChart'
import { WindowStackedBarChart } from './WindowStackedBarChart'
import { getSlotValue, getDateInfo } from '../dataProcessor'
import { PcStateData } from '../dataProcessor'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

declare global {
  interface Window {
    PCSTATE_DATA?: PcStateData
  }
}

export function App() {
  const pcStateData = window.PCSTATE_DATA || {
    version: '1.0.0',
    day_start_hour: 0,
    record: []
  }
  const version = pcStateData.version

  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day')
  const [chartType, setChartType] = useState<'mosaic' | 'appPie' | 'appStack' | 'windowStack'>('mosaic')

  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)

  const minDate = subDays(new Date(), 30)
  minDate.setHours(0, 0, 0, 0)
  const maxDate = new Date()
  maxDate.setHours(0, 0, 0, 0)

  const normalizedSelectedDate = useMemo(() => {
    const d = new Date(selectedDate)
    d.setHours(0, 0, 0, 0)
    return d
  }, [selectedDate])

  const canGoPrev = normalizedSelectedDate.getTime() > minDate.getTime()
  const canGoNext = normalizedSelectedDate.getTime() < maxDate.getTime()

  const datePickerContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (datePickerContainerRef.current && !datePickerContainerRef.current.contains(event.target as Node)) {
        setIsDatePickerOpen(false)
      }
    }

    if (isDatePickerOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [isDatePickerOpen])

  const processedData: ReturnType<typeof getSlotValue> | null = useMemo(() => {
    if (!pcStateData) return null
    return getSlotValue(pcStateData, selectedDate)
  }, [pcStateData, selectedDate])

  const values = processedData?.slots || []
  const appHourly = processedData?.appHourly || []
  const windowHourly = processedData?.windowHourly || []
  const appData = processedData?.appTotals || {}
  const hourlyAppData = appHourly
  const hourlyWindowData = windowHourly

  const activeSlots = values.filter(v => v > 0).length
  const activeMinutes = activeSlots * 5
  const activeHours = Math.floor(activeMinutes / 60)
  const activeMins = activeMinutes % 60
  const hasData = activeSlots > 0

  const dayStartHour = pcStateData?.day_start_hour || 0

  const now = new Date()
  const generatedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  const currentDate = new Date(selectedDate)
  currentDate.setHours(0, 0, 0, 0)

  const handleDateChange = (date: Date | null) => {
    if (date) {
      setSelectedDate(date)
      setIsDatePickerOpen(false)
    }
  }

  const handleDateButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    setIsDatePickerOpen(!isDatePickerOpen)
  }

  const handlePrevDate = () => {
    const newDate = new Date(normalizedSelectedDate)
    newDate.setDate(newDate.getDate() - 1)
    if (newDate >= minDate) {
      setSelectedDate(newDate)
    }
  }

  const handleNextDate = () => {
    const newDate = new Date(normalizedSelectedDate)
    newDate.setDate(newDate.getDate() + 1)
    if (newDate <= maxDate) {
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
                  7天视图
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
                  30天视图
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
                justifyContent: 'center',
                flexDirection: 'column',
                gap: 8,
                width: '100%',
                overflow: 'hidden'
              }}>
                <div style={{
                  display: 'flex',
                  gap: 8,
                  width: '100%'
                }}>
                  <button
                    onClick={handlePrevDate}
                    disabled={!canGoPrev}
                    style={{
                      padding: '6px 12px',
                      border: '1px solid #d9d9d9',
                      background: '#fff',
                      cursor: !canGoPrev ? 'not-allowed' : 'pointer',
                      fontSize: 12,
                      borderRadius: 4,
                      whiteSpace: 'nowrap',
                      opacity: !canGoPrev ? 0.5 : 1,
                      minHeight: 32
                    }}
                  >
                    前一天
                  </button>
                  <div ref={datePickerContainerRef} style={{
                    flex: 1,
                    overflow: 'hidden',
                    fontSize: 12
                  }}>
                    <button
                      onClick={handleDateButtonClick}
                      style={{
                        width: '100%',
                        padding: '6px 12px',
                        border: '1px solid #d9d9d9',
                        background: '#fff',
                        cursor: 'pointer',
                        fontSize: 12,
                        borderRadius: 4,
                        whiteSpace: 'nowrap',
                        textAlign: 'left',
                        minHeight: 32
                      }}
                    >
                      {format(selectedDate, 'yyyy/MM/dd')}
                    </button>
                    {isDatePickerOpen && (
                      <div style={{
                        position: 'absolute',
                        zIndex: 1000,
                        marginTop: 4
                      }}>
                        <DatePicker
                          selected={selectedDate}
                          onChange={handleDateChange}
                          inline
                          showWeekNumbers
                          includeDateIntervals={[
                            { start: minDate, end: maxDate }
                          ]}
                        />
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleNextDate}
                    disabled={!canGoNext}
                    style={{
                      padding: '6px 12px',
                      border: '1px solid #d9d9d9',
                      background: '#fff',
                      cursor: !canGoNext ? 'not-allowed' : 'pointer',
                      fontSize: 12,
                      borderRadius: 4,
                      whiteSpace: 'nowrap',
                      opacity: !canGoNext ? 0.5 : 1,
                      minHeight: 32
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
              {getDateInfo(selectedDate)} - {
                chartType === 'mosaic' ? '马赛克图' :
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
                    <StateBlockChart values={values} dayStartHour={dayStartHour} showLabels={true} />
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
                        应用时长堆叠柱状图：显示每个小时内不同应用的活跃时长，堆叠显示便于对比。每小时内显示时长前5的应用，其余合并到"其他"。
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


