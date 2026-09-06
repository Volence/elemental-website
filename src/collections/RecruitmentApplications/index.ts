import type { CollectionConfig } from 'payload'
import { adminOnly, teamScoped } from '@/access'

export const RecruitmentApplications: CollectionConfig = {
  slug: 'recruitment-applications',
  labels: {
    singular: 'Recruitment Application',
    plural: 'Recruitment Applications',
  },
  access: {
    // Staff see all applications; team-access people see only their teams' applications
    // (via the listing's team).
    read: teamScoped('listing.team'),
    // Public API endpoint handles creation (see /api/recruitment/apply)
    create: () => false,
    // Team-access people (for their teams) and staff can update
    update: teamScoped('listing.team'),
    // Only admins can delete
    delete: adminOnly,
  },
  admin: {
    // Scouting & Recruitment retired 2026-09 (data kept). Reachable by URL for admins only.
    hidden: () => true,
    useAsTitle: 'discordHandle',
    defaultColumns: ['position', 'discordHandle', 'status', 'createdAt', 'actions'],
    description: 'Review and manage recruitment applications.',
    group: 'Data',
  },
  fields: [
    {
      name: 'listing',
      type: 'relationship',
      relationTo: 'recruitment-listings',
      required: true,
      hasMany: false,
      admin: {
        description: 'Which listing this application is for',
      },
    },
    {
      name: 'discordHandle',
      type: 'text',
      required: true,
      admin: {
        description: 'Applicant\'s Discord username',
      },
    },
    {
      name: 'aboutMe',
      type: 'textarea',
      required: true,
      admin: {
        description: 'Applicant\'s introduction and why they want to join',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'new',
      options: [
        { label: 'New', value: 'new' },
        { label: 'Reviewing', value: 'reviewing' },
        { label: 'Contacted', value: 'contacted' },
        { label: 'Tryout', value: 'tryout' },
        { label: 'Accepted', value: 'accepted' },
        { label: 'Rejected', value: 'rejected' },
      ],
      admin: {
        description: 'Current status of this application',
      },
    },
    {
      name: 'internalNotes',
      type: 'textarea',
      admin: {
        description: 'Internal notes visible only to managers and admins (not shown to applicant)',
      },
    },
    {
      name: 'archived',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Archive old applications to hide them from active list',
        position: 'sidebar',
      },
    },
    // UI fields for custom list columns
    {
      name: 'listingDisplay',
      type: 'ui',
      admin: {
        components: {
          Cell: '@/components/RecruitmentListColumns/ListingCell#default',
        },
      },
    },
    {
      name: 'position',
      type: 'ui',
      admin: {
        components: {
          Cell: '@/components/RecruitmentApplicationColumns/PositionCell#default',
        },
      },
    },
    {
      name: 'actions',
      type: 'ui',
      admin: {
        components: {
          Cell: '@/components/RecruitmentApplicationColumns/ActionsCell#default',
        },
      },
    },
  ],
  timestamps: true,
}

