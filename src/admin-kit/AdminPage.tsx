'use client'

import React from 'react'

export type AdminPageWidth = 'narrow' | 'default' | 'wide' | 'full'

export interface AdminPageProps {
  /** narrow = 768px, default = 1024px, wide = 1280px, full = 100%. */
  width?: AdminPageWidth
  children: React.ReactNode
  className?: string
}

/**
 * The page shell for every custom admin view. Owns max-width, centering and
 * padding so content boxes stop jumping between tabs and screens. Wide content
 * inside scrolls horizontally here instead of being clipped by the layout.
 */
export function AdminPage({ width = 'default', children, className }: AdminPageProps) {
  return <div className={`kit-page kit-page--${width}${className ? ` ${className}` : ''}`}>{children}</div>
}

export default AdminPage
