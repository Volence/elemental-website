import React from 'react'

interface SkeletonProps {
  className?: string
  variant?: 'text' | 'circular' | 'rectangular'
  width?: string | number
  height?: string | number
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'text',
  width,
  height,
}) => {
  const baseStyles = 'animate-shimmer animate-skeleton'
  
  const variantStyles = {
    text: 'rounded h-4',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  }

  const style: React.CSSProperties = {}
  if (width) style.width = typeof width === 'number' ? `${width}px` : width
  if (height) style.height = typeof height === 'number' ? `${height}px` : height

  return (
    <div
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      style={style}
      aria-label="Loading..."
    />
  )
}

// Pre-made skeleton components for common use cases
export const TeamCardSkeleton: React.FC = () => (
  <div className="p-6 border-2 border-border rounded-xl bg-gradient-to-br from-card to-card/50">
    <div className="flex flex-col items-center">
      <Skeleton variant="circular" width={96} height={96} className="mb-4" />
      <Skeleton variant="text" width="60%" className="mb-2" />
      <Skeleton variant="text" width="40%" className="h-3" />
    </div>
  </div>
)

export const MatchCardSkeleton: React.FC = () => (
  <div className="p-8 border-2 border-border bg-gradient-to-br from-card to-card/50 rounded-xl">
    <div className="flex items-center justify-between gap-6 flex-wrap">
      <div className="flex items-center gap-4 flex-1">
        <Skeleton variant="circular" width={48} height={48} />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="70%" />
          <Skeleton variant="text" width="50%" className="h-3" />
        </div>
      </div>
      <Skeleton variant="rectangular" width={120} height={40} />
    </div>
  </div>
)

export const PlayerCardSkeleton: React.FC = () => (
  <div className="p-4 rounded-xl border-2 border-border bg-gradient-to-br from-background to-background/50">
    <div className="flex items-center gap-4">
      <Skeleton variant="circular" width={64} height={64} />
      <div className="flex-1 space-y-2">
        <Skeleton variant="text" width="60%" />
        <Skeleton variant="text" width="40%" className="h-3" />
      </div>
    </div>
  </div>
)

export const RecruitmentCardSkeleton: React.FC = () => (
  <div className="p-6 rounded-lg border-2 border-border bg-card">
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Skeleton variant="rectangular" width={80} height={28} />
        <Skeleton variant="rectangular" width={60} height={28} />
      </div>
      <div className="space-y-2">
        <Skeleton variant="text" width="100%" />
        <Skeleton variant="text" width="100%" />
        <Skeleton variant="text" width="70%" />
      </div>
      <div className="flex gap-3">
        <Skeleton variant="rectangular" className="flex-1" height={40} />
        <Skeleton variant="rectangular" className="flex-1" height={40} />
      </div>
    </div>
  </div>
)

