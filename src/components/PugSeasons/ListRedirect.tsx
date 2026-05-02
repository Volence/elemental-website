'use client'

import React, { useEffect } from 'react'

const PugSeasonsListRedirect: React.FC = () => {
  useEffect(() => {
    window.location.replace('/admin/pug-seasons')
  }, [])
  return null
}

export default PugSeasonsListRedirect
