export interface RecordItem {
  date: string
  slots: number[]
  app_hourly: Record<string, number>[]  // 原始应用数据
  window_hourly: Record<string, number>[]  // 原始窗口数据
}

export interface PcStateData {
  version: string
  day_start_hour: number
  record: RecordItem[]
}

export interface ProcessedRecord {
  slots: number[]
  appHourly: Record<string, number>[]  // 合并后的活动应用数据
  appTotals: Record<string, number>  // 基于活动应用的总时长
}

export interface ProcessedWeekRecord {
  hourlyActivity: number[][]  // 7×24矩阵，每小时的活跃分钟数(0-60)
  weekAppTotals: Record<string, number>  // 7天总应用时长
  hourlyAppData: Record<string, number>[][]  // 7×24的应用时长矩阵
  days: string[]  // 7天的日期字符串
}

interface DayRecord {
  date: string
  slots?: number[]
  app_hourly?: Record<string, number>[]
  window_hourly?: Record<string, number>[]
}

function removeExeSuffix(appName: string): string {
  if (appName && appName.toLowerCase().endsWith('.exe')) {
    return appName.slice(0, -4)
  }
  return appName
}

function processAppNames(data: Record<string, number>): Record<string, number> {
  const processed: Record<string, number> = {}
  Object.entries(data).forEach(([appName, value]) => {
    const cleanName = removeExeSuffix(appName)
    processed[cleanName] = (processed[cleanName] || 0) + value
  })
  return processed
}

function processHourlyData(data: Record<string, number>[]): Record<string, number>[] {
  return data.map(hourData => processAppNames(hourData))
}

/**
 * 合并应用名和窗口标题为活动应用
 * 规则：如果进程名为空或未知，则使用窗口标题
 */
function mergeAppAndWindowNames(appData: Record<string, number>, windowData: Record<string, number>): Record<string, number> {
  const merged: Record<string, number> = { ...appData }
  
  // 遍历窗口数据，如果对应的应用名为空或未知，则使用窗口标题
  Object.entries(windowData).forEach(([windowName, value]) => {
    const cleanWindowName = removeExeSuffix(windowName)
    
    // 如果窗口标题有意义且应用名为空或未知，使用窗口标题
    if (cleanWindowName && cleanWindowName !== '未知' && cleanWindowName.trim() !== '') {
      // 查找是否有对应的应用名（可能需要模糊匹配）
      let hasApp = false
      
      // 检查是否有非空、非未知的应用名
      Object.keys(appData).forEach(appName => {
        if (appName && appName !== '未知' && appName.trim() !== '') {
          hasApp = true
        }
      })
      
      // 如果没有有效的应用名，使用窗口标题
      if (!hasApp) {
        merged[cleanWindowName] = (merged[cleanWindowName] || 0) + value
      }
    }
  })
  
  return merged
}

/**
 * 逐小时合并应用和窗口数据
 */
function mergeHourlyData(appHourly: Record<string, number>[], windowHourly: Record<string, number>[]): Record<string, number>[] {
  const merged: Record<string, number>[] = []
  
  for (let i = 0; i < Math.max(appHourly.length, windowHourly.length); i++) {
    const appData = appHourly[i] || {}
    const windowData = windowHourly[i] || {}
    merged.push(mergeAppAndWindowNames(appData, windowData))
  }
  
  return merged
}

