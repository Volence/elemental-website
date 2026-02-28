import React from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PastMatchCard } from './PastMatchCard'
import type { Match } from '@/payload-types'

interface PastMatchesProps {
  matches: Match[]
  totalDocs: number
  currentPage: number
  totalPages: number
  searchQuery?: string
}

export function PastMatches({
  matches,
  totalDocs,
  currentPage,
  totalPages,
  searchQuery,
}: PastMatchesProps) {
  if (matches.length === 0) {
    return null
  }

  return (
    <div>
      {/* Separator - only show if there's content above */}
      {!searchQuery && (
        <div className="relative my-12">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border"></div>
          </div>
          <div className="relative flex justify-center">
            <span className="bg-background px-4 text-sm text-muted-foreground">Match History</span>
          </div>
        </div>
      )}

      <h2
        id="past-matches"
        className="text-2xl font-bold mb-6 flex items-center gap-2 scroll-mt-24"
      >
        <div className="w-2 h-8 bg-muted rounded-full" />
        Past Matches
        <span className="text-sm font-normal text-muted-foreground ml-2">({totalDocs})</span>
      </h2>

      <div className="space-y-4">
        {matches
          .filter((match) => {
            if (!match.date) return false
            const matchDate = new Date(match.date as string)
            return !isNaN(matchDate.getTime())
          })
          .map((match) => (
            <PastMatchCard key={match.id} match={match} />
          ))}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          {/* Previous Button */}
          <Link
            href={`/matches${currentPage > 1 ? `?page=${currentPage - 1}` : ''}`}
            className={`
                    flex items-center gap-1 px-4 py-2 rounded-lg border transition-colors
                    ${currentPage === 1 ? 'border-border bg-card/30 text-muted-foreground cursor-not-allowed pointer-events-none' : 'border-border bg-card hover:bg-card/80 text-foreground'}
                  `}
            aria-disabled={currentPage === 1}
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Previous</span>
          </Link>

          {/* Page Numbers */}
          <div className="flex items-center gap-2">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((pageNum) => {
                // Show first page, last page, current page, and pages around current
                if (pageNum === 1 || pageNum === totalPages) return true
                if (Math.abs(pageNum - currentPage) <= 1) return true
                return false
              })
              .map((pageNum, idx, array) => {
                // Add ellipsis if there's a gap
                const prevPageNum = array[idx - 1]
                const showEllipsis = prevPageNum && pageNum - prevPageNum > 1

                return (
                  <React.Fragment key={pageNum}>
                    {showEllipsis && <span className="px-2 text-muted-foreground">...</span>}
                    <Link
                      href={`/matches${pageNum === 1 ? '' : `?page=${pageNum}`}`}
                      className={`
                              w-10 h-10 flex items-center justify-center rounded-lg border transition-colors
                              ${pageNum === currentPage ? 'border-primary bg-primary text-primary-foreground font-semibold' : 'border-border bg-card hover:bg-card/80 text-foreground'}
                            `}
                      aria-current={pageNum === currentPage ? 'page' : undefined}
                    >
                      {pageNum}
                    </Link>
                  </React.Fragment>
                )
              })}
          </div>

          {/* Next Button */}
          <Link
            href={`/matches?page=${currentPage + 1}`}
            className={`
                    flex items-center gap-1 px-4 py-2 rounded-lg border transition-colors
                    ${currentPage === totalPages ? 'border-border bg-card/30 text-muted-foreground cursor-not-allowed pointer-events-none' : 'border-border bg-card hover:bg-card/80 text-foreground'}
                  `}
            aria-disabled={currentPage === totalPages}
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* Match Count Info */}
      <div className="mt-4 text-center text-sm text-muted-foreground">
        Showing {matches.length} of {totalDocs} past matches
        {searchQuery && ` (filtered)`}
      </div>
    </div>
  )
}

