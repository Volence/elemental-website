import type { CollectionConfig } from 'payload'
import { UserRole } from '../access/roles'
import type { User } from '@/payload-types'

export const QuickScrims: CollectionConfig = {
  slug: 'quick-scrims',
  labels: {
    singular: 'Quick Scrim',
    plural: 'Quick Scrims',
  },
  admin: {
    group: 'Scheduling',
    useAsTitle: 'title',
    defaultColumns: ['title', 'team', 'scrimDate', 'createdAt'],
    description: 'Post scrim announcements for teams with fixed schedules (no poll needed)',
  },
  access: {
    // Team managers see only their team's scrims, admins/staff managers see all
    read: ({ req }) => {
      const user = req.user as User | undefined
      if (!user) return false
      
      // Admins and Staff Managers can see all
      if (user.role === UserRole.ADMIN || user.role === UserRole.STAFF_MANAGER) {
        return true
      }
      
      // Team Managers can only see their assigned teams
      if (user.role === UserRole.TEAM_MANAGER) {
        const assignedTeams = user.assignedTeams
        if (!assignedTeams || !Array.isArray(assignedTeams) || assignedTeams.length === 0) {
          return false
        }
        
        const teamIds = assignedTeams.map((team: any) =>
          typeof team === 'object' && team !== null ? team.id : team,
        )
        
        return {
          team: { in: teamIds },
        }
      }
      
      return false
    },
    create: ({ req }) => {
      const user = req.user as User | undefined
      if (!user) return false
      return [UserRole.ADMIN, UserRole.STAFF_MANAGER, UserRole.TEAM_MANAGER].includes(user.role as UserRole)
    },
    update: ({ req }) => {
      const user = req.user as User | undefined
      if (!user) return false
      return [UserRole.ADMIN, UserRole.STAFF_MANAGER, UserRole.TEAM_MANAGER].includes(user.role as UserRole)
    },
    delete: ({ req }) => {
      const user = req.user as User | undefined
      if (!user) return false
      return [UserRole.ADMIN, UserRole.STAFF_MANAGER].includes(user.role as UserRole)
    },
  },
  fields: [
    // Auto-generated title
    {
      name: 'title',
      type: 'text',
      admin: {
        hidden: true,
      },
      hooks: {
        beforeChange: [
          ({ data }) => {
            if (data?.scrimDate) {
              const date = new Date(data.scrimDate)
              return `Scrim - ${date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`
            }
            return 'Quick Scrim'
          },
        ],
      },
    },
    {
      name: 'team',
      type: 'relationship',
      relationTo: 'teams',
      required: true,
      admin: {
        position: 'sidebar',
      },
      // Filter to only show assigned teams for team managers
      filterOptions: ({ user }) => {
        if (!user) return false
        if (user.role === UserRole.ADMIN || user.role === UserRole.STAFF_MANAGER) {
          return true // Show all teams
        }
        if (user.role === UserRole.TEAM_MANAGER && user.assignedTeams?.length) {
          const teamIds = (user.assignedTeams as any[]).map((t) =>
            typeof t === 'object' ? t.id : t,
          )
          return { id: { in: teamIds } }
        }
        return false
      },
    },
    {
      name: 'scrimDate',
      type: 'date',
      required: true,
      admin: {
        position: 'sidebar',
        date: {
          pickerAppearance: 'dayOnly',
          displayFormat: 'EEEE, MMM d',
        },
      },
    },
    {
      name: 'scrimTime',
      type: 'text',
      required: true,
      defaultValue: '8-10 EST',
      admin: {
        position: 'sidebar',
        placeholder: 'e.g., 8-10 EST',
      },
    },
    // Roster - role dropdown + team roster selection or ringer name
    {
      name: 'roster',
      type: 'array',
      minRows: 1,
      admin: {
        description: 'Players for this scrim. Select from team roster or check "Ringer" to pick anyone.',
      },
      fields: [
        {
          name: 'role',
          type: 'select',
          required: true,
          options: [
            { label: 'Tank', value: 'tank' },
            { label: 'DPS', value: 'dps' },
            { label: 'Flex DPS', value: 'fdps' },
            { label: 'Hitscan', value: 'hitscan' },
            { label: 'Support', value: 'support' },
            { label: 'Main Support', value: 'ms' },
            { label: 'Flex Support', value: 'fs' },
          ],
          admin: {
            width: '25%',
          },
        },
        {
          name: 'isRinger',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Ringer (show all players)',
            width: '15%',
          },
        },
        {
          name: 'rosterPlayer',
          type: 'relationship',
          relationTo: 'people',
          admin: {
            width: '60%',
            condition: (data, siblingData) => !siblingData?.isRinger,
            description: 'Select from team roster',
          },
          // Filter to only show people on the selected team's roster
          // Also exclude players already selected in other roster rows
          filterOptions: async ({ data, req, siblingData }) => {
            // Get the team ID from form data
            const teamId = typeof data?.team === 'object' ? data.team?.id : data?.team
            if (!teamId) {
              return true // Show all if no team selected
            }
            
            try {
              // Fetch the team with roster populated
              const team = await req.payload.findByID({
                collection: 'teams',
                id: teamId,
                depth: 1,
              })
              
              if (!team) {
                return true
              }
              
              // Extract roster player IDs from the team
              const rosterPlayerIds: number[] = []
              
              // Get players from roster array
              if (team.roster && Array.isArray(team.roster)) {
                for (const entry of team.roster) {
                  const personId = typeof entry.person === 'object' ? (entry.person as any)?.id : entry.person
                  if (personId) rosterPlayerIds.push(personId)
                }
              }
              
              // Also include subs
              if (team.subs && Array.isArray(team.subs)) {
                for (const entry of team.subs) {
                  const personId = typeof entry.person === 'object' ? (entry.person as any)?.id : entry.person
                  if (personId) rosterPlayerIds.push(personId)
                }
              }
              
              if (rosterPlayerIds.length === 0) {
                return true // Show all if no roster found
              }
              
              // Get IDs of players already selected in other roster rows
              const alreadySelectedIds: number[] = []
              const sibling = siblingData as any
              const currentPlayerId = typeof sibling?.rosterPlayer === 'object' 
                ? sibling.rosterPlayer?.id 
                : sibling?.rosterPlayer
              
              if (data?.roster && Array.isArray(data.roster)) {
                for (const entry of data.roster) {
                  if (!entry.isRinger && entry.rosterPlayer) {
                    const playerId = typeof entry.rosterPlayer === 'object' 
                      ? (entry.rosterPlayer as any)?.id 
                      : entry.rosterPlayer
                    // Don't exclude the current row's selection
                    if (playerId && playerId !== currentPlayerId) {
                      alreadySelectedIds.push(playerId)
                    }
                  }
                }
              }
              
              // Filter: must be in roster AND not already selected
              const availablePlayerIds = rosterPlayerIds.filter(id => !alreadySelectedIds.includes(id))
              
              if (availablePlayerIds.length === 0) {
                // All players selected, show none (or could show message)
                return { id: { in: [-1] } } // No valid IDs match -1
              }
              
              return {
                id: { in: availablePlayerIds },
              }
            } catch (error) {
              console.error('Error filtering roster players:', error)
              return true
            }
          },
        },
        {
          name: 'rosterPlayerName',
          type: 'text',
          admin: {
            placeholder: 'Or type name',
            width: '20%',
            condition: (data, siblingData) => !siblingData?.isRinger,
          },
        },
        {
          name: 'ringerPlayer',
          type: 'relationship',
          relationTo: 'people',
          admin: {
            width: '45%',
            condition: (data, siblingData) => siblingData?.isRinger === true,
            description: 'Select any player',
          },
          // No filter - show all people
        },
        {
          name: 'ringerName',
          type: 'text',
          admin: {
            placeholder: 'Or type name',
            width: '15%',
            condition: (data, siblingData) => siblingData?.isRinger === true,
          },
        },
      ],
    },
    // Scrim details
    {
      name: 'opponent',
      type: 'text',
      admin: {
        placeholder: 'Opponent team name',
      },
    },
    {
      name: 'opponentRoster',
      type: 'textarea',
      admin: {
        placeholder: 'Enemy roster (e.g., Tank: Player1, DPS: Player2...)',
        description: 'Opponent team lineup',
      },
    },
    {
      name: 'host',
      type: 'select',
      options: [
        { label: 'We host', value: 'us' },
        { label: 'They host', value: 'them' },
      ],
    },
    {
      name: 'contact',
      type: 'text',
      admin: {
        placeholder: 'Opponent contact (Discord username)',
      },
    },
    {
      name: 'mapPool',
      type: 'text',
      admin: {
        placeholder: 'e.g., Faceit',
      },
    },
    {
      name: 'heroBans',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Hero bans enabled',
      },
    },
    {
      name: 'staggers',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Staggers enabled',
      },
    },
    {
      name: 'notes',
      type: 'text',
      admin: {
        placeholder: 'Any additional notes',
      },
    },
    // Post status
    {
      name: 'posted',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Posted to Discord',
      },
    },
    // Custom field for post button
    {
      name: 'postToDiscord',
      type: 'ui',
      admin: {
        components: {
          Field: '@/components/QuickScrimPost#default',
        },
      },
    },
  ],
}