function formatDateToYYYYMMDD(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

function calculateAppTotals(appHourly: Record<string, number>[]): Record<string, number> {
  const totals: Record<string, number> = {}
  appHourly.forEach(hourData => {
    Object.entries(hourData).forEach(([app, minutes]) => {
      totals[app] = (totals[app] || 0) + minutes
    })
  })
  return processAppNames(totals)
}

export function getProcessedRecord(data: PcStateData, date: Date): ProcessedRecord {
  const dayStartHour = data.day_start_hour || 0
  
  // 1. 找到D日的记录
  const dateStr = formatDateToYYYYMMDD(date)
  const currentRecord = data.record.find(r => r.date === dateStr)
  
  // 2. 构造D+1日的日期字符串（D的次日）
  const dPlus1Date = new Date(date)
  dPlus1Date.setDate(dPlus1Date.getDate() + 1)
  const dPlus1DateStr = formatDateToYYYYMMDD(dPlus1Date)
  
  // 3. 找到D+1日的记录
  const dPlus1Record = data.record.find(r => r.date === dPlus1DateStr)
  
  // 4. 取D日的dayStartHour:00-24:00（例如4:00-24:00）
  const part1Start = dayStartHour * 12
  const part1Slots = currentRecord?.slots?.slice(part1Start, 288) || new Array(288 - part1Start).fill(0)
  const part1AppHourly = (currentRecord?.app_hourly || []).slice(dayStartHour, 24)
  const part1WindowHourly = (currentRecord?.window_hourly || []).slice(dayStartHour, 24)
  
  // 5. 取D+1日的0:00-dayStartHour:00（例如0:00-4:00）
  const part2End = dayStartHour * 12
  const part2Slots = dPlus1Record?.slots?.slice(0, part2End) || new Array(part2End).fill(0)
  const part2AppHourly = (dPlus1Record?.app_hourly || []).slice(0, dayStartHour)
  const part2WindowHourly = (dPlus1Record?.window_hourly || []).slice(0, dayStartHour)
  
  // 6. 拼接数据
  const slots = [...part1Slots, ...part2Slots]
  const appHourlyRaw = [...part1AppHourly, ...part2AppHourly]
  const windowHourlyRaw = [...part1WindowHourly, ...part2WindowHourly]
  
  // 7. 处理应用名（去掉.exe后缀）
  const appHourly = processHourlyData(appHourlyRaw)
  const windowHourly = processHourlyData(windowHourlyRaw)
  
  // 8. 合并应用和窗口数据为活动应用
  // 规则：如果进程名为空或未知，则使用窗口标题
  const mergedAppHourly = mergeHourlyData(appHourly, windowHourly)
  const appTotals = calculateAppTotals(mergedAppHourly)

  return {
    slots,
    appHourly: mergedAppHourly,  // 使用合并后的数据
    appTotals
  }
}



export function getDateInfo(date: Date | string): string {
  const dateStr = typeof date === 'string' ? date : formatDateToYYYYMMDD(date)
  const normalized = dateStr.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3')
  const d = new Date(normalized + 'T00:00:00')

  if (isNaN(d.getTime())) {
    return dateStr
  }

  const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  const weekDay = weekDays[d.getDay()]

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${weekDay}`
}

export function formatDate(dateStr: string): string {
  const weekDays = ['日', '一', '二', '三', '四', '五', '六']
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth() + 1}/${d.getDate()}(${weekDays[d.getDay()]})`
}

export function formatDuration(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return `${h}h${m}m`
  }
  return `${minutes}min`
}

function getHourlyActivityFromSlots(slots: number[], dayStartHour: number): number[] {
  // slots是288个槽位（每5分钟一个），值0-5
  // 需要转换为24小时的活跃分钟数（0-60）
  const hourlyActivity = new Array(24).fill(0)
  
  for (let hour = 0; hour < 24; hour++) {
    const slotStart = hour * 12
    const slotEnd = (hour + 1) * 12
    let totalActivity = 0
    
    for (let slot = slotStart; slot < slotEnd && slot < slots.length; slot++) {
      // 每个槽位最多5次活跃，每次5分钟，所以最大25分钟
      // 为了归一化到0-60分钟，乘以5
      totalActivity += (slots[slot] || 0) * 5
    }
    
    hourlyActivity[hour] = Math.min(totalActivity, 60)
  }
  
  return hourlyActivity
}

function getDayRecord(data: PcStateData, date: Date): DayRecord | null {
  const dateStr = formatDateToYYYYMMDD(date)
  const record = data.record.find(r => r.date === dateStr)
  return record || null
}

