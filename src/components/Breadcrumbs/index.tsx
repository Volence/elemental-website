'use client'

import React from 'react'
import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'

export interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
  className?: string
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items, className = '' }) => {
  return (
    <nav aria-label="Breadcrumb" className={`flex items-center gap-2 text-sm ${className}`}>
      <Link
        href="/"
        className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
        aria-label="Home"
      >
        <Home className="w-4 h-4" />
      </Link>
      
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        
        return (
          <React.Fragment key={index}>
            <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="text-muted-foreground hover:text-primary transition-colors font-medium"
              >
                {item.label}
              </Link>
            ) : (
              <span className={`${isLast ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                {item.label}
              </span>
            )}
          </React.Fragment>
        )
      })}
    </nav>
  )
}
