'use client'

import React, { useEffect, useState } from 'react'

interface User {
  id: number | string
  name?: string
  email?: string
}

interface AssignedToCellProps {
  rowData?: {
    assignedTo?: number | User
  }
}

export default function AssignedToCell({ rowData }: AssignedToCellProps) {
  const assignedTo = rowData?.assignedTo
  const [userName, setUserName] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchUserName = async () => {
      if (!assignedTo) {
        setLoading(false)
        return
      }

      // Check if it's already a populated object
      if (typeof assignedTo === 'object' && 'name' in assignedTo) {
        setUserName(assignedTo.name || assignedTo.email || `User #${assignedTo.id}`)
        setLoading(false)
        return
      }

      // Otherwise it's just an ID, fetch the user data
      const userId = typeof assignedTo === 'object' ? assignedTo.id : assignedTo
      
      try {
        const response = await fetch(`/api/users/${userId}?depth=0`)
        const user = await response.json()
        
        if (user && !user.errors) {
          setUserName(user.name || user.email || `User #${userId}`)
        } else {
          setUserName(`User #${userId}`)
        }
      } catch (error) {
        console.error('Error fetching user:', error)
        setUserName(`User #${userId}`)
      } finally {
        setLoading(false)
      }
    }

    fetchUserName()
  }, [assignedTo])

  if (!assignedTo) {
    return <span style={{ color: 'var(--theme-elevation-500)', fontSize: '0.85rem' }}>Unassigned</span>
  }

  if (loading) {
    return <span style={{ color: 'var(--theme-elevation-500)', fontSize: '0.85rem' }}>...</span>
  }

  return (
    <span style={{ color: 'var(--theme-text)', fontSize: '0.9rem' }}>
      {userName}
    </span>
  )
}

