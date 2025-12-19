'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'

interface MatchesSearchBarProps {
  initialQuery?: string
}

export function MatchesSearchBar({ initialQuery = '' }: MatchesSearchBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [searchQuery, setSearchQuery] = useState(initialQuery)
  const [isPending, startTransition] = useTransition()

  const handleSearch = (value: string) => {
    setSearchQuery(value)
    
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      
      if (value.trim()) {
        params.set('q', value.trim())
      } else {
        params.delete('q')
      }
      
      // Reset to page 1 when searching
      params.delete('page')
      
      const queryString = params.toString()
      router.push(`/matches${queryString ? `?${queryString}` : ''}`)
    })
  }

  const clearSearch = () => {
    setSearchQuery('')
    
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('q')
      params.delete('page')
      
      const queryString = params.toString()
      router.push(`/matches${queryString ? `?${queryString}` : ''}`)
    })
  }

  return (
    <div className="mb-8">
      <div className="relative max-w-2xl mx-auto">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search matches by team, opponent, region, league..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-12 pr-12 py-3 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
              disabled={isPending}
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        {isPending && (
          <div className="mt-2 text-sm text-muted-foreground text-center">
            Searching...
          </div>
        )}
      </div>
    </div>
  )
}
