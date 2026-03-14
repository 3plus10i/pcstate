// src/hooks/useReportState.ts
import { useState, useMemo, useCallback } from 'react'
import { getSlotValue, getDateInfo, PcStateData } from '../dataProcessor'

type ViewMode = 'day' | 'week' | 'month'
type ChartType = 'mosaic' | 'appPie' | 'appStack' | 'windowStack'

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
  processedData: ReturnType<typeof getSlotValue> | null
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
  const [chartType, setChartType] = useState<ChartType>('mosaic')
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())

  // 2. 派生数据：图表数据
  const processedData = useMemo(() => {
    if (!pcStateData) return null
    return getSlotValue(pcStateData, selectedDate)
  }, [pcStateData, selectedDate])

  // 3. 派生数据：活跃时间统计
  const { activeSlots, activeMinutes, activeHours, activeMins } = useMemo(() => {
    const slots = processedData?.slots || []
    const activeSlots = slots.filter(v => v > 0).length
    const activeMinutes = activeSlots * 5
    const activeHours = Math.floor(activeMinutes / 60)
    const activeMins = activeMinutes % 60
    return { activeSlots, activeMinutes, activeHours, activeMins }
  }, [processedData])

  // 4. 派生数据：图标题
  const chartTitle = useMemo(() => {
    const chartTypeName = {
      mosaic: '马赛克图',
      appPie: '应用时长饼图',
      appStack: '应用时长堆叠柱状图',
      windowStack: '窗口时长堆叠柱状图'
    }[chartType]
    
    return `${getDateInfo(selectedDate)} - ${chartTypeName}`
  }, [selectedDate, chartType])

  // 5. 派生数据：图说明
  const chartDescription = useMemo((): ChartDescription => {
    const hasData = activeSlots > 0
    
    if (!hasData) {
      return {
        main: '暂无数据记录，请稍后再试。'
      }
    }

    const timeInfo = activeHours === 0
      ? `活跃时间${activeMins}分钟`
      : `活跃时间${activeHours}小时${activeMins}分钟`

    switch (chartType) {
      case 'mosaic':
        return {
          main: '活跃马赛克图：每个小格表示5分钟，格子颜色越深表示越繁忙。',
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
      
      case 'appStack':
        return {
          main: '应用时长堆叠柱状图：显示每个小时内不同应用的活跃时长，堆叠显示便于对比。每小时内显示时长前5的应用，其余合并到"其他"。',
          timeInfo
        }
      
      case 'windowStack':
        return {
          main: '窗口时长堆叠柱状图：显示每个小时内不同窗口的活跃时长，堆叠显示便于对比。',
          timeInfo
        }
    }
  }, [chartType, activeSlots, activeHours, activeMins, pcStateData.day_start_hour])

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
