'use client'

import React from 'react'

export default function RecordCell({ rowData }: any) {
  const wins = rowData?.standings?.wins || 0
  const losses = rowData?.standings?.losses || 0
  const ties = rowData?.standings?.ties || 0
  
  if (ties > 0) {
    return <span>{wins}-{losses}-{ties}</span>
  }
  
  return <span>{wins}-{losses}</span>
}

