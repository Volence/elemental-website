'use client'
import React, { useEffect } from 'react'
const PugPlayersListRedirect: React.FC = () => {
  useEffect(() => { window.location.replace('/admin/pug-dashboard') }, [])
  return null
}
export default PugPlayersListRedirect
