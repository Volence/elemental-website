'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

/**
 * SidebarScrollPreserver
 * 
 * Injected via beforeNavLinks to ensure it runs on every admin page.
 * Preserves sidebar scroll position across navigation by:
 * 1. Saving scroll position to sessionStorage on every scroll event
 * 2. Restoring scroll position after navigation completes
 * 3. Adding data-scroll-behavior attribute for Next.js compatibility
 */
export default function SidebarScrollPreserver() {
  const pathname = usePathname()
  const hasInitialized = useRef(false)
  
  // Add data-scroll-behavior attribute to HTML element (once)
  useEffect(() => {
    if (!hasInitialized.current) {
      const html = document.documentElement
      if (!html.hasAttribute('data-scroll-behavior')) {
        html.setAttribute('data-scroll-behavior', 'smooth')
      }
      hasInitialized.current = true
    }
  }, [])
  
  useEffect(() => {
    // Find the sidebar - it's the <aside> element
    const aside = document.querySelector('aside')
    if (!aside) {
      return
    }
    
    const storageKey = 'elemental-sidebar-scroll-v2'
    
    // Restore scroll position with smooth scroll disabled
    const savedPosition = sessionStorage.getItem(storageKey)
    if (savedPosition) {
      const scrollTo = parseInt(savedPosition, 10)
      
      // Temporarily disable smooth scrolling for instant restoration
      const originalScrollBehavior = aside.style.scrollBehavior
      aside.style.scrollBehavior = 'auto'
      
      // Use multiple attempts with increasing delays
      // to handle React's hydration and rendering timing
      const attempts = [0, 10, 50, 100, 200]
      attempts.forEach((delay, index) => {
        setTimeout(() => {
          if (aside.scrollTop !== scrollTo) {
            aside.scrollTop = scrollTo
          }
          // Restore original scroll behavior after last attempt
          if (index === attempts.length - 1) {
            setTimeout(() => {
              aside.style.scrollBehavior = originalScrollBehavior
            }, 50)
          }
        }, delay)
      })
    }
    
    // Save scroll position on every scroll
    const handleScroll = () => {
      sessionStorage.setItem(storageKey, aside.scrollTop.toString())
    }
    
    aside.addEventListener('scroll', handleScroll, { passive: true })
    
    // Also save on click of any nav link (before navigation)
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('a, button')) {
        sessionStorage.setItem(storageKey, aside.scrollTop.toString())
      }
    }
    aside.addEventListener('click', handleClick)
    
    return () => {
      aside.removeEventListener('scroll', handleScroll)
      aside.removeEventListener('click', handleClick)
    }
  }, [pathname])
  
  return null
}