function getAdjustedHourlyData(record: DayRecord | null, dayStartHour: number): Record<string, number>[] {
  if (!record) return new Array(24).fill({})
  
  // 处理应用和窗口数据
  const appHourly = processHourlyData(record.app_hourly || [])
  const windowHourly = processHourlyData(record.window_hourly || [])
  const merged = mergeHourlyData(appHourly, windowHourly)
  
  // 如果dayStartHour > 0，需要调整数据顺序
  if (dayStartHour > 0) {
    const adjusted = [...merged.slice(dayStartHour), ...merged.slice(0, dayStartHour)]
    return adjusted
  }
  
  return merged
}

export function getProcessedWeekRecord(data: PcStateData, endDate: Date): ProcessedWeekRecord {
  const dayStartHour = data.day_start_hour || 0
  const days: string[] = []
  const hourlyActivity: number[][] = []  // 7×24矩阵
  const hourlyAppData: Record<string, number>[][] = []  // 7×24的应用数据
  const appTotals: Record<string, number> = {}
  
  // 计算7天的数据（D-6到D）
  for (let i = 6; i >= 0; i--) {
    const currentDate = new Date(endDate)
    currentDate.setDate(currentDate.getDate() - i)
    
    const dateStr = formatDateToYYYYMMDD(currentDate)
    days.push(dateStr)
    
    const record = getDayRecord(data, currentDate)
    
    // 1. 计算每小时的活跃度
    const slots = record?.slots || new Array(288).fill(0)
    const dayHourlyActivity = getHourlyActivityFromSlots(slots, dayStartHour)
    hourlyActivity.push(dayHourlyActivity)
    
    // 2. 获取每小时的应用数据
    const dayHourlyApps = getAdjustedHourlyData(record, dayStartHour)
    hourlyAppData.push(dayHourlyApps)
    
    // 3. 累加应用总时长
    dayHourlyApps.forEach(hourData => {
      Object.entries(hourData).forEach(([app, minutes]) => {
        appTotals[app] = (appTotals[app] || 0) + minutes
      })
    })
  }
  
  // 处理占比<5%的应用，合并为"其他"
  const totalMinutes = Object.values(appTotals).reduce((sum, m) => sum + m, 0)
  const weekAppTotals: Record<string, number> = {}
  let otherMinutes = 0
  
  Object.entries(appTotals).forEach(([app, minutes]) => {
    const percentage = totalMinutes > 0 ? minutes / totalMinutes : 0
    if (percentage < 0.05) {
      otherMinutes += minutes
    } else {
      weekAppTotals[app] = minutes
    }
  })
  
  if (otherMinutes > 0) {
    weekAppTotals['其他'] = otherMinutes
  }
  
  return {
    hourlyActivity,
    weekAppTotals,
    hourlyAppData,
    days
  }
}

export function mergeSmallApps(hourlyData: Record<string, number>[], appTotals: Record<string, number>): Record<string, number>[] {
  const totalMinutes = Object.values(appTotals).reduce((sum, m) => sum + m, 0)
  const smallApps = new Set<string>()
  
  // 找出占比<5%的应用
  Object.entries(appTotals).forEach(([app, minutes]) => {
    const percentage = totalMinutes > 0 ? minutes / totalMinutes : 0
    if (percentage < 0.05) {
      smallApps.add(app)
    }
  })
  
  // 合并小应用
  return hourlyData.map(hourData => {
    const merged: Record<string, number> = {}
    let otherMinutes = 0
    
    Object.entries(hourData).forEach(([app, minutes]) => {
      if (smallApps.has(app)) {
        otherMinutes += minutes
      } else {
        merged[app] = minutes
      }
    })
    
    if (otherMinutes > 0) {
      merged['其他'] = (merged['其他'] || 0) + otherMinutes
    }
    
    return merged
  })
}
