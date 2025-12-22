'use client'

import React from 'react'
import { AdminViewWrapper } from './AdminViewWrapper'
import DataConsistencyView from './DataConsistencyView'

/**
 * Data Consistency View wrapped with admin layout for proper sidebar display
 */
const DataConsistencyViewWrapped: React.FC = () => {
  return (
    <AdminViewWrapper>
      <DataConsistencyView />
    </AdminViewWrapper>
  )
}

export default DataConsistencyViewWrapped

