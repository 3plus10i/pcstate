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
