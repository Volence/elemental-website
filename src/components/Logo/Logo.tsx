import clsx from 'clsx'
import React from 'react'
import Image from 'next/image'

interface Props {
  className?: string
  loading?: 'lazy' | 'eager'
  priority?: 'auto' | 'high' | 'low'
}

export const Logo = (props: Props) => {
  const { loading: loadingFromProps, priority: priorityFromProps, className } = props

  const loading = loadingFromProps || 'lazy'
  const priority = priorityFromProps || 'low'

  return (
    <Image
      alt="Elemental Logo"
      width={193}
      height={34}
      loading={loading}
      priority={priority === 'high'}
      className={clsx('max-w-[9.375rem] w-full h-[34px] object-contain', className)}
      src="/logos/org.png"
    />
  )
}
