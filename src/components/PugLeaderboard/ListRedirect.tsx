'use client'
import React, { useEffect } from 'react'
const PugLeaderboardListRedirect: React.FC = () => {
  useEffect(() => { window.location.replace('/admin/pug-leaderboard') }, [])
  return null
}
export default PugLeaderboardListRedirect
