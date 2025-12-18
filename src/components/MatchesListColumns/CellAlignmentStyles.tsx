'use client'

import React from 'react'

/**
 * Global styles for vertically centering cells in Matches list view
 */
const CellAlignmentStyles = () => {
  return (
    <style jsx global>{`
      /* Target all cells in the Matches collection list */
      [class*="Table__table"] tr[class*="Table__row"] td[class*="Table__cell"] {
        vertical-align: middle !important;
      }

      /* Ensure the immediate cell content wrapper is vertically centered */
      [class*="Table__cell"] > div {
        display: flex !important;
        align-items: center !important;
        min-height: 50px !important;
      }

      /* For cells with nested content (like dates), center the inner wrapper too */
      [class*="Table__cell"] > div > div:first-child {
        display: flex !important;
        align-items: center !important;
        width: 100% !important;
      }
    `}</style>
  )
}

export default CellAlignmentStyles
