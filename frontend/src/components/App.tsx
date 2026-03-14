import { useState, useEffect, useRef, useMemo } from 'react'
import { subDays, format } from 'date-fns'
import { HeatmapChart } from './HeatmapChart'
import { AppPieChart } from './AppPieChart'
import { AppBarChart } from './AppBarChart'
import { WeeklyHeatmapChart } from './WeeklyHeatmapChart'
import { WeeklyAppPieChart } from './WeeklyAppPieChart'
import { WeeklyAppBarChart } from './WeeklyAppBarChart'
import { useReportState } from '../hooks/useReportState'
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

  // 使用自定义 Hook 管理状态
  const {
    viewMode,
    chartType,
    selectedDate,
    processedData,
    processedWeekData,
    chartTitle,
    chartDescription,
    setViewMode,
    setChartType,
    setSelectedDate,
    goPrevDate,
    goNextDate
  } = useReportState(pcStateData)

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

  const values = processedData?.slots || []
  const appHourly = processedData?.appHourly || []
  const appData = processedData?.appTotals || {}
  const hourlyAppData = appHourly
  const dayStartHour = pcStateData?.day_start_hour || 0
  
  // 周视图数据
  const weekHourlyActivity = processedWeekData?.hourlyActivity || []
  const weekAppTotals = processedWeekData?.weekAppTotals || {}
  const weekHourlyAppData = processedWeekData?.hourlyAppData || []
  const weekDays = processedWeekData?.days || []
  
  const hasData = viewMode === 'week' 
    ? (weekHourlyActivity.some(day => day.some(h => h > 0)))
    : ((processedData?.slots?.filter(v => v > 0).length || 0) > 0)

  return (
    <div style={{ padding: '40px 20px', minHeight: '100vh', background: '#f0f2f5' }}>
      <div style={{ maxWidth: '80vw', margin: '0 auto' }}>
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
                  onClick={() => {
                    setViewMode('day')
                    setChartType('heatmap')
                  }}
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
                  onClick={() => {
                    setViewMode('week')
                    setChartType('weekHeatmap')
                  }}
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
                    onClick={goPrevDate}
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
                          includeDateIntervals={[{
                            start: minDate, end: maxDate
                          }]}
                        />
                      </div>
                    )}
                  </div>
                  <button
                    onClick={goNextDate}
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
                {viewMode === 'day' && (
                  <>
                    <div
                      onClick={() => setChartType('heatmap')}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        background: chartType === 'heatmap' ? '#1890ff' : 'transparent',
                        color: chartType === 'heatmap' ? '#fff' : 'rgba(0,0,0,0.45)'
                      }}
                    >
                      活跃热力图
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
                      onClick={() => setChartType('bar')}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        background: chartType === 'bar' ? '#1890ff' : 'transparent',
                        color: chartType === 'bar' ? '#fff' : 'rgba(0,0,0,0.45)',
                        borderTop: '1px solid #e8e8e8'
                      }}
                    >
                      应用时长柱状图
                    </div>
                  </>
                )}
                
                {viewMode === 'week' && (
                  <>
                    <div
                      onClick={() => setChartType('weekHeatmap')}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        background: chartType === 'weekHeatmap' ? '#1890ff' : 'transparent',
                        color: chartType === 'weekHeatmap' ? '#fff' : 'rgba(0,0,0,0.45)'
                      }}
                    >
                      周热力图
                    </div>
                    <div
                      onClick={() => setChartType('weekAppPie')}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        background: chartType === 'weekAppPie' ? '#1890ff' : 'transparent',
                        color: chartType === 'weekAppPie' ? '#fff' : 'rgba(0,0,0,0.45)',
                        borderTop: '1px solid #e8e8e8'
                      }}
                    >
                      周应用饼图
                    </div>
                    <div
                      onClick={() => setChartType('weekBar')}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        background: chartType === 'weekBar' ? '#1890ff' : 'transparent',
                        color: chartType === 'weekBar' ? '#fff' : 'rgba(0,0,0,0.45)',
                        borderTop: '1px solid #e8e8e8'
                      }}
                    >
                      周应用柱状图
                    </div>
                  </>
                )}

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
              {chartTitle}
            </div>

            {/* 图表主体 */}
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              {hasData ? (
                <>
                  {viewMode === 'day' && (
                    <>
                      {chartType === 'heatmap' && (
                        <HeatmapChart values={values} dayStartHour={dayStartHour} showLabels={true} selectedDate={selectedDate} />
                      )}
                      {chartType === 'appPie' && (
                        <div style={{ width: '100%', padding: '20px' }}>
                          <AppPieChart appData={appData} />
                        </div>
                      )}
                      {chartType === 'bar' && (
                        <div style={{ width: '100%', padding: '20px' }}>
                          <AppBarChart hourlyAppData={hourlyAppData} dayStartHour={dayStartHour} />
                        </div>
                      )}
                    </>
                  )}
                  
                  {viewMode === 'week' && (
                    <>
                      {chartType === 'weekHeatmap' && (
                        <WeeklyHeatmapChart 
                          hourlyActivity={weekHourlyActivity} 
                          days={weekDays} 
                          dayStartHour={dayStartHour} 
                        />
                      )}
                      {chartType === 'weekAppPie' && (
                        <div style={{ width: '100%', padding: '20px' }}>
                          <WeeklyAppPieChart weekAppTotals={weekAppTotals} />
                        </div>
                      )}
                      {chartType === 'weekBar' && (
                        <div style={{ width: '100%', padding: '20px' }}>
                          <WeeklyAppBarChart 
                            hourlyAppData={weekHourlyAppData}
                            days={weekDays}
                            weekAppTotals={weekAppTotals}
                            dayStartHour={dayStartHour}
                          />
                        </div>
                      )}
                    </>
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
              {chartDescription.timeInfo ? (
                <>
                  <p>{chartDescription.main}</p>
                  <p>{chartDescription.timeInfo}</p>
                  {chartDescription.additional && (
                    <p>{chartDescription.additional}</p>
                  )}
                </>
              ) : (
                <p>{chartDescription.main}</p>
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


