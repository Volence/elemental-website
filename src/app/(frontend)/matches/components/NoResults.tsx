import React from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'

interface NoResultsProps {
  searchQuery: string
}

export function NoResults({ searchQuery }: NoResultsProps) {
  return (
    <div className="text-center py-20 bg-gradient-to-br from-card to-card/50 rounded-xl border-2 border-dashed border-border">
      <div className="max-w-md mx-auto">
        <Search className="w-20 h-20 text-muted-foreground mx-auto mb-6 opacity-40" />
        <h3 className="text-2xl font-bold mb-3">No Matches Found</h3>
        <p className="text-muted-foreground mb-2">
          No matches found for "<span className="font-semibold text-foreground">{searchQuery}</span>
          "
        </p>
        <p className="text-sm text-muted-foreground mb-6">
          Try searching for a team name, opponent, region, or league
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/matches"
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
          >
            View All Matches
          </Link>
          <Link
            href="/teams"
            className="px-4 py-2 rounded-lg border border-border bg-card hover:bg-accent transition-colors font-medium"
          >
            Browse Teams
          </Link>
        </div>
      </div>
    </div>
  )
}

