import React from 'react'
import { Lock } from 'lucide-react'
import { SubstituteCard } from './SubstituteCard'

interface Substitute {
  name: string
  photoUrl?: string | null
  twitter?: string
  twitch?: string
  youtube?: string
  instagram?: string
}

interface TeamSubstitutesSectionProps {
  subs?: Substitute[]
  brandingPrimary?: string
  brandingSecondary?: string
}

export function TeamSubstitutesSection({ subs, brandingPrimary, brandingSecondary }: TeamSubstitutesSectionProps) {
  if (!subs || subs.length === 0) {
    return null
  }

  return (
    <div className="p-6 rounded-xl border border-border bg-card shadow-sm">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2 flex items-center gap-4">
          <Lock className="w-6 h-6 text-orange-500" />
          Substitutes
        </h2>
        <div 
          className="w-20 h-1 rounded-full"
          style={{
            background: brandingPrimary && brandingSecondary 
              ? `linear-gradient(to right, ${brandingPrimary}, ${brandingSecondary})`
              : 'linear-gradient(to right, #f97316, #f59e0b, #eab308)'
          }}
        ></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {subs.map((sub, i) => (
          <SubstituteCard key={i} {...sub} />
        ))}
      </div>
    </div>
  )
}

