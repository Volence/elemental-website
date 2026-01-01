import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { logError } from '@/utilities/errorLogger'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

/**
 * Error Harvesting Cron Job
 * 
 * This job reads Payload logs and creates error entries in the Error Dashboard
 * for any errors that occurred. This catches database errors, API errors, and
 * any other errors that Payload logs.
 * 
 * Schedule: Run every 5 minutes
 */

interface ParsedError {
  message: string
  timestamp: string
  type: 'database' | 'api' | 'system' | 'backend'
  stack?: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  userId?: string | number
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const payload = await getPayload({ config: await configPromise })

    // Get the last checked time to avoid re-processing
    const state = await payload.findGlobal({
      slug: 'error-harvester-state',
    })

    const lastCheckedAt = state.lastCheckedAt ? new Date(state.lastCheckedAt) : null
    const now = new Date()

    // Calculate how long to look back (default to 5 minutes, or since last check)
    let lookbackMinutes = 5
    if (lastCheckedAt) {
      const minutesSinceLastCheck = Math.floor((now.getTime() - lastCheckedAt.getTime()) / 60000)
      // Add 1 minute buffer to ensure we don't miss anything
      lookbackMinutes = Math.min(minutesSinceLastCheck + 1, 10) // Max 10 minutes
    }

    // Get logs since last check (or last 5 minutes)
    // Note: In production, you'd read from a logging service or log files
    // For Docker, we can read from docker compose logs
    const { stdout } = await execAsync(
      `docker compose logs --since ${lookbackMinutes}m payload 2>&1 | grep -E "\\[ERROR\\]|error:|Error:" | tail -100`
    )

    const logLines = stdout.split('\n').filter(line => line.trim())
    
    if (logLines.length === 0) {
      // Update the last checked time even when no errors found
      await payload.updateGlobal({
        slug: 'error-harvester-state',
        data: {
          lastCheckedAt: now.toISOString(),
          lastRunErrors: 0,
          totalRunCount: (state.totalRunCount || 0) + 1,
        },
      })
      
      return NextResponse.json({
        success: true,
        message: 'No errors found in logs',
        errorsProcessed: 0,
      })
    }

    const errors = parseErrors(logLines)
    let created = 0

    // Create error entries for EACH occurrence
    // The Error Dashboard will group them and show counts + affected users
    for (const error of errors) {
      // Create the error log entry for each occurrence
      await logError(payload, {
        errorType: error.type,
        message: error.message,
        stack: error.stack,
        severity: error.severity,
        user: error.userId, // Include user if we can extract it
      })
      
      created++
    }

    // Update the last checked time
    await payload.updateGlobal({
      slug: 'error-harvester-state',
      data: {
        lastCheckedAt: now.toISOString(),
        lastRunErrors: created,
        totalRunCount: (state.totalRunCount || 0) + 1,
      },
    })

    return NextResponse.json({
      success: true,
      message: `Harvested ${created} error occurrence(s) from logs`,
      errorsCreated: created,
      totalErrorsFound: errors.length,
      lookbackMinutes,
      lastCheckedAt: now.toISOString(),
      previousCheckAt: lastCheckedAt?.toISOString() || 'never',
      totalRuns: (state.totalRunCount || 0) + 1,
      note: 'Error Dashboard will group identical errors and show counts + affected users',
    })

  } catch (error: any) {
    console.error('[Error Harvester] Failed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to harvest errors',
      },
      { status: 500 }
    )
  }
}

function parseErrors(logLines: string[]): ParsedError[] {
  const errors: ParsedError[] = []
  let currentError: ParsedError | null = null
  let collectingStack = false

  for (const line of logLines) {
    // Skip empty lines
    if (!line.trim()) continue

    // Detect ERROR level logs
    if (line.includes('[ERROR]') || line.includes('ERROR:')) {
      // Save previous error if exists
      if (currentError) {
        errors.push(currentError)
      }

      // Extract error message
      const message = extractErrorMessage(line)
      
      currentError = {
        message,
        timestamp: extractTimestamp(line),
        type: categorizeError(message),
        severity: determineSeverity(message),
        stack: '',
      }
      collectingStack = true
    } 
    // Collect stack trace lines
    else if (collectingStack && (line.includes('    at ') || line.includes('Error:'))) {
      if (currentError) {
        currentError.stack = (currentError.stack || '') + line + '\n'
      }
    }
    // Stop collecting stack when we hit a non-stack line
    else if (collectingStack && !line.includes('    at ')) {
      collectingStack = false
    }
  }

  // Push the last error
  if (currentError) {
    errors.push(currentError)
  }

  return errors
}

function extractErrorMessage(line: string): string {
  // Try to extract message after [ERROR]: or ERROR:
  let message = line

  if (line.includes('[ERROR]')) {
    message = line.split('[ERROR]')[1] || line
  } else if (line.includes('ERROR:')) {
    message = line.split('ERROR:')[1] || line
  }

  // Clean up ANSI color codes
  message = message.replace(/\[\d+m/g, '').trim()

  // Limit message length
  if (message.length > 500) {
    message = message.substring(0, 500) + '...'
  }

  return message
}

function extractTimestamp(line: string): string {
  // Try to extract timestamp from log line
  const timestampMatch = line.match(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/)
  return timestampMatch ? timestampMatch[0] : new Date().toISOString()
}

function categorizeError(message: string): 'database' | 'api' | 'system' | 'backend' {
  const lowerMessage = message.toLowerCase()
  
  if (lowerMessage.includes('database') || 
      lowerMessage.includes('query') || 
      lowerMessage.includes('sql') ||
      lowerMessage.includes('postgres') ||
      lowerMessage.includes('drizzle')) {
    return 'database'
  }
  
  if (lowerMessage.includes('api') || 
      lowerMessage.includes('request') || 
      lowerMessage.includes('endpoint') ||
      lowerMessage.includes('route')) {
    return 'api'
  }
  
  return 'system'
}

function determineSeverity(message: string): 'critical' | 'high' | 'medium' | 'low' {
  const lowerMessage = message.toLowerCase()
  
  if (lowerMessage.includes('critical') || 
      lowerMessage.includes('fatal') ||
      lowerMessage.includes('cannot connect')) {
    return 'critical'
  }
  
  if (lowerMessage.includes('failed') || 
      lowerMessage.includes('error deleting') ||
      lowerMessage.includes('error updating') ||
      lowerMessage.includes('transaction')) {
    return 'high'
  }
  
  if (lowerMessage.includes('warning') || lowerMessage.includes('deprecated')) {
    return 'low'
  }
  
  return 'medium'
}

