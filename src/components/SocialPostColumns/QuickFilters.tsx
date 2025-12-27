'use client'

import React from 'react'
import { useAuth } from '@payloadcms/ui'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function QuickFilters() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  
  const isAdmin = user?.role === 'admin' || user?.role === 'staff-manager'
  const userId = user?.id || ''
  
  // Get current filter status
  const whereParam = searchParams.toString()
  const isAllActive = !whereParam.includes('where')
  const isMyPostsActive = whereParam.includes('assignedTo')
  const isPendingActive = whereParam.includes('Ready%20for%20Review') || whereParam.includes('Ready+for+Review')
  const isDraftsActive = whereParam.includes('status') && whereParam.includes('Draft')
  
  // Build filter URLs using Payload's query string array format (not JSON!)
  const buildMyPostsUrl = () => {
    return `/admin/collections/social-posts?where[or][0][and][0][assignedTo][equals]=${userId}`
  }
  
  const buildPendingApprovalUrl = () => {
    return `/admin/collections/social-posts?where[or][0][and][0][status][equals]=Ready%20for%20Review`
  }
  
  const buildDraftsUrl = () => {
    return `/admin/collections/social-posts?where[or][0][and][0][status][equals]=Draft`
  }
  
  const buildThisWeekUrl = () => {
    const now = new Date()
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())
    startOfWeek.setHours(0, 0, 0, 0)
    
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 7)
    
    return `/admin/collections/social-posts?where[or][0][and][0][scheduledDate][greater_than_equal]=${startOfWeek.toISOString()}&where[or][0][and][1][scheduledDate][less_than]=${endOfWeek.toISOString()}`
  }
  
  return (
    <div className="social-posts-quick-filters">
      <span className="social-posts-quick-filters__label">
        Quick Filters:
      </span>
      
      <Link
        href="/admin/collections/social-posts"
        className={`quick-filter-btn ${isAllActive ? 'quick-filter-btn--active' : ''}`}
      >
        📋 All Posts
      </Link>
      
      <Link
        href={buildMyPostsUrl()}
        className={`quick-filter-btn ${isMyPostsActive ? 'quick-filter-btn--active' : ''}`}
      >
        👤 My Posts
      </Link>
      
      {isAdmin && (
        <Link
          href={buildPendingApprovalUrl()}
          className={`quick-filter-btn ${isPendingActive ? 'quick-filter-btn--active' : ''}`}
        >
          ⏳ Pending Approval
        </Link>
      )}
      
      <Link
        href={buildThisWeekUrl()}
        className={`quick-filter-btn ${whereParam.includes('scheduledDate') ? 'quick-filter-btn--active' : ''}`}
      >
        📅 This Week
      </Link>
      
      <Link
        href={buildDraftsUrl()}
        className={`quick-filter-btn ${isDraftsActive ? 'quick-filter-btn--active' : ''}`}
      >
        📝 Drafts
      </Link>
    </div>
  )
}
