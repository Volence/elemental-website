'use client'

import React from 'react'
import { useAuth } from '@payloadcms/ui'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function QuickFilters() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  
  const isAdmin = user?.role === 'admin' || user?.role === 'staff-manager'
  
  // Get current filter from URL
  const currentFilter = searchParams.get('where')
  
  const applyFilter = (filterName: string) => {
    const baseUrl = window.location.pathname
    
    let whereClause: any = {}
    
    switch (filterName) {
      case 'my-posts':
        // Relationship fields in Payload use STRING IDs, not numbers!
        const userId = String(user?.id)
        console.log('[QuickFilters] My Posts filter - User ID:', userId, 'Type:', typeof userId)
        
        // Try "in" operator format - some Payload relationship queries need "in" instead of "equals"
        whereClause = {
          assignedTo: {
            in: [userId],
          },
        }
        
        console.log('[QuickFilters] Where clause ("in" operator format):', JSON.stringify(whereClause))
        break
      case 'pending-approval':
        whereClause = {
          status: { equals: 'Ready for Review' },
        }
        break
      case 'this-week':
        const now = new Date()
        const startOfWeek = new Date(now)
        startOfWeek.setDate(now.getDate() - now.getDay())
        startOfWeek.setHours(0, 0, 0, 0)
        
        const endOfWeek = new Date(startOfWeek)
        endOfWeek.setDate(startOfWeek.getDate() + 7)
        
        whereClause = {
          scheduledDate: {
            greater_than_equal: startOfWeek.toISOString(),
            less_than: endOfWeek.toISOString(),
          },
        }
        break
      case 'drafts':
        whereClause = {
          status: { equals: 'Draft' },
        }
        break
      case 'all':
      default:
        // Clear all filters - explicitly remove the where parameter
        console.log('[QuickFilters] Clearing all filters')
        const currentParams = new URLSearchParams(window.location.search)
        currentParams.delete('where')
        const newUrl = currentParams.toString() ? `${baseUrl}?${currentParams.toString()}` : baseUrl
        console.log('[QuickFilters] Navigating to:', newUrl)
        // Force full page reload to ensure Payload admin UI picks up the change
        window.location.href = newUrl
        return
    }
    
    const params = new URLSearchParams(window.location.search)
    params.set('where', JSON.stringify(whereClause))
    const newUrl = `${baseUrl}?${params.toString()}`
    console.log('[QuickFilters] Navigating to:', newUrl)
    // Force full page reload to ensure Payload admin UI picks up the filter
    window.location.href = newUrl
  }
  
  const isActive = (filterName: string) => {
    if (!currentFilter && filterName === 'all') return true
    if (!currentFilter) return false
    
    try {
      const parsed = JSON.parse(currentFilter)
      
      switch (filterName) {
        case 'my-posts':
          // Check multiple formats: simple, equals, and "in"
          const userId = String(user?.id)
          return parsed.assignedTo === userId || 
                 parsed.assignedTo?.equals === userId ||
                 (parsed.assignedTo?.in && parsed.assignedTo.in.includes(userId))
        case 'pending-approval':
          return parsed.status?.equals === 'Ready for Review'
        case 'drafts':
          return parsed.status?.equals === 'Draft'
        case 'this-week':
          return !!parsed.scheduledDate?.greater_than_equal
        default:
          return false
      }
    } catch {
      return false
    }
  }
  
  return (
    <div className="social-posts-quick-filters">
      <span className="social-posts-quick-filters__label">
        Quick Filters:
      </span>
      
      <button
        onClick={() => applyFilter('all')}
        className={`quick-filter-btn ${isActive('all') ? 'quick-filter-btn--active' : ''}`}
      >
        📋 All Posts
      </button>
      
      <button
        onClick={() => applyFilter('my-posts')}
        className={`quick-filter-btn ${isActive('my-posts') ? 'quick-filter-btn--active' : ''}`}
      >
        👤 My Posts
      </button>
      
      {isAdmin && (
        <button
          onClick={() => applyFilter('pending-approval')}
          className={`quick-filter-btn ${isActive('pending-approval') ? 'quick-filter-btn--active' : ''}`}
        >
          ⏳ Pending Approval
        </button>
      )}
      
      <button
        onClick={() => applyFilter('this-week')}
        className={`quick-filter-btn ${isActive('this-week') ? 'quick-filter-btn--active' : ''}`}
      >
        📅 This Week
      </button>
      
      <button
        onClick={() => applyFilter('drafts')}
        className={`quick-filter-btn ${isActive('drafts') ? 'quick-filter-btn--active' : ''}`}
      >
        📝 Drafts
      </button>
    </div>
  )
}

