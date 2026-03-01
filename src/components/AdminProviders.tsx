'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

/**
 * AdminProviders - Wraps all admin pages and provides shared functionality
 * 
 * Currently provides:
 * - Sidebar scroll position preservation across navigation
 * - Doc-controls popup position fix (Payload sets wrong position via JS)
 */
export default function AdminProviders({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isFirstRender = useRef(true)
  
  // Sidebar scroll preservation
  useEffect(() => {
    const aside = document.querySelector('aside')
    if (!aside) return
    
    const storageKey = 'elemental-sidebar-scroll'
    
    // On first render, restore the saved scroll position
    if (isFirstRender.current) {
      isFirstRender.current = false
      const savedPosition = sessionStorage.getItem(storageKey)
      if (savedPosition) {
        // Use setTimeout to ensure the sidebar is fully rendered
        setTimeout(() => {
          aside.scrollTop = parseInt(savedPosition, 10)
        }, 50)
      }
    }
    
    // Save scroll position when it changes
    const handleScroll = () => {
      sessionStorage.setItem(storageKey, aside.scrollTop.toString())
    }
    
    aside.addEventListener('scroll', handleScroll, { passive: true })
    
    return () => {
      aside.removeEventListener('scroll', handleScroll)
    }
  }, [pathname])
  
  // Note: Popup positioning is handled by Payload's built-in JS.
  // Do NOT override popup positions — Payload calculates them from trigger button coordinates.
  
  return <>{children}</>
}
