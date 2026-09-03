'use client'

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Payload's default Teams list is retired; anyone landing on it goes to /admin/teams. */
const TeamsListRedirect: React.FC = () => {
  const router = useRouter()
  useEffect(() => {
    router.replace('/admin/teams')
  }, [router])
  return null
}

export default TeamsListRedirect
