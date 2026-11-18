import { config } from '../config'
export type Usage = { day: string; used: number }
export const localDay = (d = new Date()) =>
  [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0')
  ].join('-')
export function daily(usage?: Usage, date = new Date()): Usage {
  const day = localDay(date)
  return usage?.day === day ? usage : { day, used: 0 }
}
export const remaining = (usage?: Usage) =>
  Math.max(0, config.dailyLimit - daily(usage).used)
