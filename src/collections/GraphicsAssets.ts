import type { CollectionConfig } from 'payload'

import path from 'path'
import { fileURLToPath } from 'url'
import type { AccessArgs } from 'payload'
import type { User } from '@/payload-types'
import { UserRole } from '../access/roles'

/**
 * Hide graphics collection from users who have no business seeing it.
 * Show it to: admins, staff-managers, team-managers, and anyone with isGraphicsStaff department flag.
 * Hide from: plain users and players WITHOUT graphics department access.
 */
const hideGraphicsFromNonStaff = ({ user }: { user: any }): boolean => {
  if (!user) return false
  const role = user.role as string
  
  // Always show for privileged roles
  if (role === UserRole.ADMIN || role === UserRole.STAFF_MANAGER || role === UserRole.TEAM_MANAGER) {
    return false
  }
  
  // Show for users with graphics department flag
  if (user.departments?.isGraphicsStaff === true) {
    return false
  }
  
  // Hide from everyone else (players, plain users without graphics access)
  return true
}

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

/**
 * Access: Graphics assets are publicly readable (needed for team logos, etc.)
 * Write access restricted to graphics staff, staff managers, and admins
 */
const canReadGraphicsAssets = (): boolean => {
  // Allow public read access for graphics assets (team logos, etc.)
  return true
}

const canWriteGraphicsAssets = ({ req: { user } }: AccessArgs<User>): boolean => {
  if (!user) return false
  const u = user as User
  
  // Admins and staff managers always have full access
  if (u.role === UserRole.ADMIN || u.role === UserRole.STAFF_MANAGER) return true
  
  // Graphics staff can write
  if (u.departments?.isGraphicsStaff === true) return true
  
  // Team managers can only read, not write
  return false
}

export const GraphicsAssets: CollectionConfig = {
  slug: 'graphics-assets',
  labels: {
    singular: 'File',
    plural: 'Files',
  },
  folders: true, // Enable hierarchical folder organization
  admin: {
    description: '📁 Graphics department file library. Drag & drop files, create folders to organize.',
    group: 'Graphics',
    hidden: hideGraphicsFromNonStaff,
    useAsTitle: 'filename',
    components: {
      views: {
        list: {
          Component: '@/components/FileBrowser/FileBrowserView',
        },
      },
    },
  },
  access: {
    create: canWriteGraphicsAssets,
    read: canReadGraphicsAssets,
    update: canWriteGraphicsAssets,
    delete: canWriteGraphicsAssets,
  },
  // No custom fields - just pure file upload like a filesystem
  fields: [],
  upload: {
    // Store graphics assets separately from general media
    staticDir: path.resolve(dirname, '../../public/graphics-assets'),
    adminThumbnail: 'thumbnail',
    focalPoint: false, // Disable for simpler file management
    imageSizes: [
      {
        name: 'thumbnail',
        width: 300,
      },
    ],
  },
}
