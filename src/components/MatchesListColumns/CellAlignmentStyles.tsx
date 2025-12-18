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

      /* Ensure all cell content wrappers are vertically centered */
      [class*="Table__cell"] > div {
        display: flex !important;
        align-items: center !important;
        min-height: 50px !important;
      }

      /* Ensure text cells don't have extra padding that throws off centering */
      [class*="Table__cell"] > div > div {
        display: flex !important;
        align-items: center !important;
      }
    `}</style>
  )
}

export default CellAlignmentStyles
