'use client'

import React from 'react'
import { useAuth } from '@payloadcms/ui'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function QuickFilters() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  
  const isAdmin = user?.role === 'admin' || user?.role === 'staff-manager'
  
  // Get current filter status
  const whereParam = searchParams.get('where')
  const isAllActive = !whereParam
  
  // Helper to build filter URL
  const buildFilterUrl = (where: any) => {
    return `/admin/collections/social-posts?where=${encodeURIComponent(JSON.stringify(where))}`
  }
  
  return (
    <div className="social-posts-quick-filters">
      <span className="social-posts-quick-filters__label">
        Quick Filters:
      </span>
      
      {/* All Posts */}
      <Link
        href="/admin/collections/social-posts"
        className={`quick-filter-btn ${isAllActive ? 'quick-filter-btn--active' : ''}`}
      >
        📋 All Posts
      </Link>
      
      {/* Note about My Posts */}
      <div style={{
        marginLeft: '1rem',
        padding: '0.5rem 1rem',
        background: 'rgba(59, 130, 246, 0.1)',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        borderRadius: '4px',
        fontSize: '0.85rem',
        color: 'var(--theme-text)',
      }}>
        💡 <strong>Tip:</strong> Use the <strong>"Filters"</strong> button above to filter by Assigned To, Status, Date, etc.
      </div>
    </div>
  )
}
