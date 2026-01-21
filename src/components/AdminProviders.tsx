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
  
  // Fix doc-controls popup positioning
  // Payload renders popups via Portal directly under <body>, setting wrong inline positions
  useEffect(() => {
    const fixPopupPosition = () => {
      // Target popups that are direct children of body (Payload portal renders here)
      const popups = document.querySelectorAll('body > .popup__content')
      popups.forEach((popup) => {
        const el = popup as HTMLElement
        // Only fix if it has a ridiculous top value (indicates it's being positioned wrong)
        const currentTop = parseInt(el.style.top, 10)
        if (currentTop > 200) {
          el.style.position = 'fixed'
          el.style.top = '70px'
          el.style.right = '20px'
          el.style.left = 'auto'
          el.style.bottom = 'auto'
          el.style.zIndex = '999999'
        }
      })
    }
    
    // Watch for popup elements being added/modified
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
          fixPopupPosition()
        }
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          fixPopupPosition()
        }
      }
    })
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    })
    
    // Also run on initial load
    fixPopupPosition()
    
    return () => observer.disconnect()
  }, [])
  
  return <>{children}</>
}
