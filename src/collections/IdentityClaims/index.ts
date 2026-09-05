import type { CollectionConfig } from 'payload'
import { adminOnly, staffManagerOrAbove, withAccess, hideUnless } from '@/access'

export const IdentityClaims: CollectionConfig = {
  slug: 'identity-claims',
  labels: { singular: 'Identity Claim', plural: 'Identity Claims' },
  admin: {
    group: 'Organization',
    hidden: hideUnless((a) => a.canManagePeople),
    defaultColumns: ['claimant', 'target', 'status', 'createdAt'],
    description: 'Requests from Discord-created accounts to take over a legacy person row. Reviewed on /admin/identity.',
  },
  access: {
    // Claimants create through POST /api/identity/claims (overrideAccess); nobody creates from the admin UI.
    create: () => false,
    read: withAccess((a, { req }) => a.canManagePeople || { claimant: { equals: req.user!.id } }),
    update: staffManagerOrAbove,
    delete: adminOnly,
  },
  fields: [
    { name: 'claimant', type: 'relationship', relationTo: 'people', required: true, index: true },
    { name: 'target', type: 'relationship', relationTo: 'people', required: true, index: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Approved', value: 'approved' },
        { label: 'Declined', value: 'declined' },
      ],
    },
    { name: 'reviewer', type: 'relationship', relationTo: 'people' },
    { name: 'reviewedAt', type: 'date' },
    { name: 'note', type: 'textarea' },
    {
      name: 'discordSnapshot',
      type: 'json',
      admin: { description: 'Claimant Discord identity at claim time: username, displayName, accountCreatedAt, joinDates.' },
    },
  ],
}
