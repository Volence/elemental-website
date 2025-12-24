import React from 'react'
import Link from 'next/link'
import { Shield } from 'lucide-react'
import { StaffMemberCard } from './StaffMemberCard'

interface StaffMember {
  name: string
  photoUrl?: string | null
  twitter?: string
  twitch?: string
  youtube?: string
  instagram?: string
}

interface TeamStaffSectionProps {
  managers?: StaffMember[]
  coaches?: StaffMember[]
  captains?: StaffMember[]
  coCaptain?: string | null
}

export function TeamStaffSection({
  managers,
  coaches,
  captains,
  coCaptain,
}: TeamStaffSectionProps) {
  const hasAnyStaff =
    (managers && managers.length > 0) ||
    (coaches && coaches.length > 0) ||
    (captains && captains.length > 0) ||
    coCaptain

  if (!hasAnyStaff) {
    return (
      <div className="p-10 rounded-xl border-2 border-dashed border-border bg-gradient-to-br from-card to-card/50 text-center">
        <Shield className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-40" />
        <h3 className="text-xl font-bold mb-2">No Staff Information</h3>
        <p className="text-muted-foreground mb-4">
          Staff information hasn't been added yet for this team.
        </p>
        <Link
          href="/teams"
          className="inline-block px-4 py-2 rounded-lg border border-border bg-card hover:bg-accent transition-colors font-medium text-sm"
        >
          View All Teams
        </Link>
      </div>
    )
  }

  return (
    <div className="p-6 rounded-xl border border-border bg-card shadow-sm">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2 flex items-center gap-3">
          <Shield className="w-6 h-6 text-primary" />
          Staff
        </h2>
        <div className="w-20 h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 rounded-full"></div>
      </div>
      <div className="space-y-6">
        {managers && managers.length > 0 && (
          <div className="space-y-3">
            <div 
              className="text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border inline-block"
              style={{
                backgroundColor: '#a855f715',
                color: '#a855f7',
                borderColor: '#a855f750'
              }}
            >
              Manager
            </div>
            <div className="grid gap-3">
              {managers.map((manager, i) => (
                <StaffMemberCard key={i} {...manager} role="manager" />
              ))}
            </div>
          </div>
        )}

        {coaches && coaches.length > 0 && (
          <div className="space-y-3">
            <div 
              className="text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border inline-block"
              style={{
                backgroundColor: '#22c55e15',
                color: '#22c55e',
                borderColor: '#22c55e50'
              }}
            >
              Coach{coaches.length > 1 ? 'es' : ''}
            </div>
            <div className="grid gap-3">
              {coaches.map((coach, i) => (
                <StaffMemberCard key={i} {...coach} role="coach" />
              ))}
            </div>
          </div>
        )}

        {captains && captains.length > 0 && (
          <div className="space-y-3">
            <div 
              className="text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border inline-block"
              style={{
                backgroundColor: '#eab30815',
                color: '#eab308',
                borderColor: '#eab30850'
              }}
            >
              Captain
            </div>
            <div className="grid gap-3">
              {captains.map((captain, i) => (
                <StaffMemberCard key={i} {...captain} role="captain" />
              ))}
            </div>
          </div>
        )}

        {coCaptain && (
          <div className="space-y-3">
            <div 
              className="text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border inline-block"
              style={{
                backgroundColor: '#eab30815',
                color: '#eab308',
                borderColor: '#eab30850'
              }}
            >
              Co-Captain
            </div>
            <Link
              href={`/players/${coCaptain.toLowerCase().replace(/\s+/g, '-')}`}
              className="group flex items-center gap-4 p-4 rounded-xl border-2 border-border bg-gradient-to-br from-background to-background/50 hover:border-primary/50 hover:shadow-lg transition-all"
            >
              <div 
                className="w-12 h-12 rounded-full flex items-center justify-center ring-2 transition-all text-lg font-bold"
                style={{
                  backgroundColor: '#eab30815',
                  color: '#eab308',
                  borderColor: '#eab30850'
                }}
              >
                {coCaptain.charAt(0)}
              </div>
              <span className="flex-1 font-bold group-hover:text-primary transition-colors">
                {coCaptain}
              </span>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

