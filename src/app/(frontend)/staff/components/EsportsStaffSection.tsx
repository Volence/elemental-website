import React from 'react'
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

interface EsportsStaffSectionProps {
  managers: StaffMember[]
  coaches: StaffMember[]
  captains: StaffMember[]
  debugInfo?: {
    totalTeams: number
    managersBeforeFilter: number
    coachesBeforeFilter: number
    captainsBeforeFilter: number
    validManagers: number
    validCoaches: number
    validCaptains: number
  }
}

const managerColors = {
  from: 'from-green-500/20',
  to: 'to-green-600/10',
  text: 'text-green-500',
  ring: 'ring-green-500/20',
}

const coachColors = {
  from: 'from-blue-500/20',
  to: 'to-blue-600/10',
  text: 'text-blue-500',
  ring: 'ring-blue-500/20',
}

const captainColors = {
  from: 'from-yellow-500/20',
  to: 'to-yellow-600/10',
  text: 'text-yellow-500',
  ring: 'ring-yellow-500/20',
}

export function EsportsStaffSection({
  managers,
  coaches,
  captains,
  debugInfo,
}: EsportsStaffSectionProps) {
  const hasAnyStaff = managers.length > 0 || coaches.length > 0 || captains.length > 0

  return (
    <div className="p-6 rounded-2xl bg-gradient-to-br from-green-500/5 via-blue-500/5 to-yellow-500/5">
      <div className="mb-6">
        <h2 className="text-3xl md:text-4xl font-bold mb-2 tracking-tight flex items-center gap-3">
          <Shield className="w-8 h-8" />
          Esports Staff
        </h2>
        <div className="w-24 h-1 bg-gradient-to-r from-[hsl(var(--accent-green))] via-[hsl(var(--accent-blue))] to-[hsl(var(--accent-gold))] shadow-lg" />
      </div>

      {hasAnyStaff ? (
        <div className="space-y-8">
          {managers.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-muted-foreground uppercase tracking-wider">
                Managers
              </h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {managers.map((manager, i) => (
                  <StaffMemberCard
                    key={i}
                    name={manager.name}
                    photoUrl={manager.photoUrl}
                    socialLinks={manager}
                    avatarColors={managerColors}
                  />
                ))}
              </div>
            </div>
          )}

          {coaches.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-muted-foreground uppercase tracking-wider">
                Coaches
              </h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {coaches.map((coach, i) => (
                  <StaffMemberCard
                    key={i}
                    name={coach.name}
                    photoUrl={coach.photoUrl}
                    socialLinks={coach}
                    avatarColors={coachColors}
                  />
                ))}
              </div>
            </div>
          )}

          {captains.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-muted-foreground uppercase tracking-wider">
                Captains
              </h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {captains.map((captain, i) => (
                  <StaffMemberCard
                    key={i}
                    name={captain.name}
                    photoUrl={captain.photoUrl}
                    socialLinks={captain}
                    avatarColors={captainColors}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <p>No esports staff found.</p>
          <p className="text-sm mt-2">
            Make sure teams have managers, coaches, or captains assigned with linked People entries.
          </p>
          {process.env.NODE_ENV === 'development' && debugInfo && (
            <div className="text-xs mt-4 space-y-1">
              <p>Debug: {debugInfo.totalTeams} teams loaded</p>
              <p>Managers before filter: {debugInfo.managersBeforeFilter}</p>
              <p>Coaches before filter: {debugInfo.coachesBeforeFilter}</p>
              <p>Captains before filter: {debugInfo.captainsBeforeFilter}</p>
              <p>Valid managers: {debugInfo.validManagers}</p>
              <p>Valid coaches: {debugInfo.validCoaches}</p>
              <p>Valid captains: {debugInfo.validCaptains}</p>
            </div>
          )}
          <p className="text-sm mt-4">
            If you just seeded the database, try refreshing the page or re-running the seed script
            from the admin dashboard.
          </p>
        </div>
      )}
    </div>
  )
}

