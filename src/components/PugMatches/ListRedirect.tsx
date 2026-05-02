'use client'
import React, { useEffect } from 'react'
const PugMatchesListRedirect: React.FC = () => {
  useEffect(() => { window.location.replace('/admin/pug-matches') }, [])
  return null
}
export default PugMatchesListRedirect
