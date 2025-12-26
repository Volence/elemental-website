/**
 * Date and Time Formatting Utilities
 * 
 * Centralized utilities for consistent date/time formatting across the application.
 * Uses Intl.DateTimeFormat for locale-aware formatting.
 */

/**
 * Format date as MM/DD/YYYY
 * @param timestamp - Date string or Date object
 * @returns Formatted date string (e.g., "12/21/2025")
 */
export const formatDateTime = (timestamp: string | Date): string => {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp
  const MM = String(date.getMonth() + 1).padStart(2, '0')
  const DD = String(date.getDate()).padStart(2, '0')
  const YYYY = date.getFullYear()
  return `${MM}/${DD}/${YYYY}`
}

/**
 * Format date as "Monday, December 21"
 * @param date - Date object or string
 * @returns Formatted date string
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(d)
}

/**
 * Format time as "3:30 PM"
 * @param date - Date object or string
 * @returns Formatted time string
 */
export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d)
}

/**
 * Convert date to EST timezone and format
 * @param date - Date object or string
 * @returns Time string with EST suffix (e.g., "3:30 PM EST")
 */
export function convertToEST(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const timeString = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/New_York',
  }).format(d)
  return `${timeString} EST`
}

/**
 * Convert date to CET timezone and format
 * @param date - Date object or string
 * @returns Time string with CET suffix (e.g., "9:30 PM CET")
 */
export function convertToCET(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const timeString = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Europe/Berlin',
  }).format(d)
  return `${timeString} CET`
}

/**
 * Format date and time in the user's local timezone with timezone abbreviation
 * @param date - Date object or string
 * @param options - Optional formatting options
 * @returns Formatted date/time string (e.g., "Mon, Dec 25, 3:00 PM EST")
 */
export function formatLocalDateTime(
  date: Date | string,
  options?: {
    includeDate?: boolean
    includeTime?: boolean
    includeTimezone?: boolean
    short?: boolean
  }
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const {
    includeDate = true,
    includeTime = true,
    includeTimezone = true,
    short = false,
  } = options || {}

  const dateOptions: Intl.DateTimeFormatOptions = {}

  if (includeDate) {
    dateOptions.weekday = short ? 'short' : 'short'
    dateOptions.month = short ? 'short' : 'short'
    dateOptions.day = 'numeric'
  }

  if (includeTime) {
    dateOptions.hour = 'numeric'
    dateOptions.minute = '2-digit'
    dateOptions.hour12 = true
  }

  if (includeTimezone && includeTime) {
    dateOptions.timeZoneName = 'short'
  }

  return new Intl.DateTimeFormat('en-US', dateOptions).format(d)
}

/**
 * Format time only in the user's local timezone
 * @param date - Date object or string
 * @returns Time string with timezone (e.g., "3:00 PM EST")
 */
export function formatLocalTime(date: Date | string): string {
  return formatLocalDateTime(date, { includeDate: false, includeTime: true, includeTimezone: true })
}

/**
 * Format date only in the user's local timezone
 * @param date - Date object or string
 * @returns Date string (e.g., "Mon, Dec 25")
 */
export function formatLocalDate(date: Date | string): string {
  return formatLocalDateTime(date, { includeDate: true, includeTime: false, includeTimezone: false })
}

/**
 * Get the start and end of the week for a given date
 * Week starts on Monday
 * @param date - Date to get week range for (defaults to today)
 * @returns Object with startOfWeek and endOfWeek dates
 */
export function getWeekRange(date: Date = new Date()): { startOfWeek: Date; endOfWeek: Date } {
  const startOfWeek = new Date(date)
  const day = startOfWeek.getDay()
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1) // Adjust to Monday
  startOfWeek.setDate(diff)
  startOfWeek.setHours(0, 0, 0, 0)

  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6)
  endOfWeek.setHours(23, 59, 59, 999)

  return { startOfWeek, endOfWeek }
}
