'use client'

import React, { useEffect } from 'react'
import { useAuth } from '@payloadcms/ui'
import { usePathname } from 'next/navigation'
import type { User } from '@/payload-types'
import { UserRole } from '@/access/roles'

/**
 * Component that adds CSS and marks read-only items in list views and navigation
 * This runs globally and injects styles + marks items based on permissions
 */
const ReadOnlyStyles: React.FC = () => {
  const { user } = useAuth()
  const pathname = usePathname()
  
  useEffect(() => {
    if (!user) return
    
    // @ts-ignore - Payload ClientUser type compatibility issue
    const currentUser = user as User
    
    // Inject CSS to style read-only items (only once)
    const styleId = 'read-only-items-style'
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style')
      style.id = styleId
      style.textContent = `
        /* Gray out list rows marked as read-only */
        [data-payload-list-row][data-read-only="true"] {
          opacity: 0.5 !important;
          filter: grayscale(0.4) !important;
        }
        
        [data-payload-list-row][data-read-only="true"]:hover {
          opacity: 0.7 !important;
          background-color: var(--theme-elevation-50) !important;
        }
        
        [data-payload-list-row][data-read-only="true"] a,
        [data-payload-list-row][data-read-only="true"] button {
          cursor: not-allowed !important;
          pointer-events: auto;
        }
        
        /* Add visual indicator in the name/title cell */
        [data-payload-list-row][data-read-only="true"] [data-payload-cell="name"]::after,
        [data-payload-list-row][data-read-only="true"] [data-payload-cell="displayName"]::after {
          content: " (Read-only)";
          font-size: 0.7rem;
          color: var(--theme-text-50);
          font-style: italic;
          margin-left: 0.5rem;
          opacity: 0.8;
        }
        
        /* Gray out navigation links for collections user can't access */
        nav a[data-read-only-nav="true"],
        [data-payload-nav-link][data-read-only-nav="true"] {
          opacity: 0.4 !important;
          filter: grayscale(0.6) !important;
          pointer-events: auto;
          cursor: not-allowed !important;
        }
        
        nav a[data-read-only-nav="true"]:hover,
        [data-payload-nav-link][data-read-only-nav="true"]:hover {
          opacity: 0.5 !important;
        }
      `
      document.head.appendChild(style)
    }
    
    // Only apply to non-admin users
    if (currentUser.role === UserRole.ADMIN) {
      // Remove any read-only markers for admins
      document.querySelectorAll('[data-read-only="true"]').forEach(el => {
        el.removeAttribute('data-read-only')
      })
      document.querySelectorAll('[data-read-only-nav="true"]').forEach(el => {
        el.removeAttribute('data-read-only-nav')
      })
      return
    }
    
    // Determine which collection we're viewing (at top level so it can be used in multiple places)
    const currentPathname = pathname || window.location.pathname
    const isTeamsPage = currentPathname?.includes('/teams')
    const isOrgStaffPage = currentPathname?.includes('/organization-staff')
    const isProductionPage = currentPathname?.includes('/production')
    
    // Function to mark navigation links as read-only
    const markNavigationLinks = () => {
      // Find all navigation links - Payload uses specific selectors
      const navLinks = document.querySelectorAll('nav a[href*="/admin/collections/"], nav a[href*="/admin/globals/"], [data-payload-nav-link] a, aside a[href*="/admin/"]')
      
      navLinks.forEach((link) => {
        const href = link.getAttribute('href') || ''
        const linkText = link.textContent?.toLowerCase() || ''
        
        // Check if this is a collection link the user can't access
        if (href.includes('/organization-staff') || linkText.includes('organization staff')) {
          if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.STAFF_MANAGER) {
            link.setAttribute('data-read-only-nav', 'true')
            if (process.env.NODE_ENV === 'development') {
              console.log('[ReadOnlyStyles] Marked Organization Staff nav as read-only')
            }
          } else {
            link.removeAttribute('data-read-only-nav')
          }
        } else if (href.includes('/production') || linkText.includes('production staff')) {
          if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.STAFF_MANAGER) {
            link.setAttribute('data-read-only-nav', 'true')
            if (process.env.NODE_ENV === 'development') {
              console.log('[ReadOnlyStyles] Marked Production Staff nav as read-only')
            }
          } else {
            link.removeAttribute('data-read-only-nav')
          }
        } else if (href.includes('/teams') || linkText.includes('teams')) {
          // Teams are always visible, but items within will be marked
          link.removeAttribute('data-read-only-nav')
        } else {
          // Remove marker for other links
          link.removeAttribute('data-read-only-nav')
        }
      })
    }
    
    // Function to mark read-only items in list views
    const markReadOnlyItems = () => {
      // Use current pathname (may have changed since component mounted)
      const currentPath = window.location.pathname
      const isTeamsPageLocal = currentPath?.includes('/teams')
      const isOrgStaffPageLocal = currentPath?.includes('/organization-staff')
      const isProductionPageLocal = currentPath?.includes('/production')
      
      if (!isTeamsPageLocal && !isOrgStaffPageLocal && !isProductionPageLocal) {
        // Not on a list page, clear any markers
        document.querySelectorAll('[data-read-only="true"]').forEach(el => {
          el.removeAttribute('data-read-only')
        })
        return
      }
      
      // Find list rows - Payload uses table rows with links
      // Use more specific selector to avoid scanning entire DOM
      const tableBody = document.querySelector('table tbody')
      if (!tableBody) return // Early exit if no table
      
      const rows = tableBody.querySelectorAll('tr:not(:first-child)') // Skip header row
      if (rows.length === 0) return // Early exit if no rows
      
      // Process rows efficiently
      rows.forEach((row) => {
        // Try to get the ID from the link href (most reliable)
        let itemId: string | null = null
        
        // Method 1: Extract from link href (most reliable for Payload)
        const link = row.querySelector('a[href*="/edit/"], a[href*="/teams/"], a[href*="/organization-staff/"], a[href*="/production/"]')
        if (link) {
          const href = link.getAttribute('href') || ''
          // Match patterns like /admin/collections/teams/123 or /teams/123/edit
          const match = href.match(/\/(\d+)(?:\/|$)/)
          if (match) {
            itemId = match[1]
          }
        }
        
        // Method 2: Check for data-row-id attribute
        if (!itemId) {
          itemId = row.getAttribute('data-row-id')
        }
        
        // Method 3: Check ID cell
        if (!itemId) {
          const idCell = row.querySelector('[data-payload-cell="id"]')
          if (idCell) {
            itemId = idCell.textContent?.trim() || null
          }
        }
        
        // Method 4: Check the row's ID or data attributes
        if (!itemId) {
          itemId = (row as HTMLElement).id || row.getAttribute('data-id') || null
        }
        
        if (!itemId) {
          // Skip rows without IDs (headers, etc.)
          return
        }
        
        let canEdit = false
        
        if (isTeamsPageLocal && currentUser.role === UserRole.TEAM_MANAGER) {
          // Team managers can only edit their assigned teams
          const assignedTeams = currentUser.assignedTeams
          if (assignedTeams && Array.isArray(assignedTeams) && assignedTeams.length > 0) {
            const teamIds = assignedTeams.map((team: any) => {
              // Handle both populated objects and IDs
              if (typeof team === 'number') return team
              if (typeof team === 'object' && team !== null) {
                return team.id || team
              }
              return Number(team) || team
            }).filter((id): id is number => typeof id === 'number')
            
            canEdit = teamIds.includes(Number(itemId))
            
            // Debug logging
            if (process.env.NODE_ENV === 'development') {
              console.log('[ReadOnlyStyles] Team Manager check:', {
                itemId,
                teamIds,
                canEdit,
                assignedTeams: assignedTeams.slice(0, 3), // Only log first 3
                pathname
              })
            }
          } else {
            // No assigned teams = can't edit any
            canEdit = false
            if (process.env.NODE_ENV === 'development') {
              console.log('[ReadOnlyStyles] Team Manager has no assigned teams')
            }
          }
        } else if ((isOrgStaffPageLocal || isProductionPageLocal) && currentUser.role === UserRole.STAFF_MANAGER) {
          // Staff managers can edit all staff (both organization and production)
          canEdit = true
        }
        
        if (!canEdit) {
          row.setAttribute('data-read-only', 'true')
          if (process.env.NODE_ENV === 'development' && isTeamsPageLocal) {
            console.log(`[ReadOnlyStyles] Marked team ${itemId} as read-only`)
          }
        } else {
          row.removeAttribute('data-read-only')
          if (process.env.NODE_ENV === 'development' && isTeamsPageLocal) {
            console.log(`[ReadOnlyStyles] Team ${itemId} is editable`)
          }
        }
      })
    }
    
    // Mark navigation links immediately (only once)
    markNavigationLinks()
    
    // Debounce function to limit how often we check (prevents CPU spikes)
    let debounceTimer: NodeJS.Timeout | null = null
    let isProcessing = false
    
    const debouncedMarkItems = () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
      debounceTimer = setTimeout(() => {
        if (!isProcessing) {
          isProcessing = true
          markReadOnlyItems()
          markNavigationLinks()
          isProcessing = false
        }
      }, 500) // Wait 500ms after last change before processing
    }
    
    // Mark list items after initial render (longer delay for Teams page to ensure DOM is ready)
    const delay = isTeamsPage ? 1500 : 800
    const initialTimer = setTimeout(() => {
      markReadOnlyItems()
      markNavigationLinks()
    }, delay)
    
    // Watch for DOM updates with debouncing and limited scope
    let observer: MutationObserver | null = null
    let isObserving = false
    
    const startObserving = () => {
      if (isObserving || observer) return
      
      observer = new MutationObserver((mutations) => {
        // Only process if there are actual relevant changes to list rows or nav
        const hasRelevantChanges = mutations.some((mutation) => {
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            const target = mutation.target as HTMLElement
            // Only care about table rows or navigation changes
            return target.tagName === 'TBODY' || 
                   target.closest('table tbody') !== null ||
                   target.closest('nav') !== null ||
                   target.hasAttribute('data-payload-list-row')
          }
          return false
        })
        
        if (hasRelevantChanges) {
          debouncedMarkItems()
        }
      })
      
      // Only observe specific containers, not the entire body
      const tableBody = document.querySelector('table tbody')
      const nav = document.querySelector('nav, aside[class*="nav"]')
      
      if (tableBody) {
        observer.observe(tableBody, { 
          childList: true,
          subtree: false, // Don't go deep - only direct children
        })
      }
      
      if (nav) {
        observer.observe(nav, { 
          childList: true,
          subtree: false,
        })
      }
      
      // Only observe body as last resort, and with limited scope
      if (!tableBody && !nav) {
        observer.observe(document.body, { 
          childList: true, 
          subtree: false, // Critical: don't watch entire subtree
        })
      }
      
      isObserving = true
    }
    
    // Start observing after initial render
    setTimeout(startObserving, delay + 500)
    
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
      if (initialTimer) {
        clearTimeout(initialTimer)
      }
      if (observer) {
        observer.disconnect()
      }
    }
  }, [user, pathname])
  
  // Return a hidden div to ensure the component renders
  return <div style={{ display: 'none' }} data-read-only-styles-marker="true" />
}

export default ReadOnlyStyles
