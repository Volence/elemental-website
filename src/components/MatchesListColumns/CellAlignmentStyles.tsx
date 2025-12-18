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
        padding-top: 0.75rem !important;
        padding-bottom: 0.75rem !important;
      }

      /* Ensure all cell content wrappers are vertically centered */
      [class*="Table__cell"] > div {
        display: flex !important;
        align-items: center !important;
        min-height: 50px !important;
        height: 100% !important;
      }

      /* Ensure text cells and their children are aligned */
      [class*="Table__cell"] > div > div,
      [class*="Table__cell"] > div > span,
      [class*="Table__cell"] > div > a,
      [class*="Table__cell"] span,
      [class*="Table__cell"] time {
        display: flex !important;
        align-items: center !important;
        line-height: 1.5 !important;
      }

      /* Remove extra margins from cell contents */
      [class*="Table__cell"] * {
        margin-top: 0 !important;
        margin-bottom: 0 !important;
      }
    `}</style>
  )
}

export default CellAlignmentStyles
