'use client'
import React, { useEffect } from 'react'
const PugLeaderboardListRedirect: React.FC = () => {
  useEffect(() => { window.location.replace('/admin/pug-dashboard') }, [])
  return null
}
export default PugLeaderboardListRedirect
