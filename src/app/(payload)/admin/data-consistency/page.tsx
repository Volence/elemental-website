import React from 'react'
import DataConsistencyView from '@/components/DataConsistencyView'

// Custom admin page - layout provides admin shell with sidebar
export default function DataConsistencyPage() {
  return (
    <div className="gutter--left gutter--right">
      <DataConsistencyView />
    </div>
  )
}
