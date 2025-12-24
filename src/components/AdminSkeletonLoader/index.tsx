'use client'

import React from 'react'
import './styles.scss'

/**
 * Skeleton loader component for admin panel
 * Provides shimmer animation for loading states
 */
interface AdminSkeletonProps {
  className?: string
  width?: string
  height?: string
}

export const AdminSkeleton: React.FC<AdminSkeletonProps> = ({ 
  className = '', 
  width,
  height 
}) => {
  const style: React.CSSProperties = {}
  if (width) style.width = width
  if (height) style.height = height

  return (
    <div 
      className={`admin-skeleton ${className}`}
      style={style}
    />
  )
}

/**
 * Skeleton for table cells
 */
export const AdminCellSkeleton: React.FC<{ width?: string }> = ({ width = '80px' }) => (
  <div className="admin-cell-skeleton">
    <AdminSkeleton width={width} height="16px" />
  </div>
)

/**
 * Skeleton for badges
 */
export const AdminBadgeSkeleton: React.FC = () => (
  <AdminSkeleton className="admin-badge-skeleton" width="60px" height="24px" />
)

/**
 * Skeleton for multiple badges
 */
export const AdminBadgeGroupSkeleton: React.FC<{ count?: number }> = ({ count = 2 }) => (
  <div className="admin-badge-group-skeleton">
    {Array.from({ length: count }).map((_, i) => (
      <AdminBadgeSkeleton key={i} />
    ))}
  </div>
)

/**
 * Skeleton for team logo
 */
export const AdminLogoSkeleton: React.FC = () => (
  <div className="admin-logo-skeleton">
    <AdminSkeleton width="40px" height="40px" />
  </div>
)

export default AdminSkeleton

