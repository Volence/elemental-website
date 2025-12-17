'use client'

import React from 'react'

/**
 * Component that adds custom CSS to vertically center checkboxes in Teams list
 */
const CellAlignmentStyles: React.FC = () => {
  return (
    <style jsx global>{`
      /* Center checkboxes in Teams collection list */
      .cell-_select {
        vertical-align: middle !important;
      }
      
      .cell-_select .select-row {
        display: flex !important;
        align-items: center !important;
        min-height: 50px !important;
      }

      .cell-_select .checkbox-input {
        display: flex !important;
        align-items: center !important;
        min-height: 50px !important;
      }

      /* Ensure table cells have consistent vertical alignment */
      .collection-list__wrap .table tbody td {
        vertical-align: middle !important;
      }
    `}</style>
  )
}

export default CellAlignmentStyles
