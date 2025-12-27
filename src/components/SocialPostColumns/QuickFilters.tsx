'use client'

import React from 'react'
import { useAuth } from '@payloadcms/ui'
import { useSearchParams, useRouter } from 'next/navigation'

export default function QuickFilters() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const isAdmin = user?.role === 'admin' || user?.role === 'staff-manager'
  
  // Get current filter from URL
  const currentFilter = searchParams.get('where')
  
  const applyFilter = (filterName: string) => {
    const baseUrl = window.location.pathname
    
    let whereClause: any = {}
    
    switch (filterName) {
      case 'my-posts':
        // Ensure user ID is a number (not a string)
        const userId = Number(user?.id)
        console.log('[QuickFilters] My Posts filter - User ID:', userId, 'Type:', typeof userId)
        whereClause = {
          assignedTo: { equals: userId },
        }
        console.log('[QuickFilters] Where clause:', JSON.stringify(whereClause))
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
        router.push(newUrl)
        return
    }
    
    const params = new URLSearchParams(window.location.search)
    params.set('where', JSON.stringify(whereClause))
    router.push(`${baseUrl}?${params.toString()}`)
  }
  
  const isActive = (filterName: string) => {
    if (!currentFilter && filterName === 'all') return true
    if (!currentFilter) return false
    
    try {
      const parsed = JSON.parse(currentFilter)
      
      switch (filterName) {
        case 'my-posts':
          // Convert to number for comparison
          const userId = Number(user?.id)
          return parsed.assignedTo?.equals === userId
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

