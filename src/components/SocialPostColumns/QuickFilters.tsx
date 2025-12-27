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
        whereClause = {
          assignedTo: { equals: user?.id },
        }
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
        // Clear filter
        router.push(baseUrl)
        return
    }
    
    const params = new URLSearchParams()
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
          return parsed.assignedTo?.equals === user?.id
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
    <div className="social-posts-quick-filters" style={{ 
      padding: '1rem 1.5rem',
      background: 'var(--theme-elevation-100)',
      borderBottom: '1px solid var(--theme-elevation-200)',
      display: 'flex',
      gap: '0.75rem',
      flexWrap: 'wrap',
      alignItems: 'center',
    }}>
      <span style={{
        fontSize: '0.85rem',
        fontWeight: 600,
        color: 'var(--theme-elevation-500)',
        marginRight: '0.5rem',
      }}>
        Quick Filters:
      </span>
      
      <button
        onClick={() => applyFilter('all')}
        className={`quick-filter-btn ${isActive('all') ? 'quick-filter-btn--active' : ''}`}
        style={{
          padding: '0.4rem 0.9rem',
          fontSize: '0.85rem',
          borderRadius: '4px',
          border: isActive('all') ? '2px solid var(--admin-accent-primary, #3b82f6)' : '1px solid var(--theme-elevation-300)',
          background: isActive('all') ? 'var(--admin-accent-primary, #3b82f6)' : 'var(--theme-elevation-0)',
          color: isActive('all') ? 'white' : 'var(--theme-text)',
          cursor: 'pointer',
          fontWeight: isActive('all') ? 600 : 500,
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          if (!isActive('all')) {
            e.currentTarget.style.background = 'var(--theme-elevation-200)'
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive('all')) {
            e.currentTarget.style.background = 'var(--theme-elevation-0)'
          }
        }}
      >
        📋 All Posts
      </button>
      
      <button
        onClick={() => applyFilter('my-posts')}
        className={`quick-filter-btn ${isActive('my-posts') ? 'quick-filter-btn--active' : ''}`}
        style={{
          padding: '0.4rem 0.9rem',
          fontSize: '0.85rem',
          borderRadius: '4px',
          border: isActive('my-posts') ? '2px solid var(--admin-accent-primary, #3b82f6)' : '1px solid var(--theme-elevation-300)',
          background: isActive('my-posts') ? 'var(--admin-accent-primary, #3b82f6)' : 'var(--theme-elevation-0)',
          color: isActive('my-posts') ? 'white' : 'var(--theme-text)',
          cursor: 'pointer',
          fontWeight: isActive('my-posts') ? 600 : 500,
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          if (!isActive('my-posts')) {
            e.currentTarget.style.background = 'var(--theme-elevation-200)'
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive('my-posts')) {
            e.currentTarget.style.background = 'var(--theme-elevation-0)'
          }
        }}
      >
        👤 My Posts
      </button>
      
      {isAdmin && (
        <button
          onClick={() => applyFilter('pending-approval')}
          className={`quick-filter-btn ${isActive('pending-approval') ? 'quick-filter-btn--active' : ''}`}
          style={{
            padding: '0.4rem 0.9rem',
            fontSize: '0.85rem',
            borderRadius: '4px',
            border: isActive('pending-approval') ? '2px solid var(--admin-accent-warning, #f59e0b)' : '1px solid var(--theme-elevation-300)',
            background: isActive('pending-approval') ? 'var(--admin-accent-warning, #f59e0b)' : 'var(--theme-elevation-0)',
            color: isActive('pending-approval') ? 'white' : 'var(--theme-text)',
            cursor: 'pointer',
            fontWeight: isActive('pending-approval') ? 600 : 500,
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            if (!isActive('pending-approval')) {
              e.currentTarget.style.background = 'var(--theme-elevation-200)'
            }
          }}
          onMouseLeave={(e) => {
            if (!isActive('pending-approval')) {
              e.currentTarget.style.background = 'var(--theme-elevation-0)'
            }
          }}
        >
          ⏳ Pending Approval
        </button>
      )}
      
      <button
        onClick={() => applyFilter('this-week')}
        className={`quick-filter-btn ${isActive('this-week') ? 'quick-filter-btn--active' : ''}`}
        style={{
          padding: '0.4rem 0.9rem',
          fontSize: '0.85rem',
          borderRadius: '4px',
          border: isActive('this-week') ? '2px solid var(--admin-accent-primary, #3b82f6)' : '1px solid var(--theme-elevation-300)',
          background: isActive('this-week') ? 'var(--admin-accent-primary, #3b82f6)' : 'var(--theme-elevation-0)',
          color: isActive('this-week') ? 'white' : 'var(--theme-text)',
          cursor: 'pointer',
          fontWeight: isActive('this-week') ? 600 : 500,
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          if (!isActive('this-week')) {
            e.currentTarget.style.background = 'var(--theme-elevation-200)'
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive('this-week')) {
            e.currentTarget.style.background = 'var(--theme-elevation-0)'
          }
        }}
      >
        📅 This Week
      </button>
      
      <button
        onClick={() => applyFilter('drafts')}
        className={`quick-filter-btn ${isActive('drafts') ? 'quick-filter-btn--active' : ''}`}
        style={{
          padding: '0.4rem 0.9rem',
          fontSize: '0.85rem',
          borderRadius: '4px',
          border: isActive('drafts') ? '2px solid var(--admin-accent-primary, #3b82f6)' : '1px solid var(--theme-elevation-300)',
          background: isActive('drafts') ? 'var(--admin-accent-primary, #3b82f6)' : 'var(--theme-elevation-0)',
          color: isActive('drafts') ? 'white' : 'var(--theme-text)',
          cursor: 'pointer',
          fontWeight: isActive('drafts') ? 600 : 500,
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          if (!isActive('drafts')) {
            e.currentTarget.style.background = 'var(--theme-elevation-200)'
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive('drafts')) {
            e.currentTarget.style.background = 'var(--theme-elevation-0)'
          }
        }}
      >
        📝 Drafts
      </button>
    </div>
  )
}

