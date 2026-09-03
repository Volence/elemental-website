'use client'

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** The stock Schedules (discord-polls) list is retired; it forwards to /admin/schedules. */
const SchedulesListRedirect: React.FC = () => {
  const router = useRouter()
  useEffect(() => {
    router.replace('/admin/schedules')
  }, [router])
  return null
}

export default SchedulesListRedirect
