declare module '../../data' {
  export interface RecordItem {
    date: string
    slots: number[]
    app_hourly: Record<string, number>[]
    window_hourly: Record<string, number>[]
  }

  export interface PcStateData {
    version: string
    day_start_hour: number
    record: RecordItem[]
  }

  export const PCSTATE_DATA: PcStateData
}
