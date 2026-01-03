'use client'

import React, { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useAdminUser } from '@/utilities/adminAuth'
import { UserRole } from '@/access/roles'

/**
 * Component that marks read-only items in list views and navigation
 * based on user permissions. Styling is handled by _read-only-items.scss
 * 
 * This component:
 * - Marks navigation links as read-only for collections user can't access
 * - Marks list rows as read-only based on user role and assigned teams
 * - Uses MutationObserver to watch for DOM changes (pagination, filtering, etc.)
 */
const ReadOnlyStyles: React.FC = () => {
  const user = useAdminUser()
  const pathname = usePathname()
  
  useEffect(() => {
    if (!user) return
    
    // Admins can edit everything - remove any markers
    if (user.role === UserRole.ADMIN) {
      document.querySelectorAll('[data-read-only="true"]').forEach(el => {
        el.removeAttribute('data-read-only')
      })
      document.querySelectorAll('[data-read-only-nav="true"]').forEach(el => {
        el.removeAttribute('data-read-only-nav')
      })
      return
    }
    
    /**
     * Mark navigation links as read-only based on user permissions
     */
    const markNavigationLinks = () => {
      const navLinks = document.querySelectorAll(
        'nav a[href*="/admin/collections/"], nav a[href*="/admin/globals/"], [data-payload-nav-link] a, aside a[href*="/admin/"]'
      )
      
      navLinks.forEach((link) => {
        const href = link.getAttribute('href') || ''
        const linkText = link.textContent?.toLowerCase() || ''
        
        // Check Organization Staff and Production collections
        const isOrgStaff = href.includes('/organization-staff') || linkText.includes('organization staff')
        const isProduction = href.includes('/production') || linkText.includes('production staff')
        
        if (isOrgStaff || isProduction) {
          // Only Staff Managers and Admins can access staff collections
          if (user.role !== UserRole.STAFF_MANAGER) {
            link.setAttribute('data-read-only-nav', 'true')
          } else {
            link.removeAttribute('data-read-only-nav')
          }
        } else {
          // Remove marker for other links (they're accessible)
          link.removeAttribute('data-read-only-nav')
        }
      })
    }
    
    /**
     * Extract item ID from a table row
     */
    const getRowItemId = (row: Element): string | null => {
      // Try to get ID from link href (most reliable)
      const link = row.querySelector('a[href*="/edit/"], a[href*="/teams/"], a[href*="/organization-staff/"], a[href*="/production/"]')
      if (link) {
        const href = link.getAttribute('href') || ''
        const match = href.match(/\/(\d+)(?:\/|$)/)
        if (match) return match[1]
      }
      
      // Try data attributes
      let itemId = row.getAttribute('data-row-id')
      if (itemId) return itemId
      
      // Try ID cell
      const idCell = row.querySelector('[data-payload-cell="id"]')
      if (idCell?.textContent) return idCell.textContent.trim()
      
      // Try row ID/data-id
      return (row as HTMLElement).id || row.getAttribute('data-id')
    }
    
    /**
     * Check if user can edit an item based on role and collection
     */
    const canEditItem = (itemId: string, collection: 'teams' | 'organization-staff' | 'production'): boolean => {
      if (collection === 'teams' && user.role === UserRole.TEAM_MANAGER) {
        // Team managers can only edit their assigned teams
        const assignedTeams = user.assignedTeams
        if (!assignedTeams || !Array.isArray(assignedTeams) || assignedTeams.length === 0) {
          return false
        }
        
        const teamIds = assignedTeams
          .map((team: any) => {
            if (typeof team === 'number') return team
            if (typeof team === 'object' && team !== null) return team.id || team
            return Number(team) || team
          })
          .filter((id): id is number => typeof id === 'number')
        
        return teamIds.includes(Number(itemId))
      }
      
      if ((collection === 'organization-staff' || collection === 'production') && user.role === UserRole.STAFF_MANAGER) {
        // Staff managers can edit all staff entries
        return true
      }
      
      return false
    }
    
    /**
     * Mark list rows as read-only based on permissions
     */
    const markReadOnlyItems = () => {
      const currentPath = window.location.pathname
      
      // Determine which collection we're viewing
      let collection: 'teams' | 'organization-staff' | 'production' | null = null
      if (currentPath?.includes('/teams')) collection = 'teams'
      else if (currentPath?.includes('/organization-staff')) collection = 'organization-staff'
      else if (currentPath?.includes('/production')) collection = 'production'
      
      if (!collection) {
        // Not on a list page, clear any markers
        document.querySelectorAll('[data-read-only="true"]').forEach(el => {
          el.removeAttribute('data-read-only')
        })
        return
      }
      
      // Find table rows
      const tableBody = document.querySelector('table tbody')
      if (!tableBody) return
      
      const rows = tableBody.querySelectorAll('tr:not(:first-child)')
      if (rows.length === 0) return
      
      // Process each row
      rows.forEach((row) => {
        const itemId = getRowItemId(row)
        if (!itemId) return // Skip rows without IDs
        
        const canEdit = canEditItem(itemId, collection)
        
        if (!canEdit) {
          row.setAttribute('data-read-only', 'true')
        } else {
          row.removeAttribute('data-read-only')
        }
      })
    }
    
    // Mark navigation links immediately
    markNavigationLinks()
    
    // Debounce function to limit how often we check
    let debounceTimer: NodeJS.Timeout | null = null
    let isProcessing = false
    
    const debouncedMarkItems = () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      
      debounceTimer = setTimeout(() => {
        if (!isProcessing) {
          isProcessing = true
          markReadOnlyItems()
          markNavigationLinks()
          isProcessing = false
        }
      }, 500)
    }
    
    // Mark list items after initial render
    const isTeamsPage = pathname?.includes('/teams')
    const delay = isTeamsPage ? 1500 : 800
    const initialTimer = setTimeout(() => {
      markReadOnlyItems()
      markNavigationLinks()
    }, delay)
    
    // Watch for DOM updates with MutationObserver
    let observer: MutationObserver | null = null
    
    const startObserving = () => {
      if (observer) return
      
      observer = new MutationObserver((mutations) => {
        // Only process if there are relevant changes to list rows or nav
        const hasRelevantChanges = mutations.some((mutation) => {
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            const target = mutation.target as HTMLElement
            return (
              target.tagName === 'TBODY' ||
              target.closest('table tbody') !== null ||
              target.closest('nav') !== null ||
              target.hasAttribute('data-payload-list-row')
            )
          }
          return false
        })
        
        if (hasRelevantChanges) {
          debouncedMarkItems()
        }
      })
      
      // Observe specific containers (not entire body for performance)
      const tableBody = document.querySelector('table tbody')
      const nav = document.querySelector('nav, aside[class*="nav"]')
      
      if (tableBody) {
        observer.observe(tableBody, { childList: true, subtree: false })
      }
      
      if (nav) {
        observer.observe(nav, { childList: true, subtree: false })
      }
      
      // Fallback: observe body (with limited scope)
      if (!tableBody && !nav) {
        observer.observe(document.body, { childList: true, subtree: false })
      }
    }
    
    // Start observing after initial render
    setTimeout(startObserving, delay + 500)
    
    // Cleanup on unmount
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      if (initialTimer) clearTimeout(initialTimer)
      if (observer) observer.disconnect()
    }
  }, [user, pathname])
  
  // Hidden marker element
  return <div style={{ display: 'none' }} data-read-only-styles-marker="true" />
}

export default ReadOnlyStyles
