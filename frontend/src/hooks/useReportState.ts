// src/hooks/useReportState.ts
import { useState, useMemo, useCallback } from 'react'
import { getProcessedRecord, getProcessedWeekRecord, getDateInfo, PcStateData, mergeSmallApps } from '../dataProcessor'

type ViewMode = 'day' | 'week' | 'month'
type ChartType = 'heatmap' | 'appPie' | 'bar' | 'weekHeatmap' | 'weekAppPie' | 'weekBar'

interface ChartDescription {
  main: string
  timeInfo?: string
  additional?: string
}

interface ReportState {
  // 原始状态
  viewMode: ViewMode
  chartType: ChartType
  selectedDate: Date
  
  // 派生数据（计算得到）
  processedData: ReturnType<typeof getProcessedRecord> | null
  processedWeekData: ReturnType<typeof getProcessedWeekRecord> | null
  chartTitle: string
  chartDescription: ChartDescription
  
  // 操作方法
  setViewMode: (mode: ViewMode) => void
  setChartType: (type: ChartType) => void
  setSelectedDate: (date: Date) => void
  goPrevDate: () => void
  goNextDate: () => void
}

export function useReportState(pcStateData: PcStateData): ReportState {
  // 1. 基础状态
  const [viewMode, setViewMode] = useState<ViewMode>('day')
  const [chartType, setChartType] = useState<ChartType>('heatmap')
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())

  // 2. 派生数据：图表数据
  const processedData = useMemo(() => {
    if (!pcStateData || viewMode !== 'day') return null
    return getProcessedRecord(pcStateData, selectedDate)
  }, [pcStateData, selectedDate, viewMode])

  // 3. 派生数据：周图表数据
  const processedWeekData = useMemo(() => {
    if (!pcStateData || viewMode !== 'week') return null
    return getProcessedWeekRecord(pcStateData, selectedDate)
  }, [pcStateData, selectedDate, viewMode])

  // 4. 派生数据：活跃时间统计
  const { activeSlots, activeMinutes, activeHours, activeMins } = useMemo(() => {
    if (viewMode === 'week') {
      // 周视图的活跃时间统计
      const activity = processedWeekData?.hourlyActivity || []
      const totalMinutes = activity.reduce((sum, day) => sum + day.reduce((dSum, h) => dSum + h, 0), 0)
      const hours = Math.floor(totalMinutes / 60)
      const mins = totalMinutes % 60
      return {
        activeSlots: 0,
        activeMinutes: totalMinutes,
        activeHours: hours,
        activeMins: mins
      }
    }
    
    const slots = processedData?.slots || []
    const activeSlots = slots.filter(v => v > 0).length
    const activeMinutes = activeSlots * 5
    const activeHours = Math.floor(activeMinutes / 60)
    const activeMins = activeMinutes % 60
    return { activeSlots, activeMinutes, activeHours, activeMins }
  }, [processedData, processedWeekData, viewMode])

  // 5. 派生数据：图标题
  const chartTitle = useMemo(() => {
    let chartTypeName: string
    
    if (viewMode === 'day') {
      chartTypeName = {
        heatmap: '热力图',
        appPie: '应用时长饼图',
        bar: '应用时长柱状图'
      }[chartType]
      return `${getDateInfo(selectedDate)} - ${chartTypeName}`
    } else if (viewMode === 'week') {
      chartTypeName = {
        weekHeatmap: '周热力图',
        weekAppPie: '周应用时长饼图',
        weekBar: '周应用时长柱状图'
      }[chartType]
      
      const startDate = new Date(selectedDate)
      startDate.setDate(startDate.getDate() - 6)
      const endDateStr = getDateInfo(selectedDate)
      const startDateStr = getDateInfo(startDate)
      return `${startDateStr} ~ ${endDateStr} - ${chartTypeName}`
    }
    
    return getDateInfo(selectedDate)
  }, [selectedDate, chartType, viewMode])

  // 6. 派生数据：图说明
  const chartDescription = useMemo((): ChartDescription => {
    const hasData = viewMode === 'week' 
      ? (processedWeekData?.hourlyActivity?.some(day => day.some(h => h > 0)) || false)
      : (activeSlots > 0)
    
    if (!hasData) {
      return {
        main: '暂无数据记录，请稍后再试。'
      }
    }

    const timeInfo = activeHours === 0
      ? `活跃时间${activeMins}分钟`
      : `活跃时间${activeHours}小时${activeMins}分钟`

    if (viewMode === 'day') {
      switch (chartType) {
        case 'heatmap':
          return {
            main: '活跃热力图：每个小格表示5分钟，格子颜色越深表示越繁忙。',
            timeInfo: `${timeInfo}，已点亮${activeSlots}个小格`,
            additional: pcStateData.day_start_hour > 0 
              ? `当前一天起始时间：凌晨${pcStateData.day_start_hour}时（带*号表示次日时间）`
              : undefined
          }
        
        case 'appPie':
          return {
            main: '应用时长饼图：展示不同应用的活跃时长占比，5%以上有图例，5%以下合并到"其他"。',
            timeInfo
          }
        
        case 'bar':
          return {
            main: '应用时长柱状图：显示每个小时内不同应用的活跃时长，便于对比。每小时内显示时长前5的应用，其余合并到"其他"。',
            timeInfo
          }
      }
    } else if (viewMode === 'week') {
      const startDate = new Date(selectedDate)
      startDate.setDate(startDate.getDate() - 6)
      const dateRange = `${getDateInfo(startDate)} ~ ${getDateInfo(selectedDate)}`
      
      switch (chartType) {
        case 'weekHeatmap':
          return {
            main: `周活跃热力图：显示${dateRange}期间每小时的活跃度（0-60分钟），颜色越深表示越活跃。`,
            timeInfo
          }
        
        case 'weekAppPie':
          return {
            main: `周活跃应用时长饼图：展示${dateRange}期间不同应用的活跃时长总占比，5%以下合并到"其他"。`,
            timeInfo
          }
        
        case 'weekBar':
          return {
            main: `周活跃应用时长柱状图：显示${dateRange}期间每天的应用活跃时长堆叠情况，便于对比每日使用模式。`,
            timeInfo
          }
      }
    }
    
    return { main: '' }
  }, [chartType, viewMode, activeSlots, activeHours, activeMins, pcStateData.day_start_hour, processedWeekData, selectedDate])

  // 6. 操作方法：日期导航
  const goPrevDate = useCallback(() => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() - 1)
    setSelectedDate(newDate)
  }, [selectedDate])

  const goNextDate = useCallback(() => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() + 1)
    setSelectedDate(newDate)
  }, [selectedDate])

  return {
    // 状态
    viewMode,
    chartType,
    selectedDate,
    
    // 派生数据
    processedData,
    processedWeekData,
    chartTitle,
    chartDescription,
    
    // 操作方法
    setViewMode,
    setChartType,
    setSelectedDate,
    goPrevDate,
    goNextDate
  }
}
