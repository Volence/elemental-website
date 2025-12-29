'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// Map routes to section themes
const routeToSectionMap: Record<string, string> = {
  // People & Teams
  '/admin/collections/people': 'people',
  '/admin/collections/teams': 'teams',
  
  // Production
  '/admin/globals/production-dashboard': 'production',
  '/admin/collections/matches': 'matches',
  '/admin/collections/tournament-templates': 'matches',
  
  // Staff
  '/admin/collections/organization-staff': 'staff',
  '/admin/collections/production-staff': 'staff',
  
  // System
  '/admin/collections/users': 'system',
  '/admin/collections/ignored-duplicates': 'system',
  '/admin/collections/invite-links': 'system',
  
  // Recruitment
  '/admin/collections/recruitment-listings': 'recruitment',
  '/admin/collections/recruitment-applications': 'recruitment',
  
  // Tools
  '/admin/globals/data-consistency': 'tools',
  '/admin/globals/schedule-generator': 'tools',
}

/**
 * Client component that automatically applies section theming based on the current route
 * This component should be included in the Payload admin layout
 */
export const SectionThemeApplicator = () => {
  const pathname = usePathname()
  
  useEffect(() => {
    // Find matching section for current path
    let section = 'system' // Default section
    
    for (const [route, sectionName] of Object.entries(routeToSectionMap)) {
      if (pathname?.startsWith(route)) {
        section = sectionName
        break
      }
    }
    
    // Apply data-section attribute to main content area
    const mainElement = document.querySelector('main')
    if (mainElement) {
      mainElement.setAttribute('data-section', section)
    }
    
    // Also apply to template-default container if it exists
    const templateDefault = document.querySelector('.template-default')
    if (templateDefault) {
      templateDefault.setAttribute('data-section', section)
    }
    
  }, [pathname])
  
  return null // This component doesn't render anything
}





