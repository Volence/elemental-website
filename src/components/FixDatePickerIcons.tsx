'use client'

import { useEffect } from 'react'

/**
 * Fix date picker icon positioning
 * 
 * PayloadCMS's date picker buttons have default sizing (32px with 6.5px padding)
 * that can't be overridden through CSS specificity alone. This component applies
 * inline styles after the component mounts to ensure proper icon alignment.
 * 
 * Fixes:
 * - Clear button: top: 3px (relative positioning)
 * - Icon wrap: top: 12px (from 10px + 2px adjustment)
 */
export default function FixDatePickerIcons() {
  useEffect(() => {
    function applyFixes() {
      // Fix clear button positioning
      const clearButtons = document.querySelectorAll<HTMLElement>('.date-time-picker__clear-button')
      clearButtons.forEach((button) => {
        if (button.style.top !== '-5px') {
          button.style.top = '-5px' // Negative value moves it UP
          button.style.position = 'relative'
        }
      })
      
      // Fix icon wrap positioning  
      const iconWraps = document.querySelectorAll<HTMLElement>('.date-time-picker__icon-wrap')
      iconWraps.forEach((wrap) => {
        if (wrap.style.top !== '8px') {
          wrap.style.top = '8px' // Reduce from 10px to move up
        }
      })
    }
    
    // Apply fixes after DOM is fully rendered
    const timeouts: NodeJS.Timeout[] = []
    
    // Multiple attempts with increasing delays to catch dynamically loaded content
    ;[0, 100, 500, 1000, 2000].forEach((delay) => {
      timeouts.push(
        setTimeout(() => {
          requestAnimationFrame(() => {
            applyFixes()
          })
        }, delay)
      )
    })
    
    // Watch for new date pickers being added (e.g., in arrays, tabs, or dynamic fields)
    const observer = new MutationObserver(() => {
      requestAnimationFrame(() => {
        applyFixes()
      })
    })
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })
    
    // Cleanup
    return () => {
      timeouts.forEach((t) => clearTimeout(t))
      observer.disconnect()
    }
  }, [])
  
  return null // This component doesn't render anything
}

