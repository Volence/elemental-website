import type { CollectionConfig } from 'payload'

import path from 'path'
import { fileURLToPath } from 'url'
import type { AccessArgs } from 'payload'
import type { User } from '@/payload-types'
import { UserRole } from '../access/roles'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

/**
 * Access: Graphics staff OR Staff managers can read and write
 * Team managers can read only
 * Admins always have full access
 */
const canReadGraphicsAssets = ({ req: { user } }: AccessArgs<User>): boolean => {
  if (!user) return false
  const u = user as User
  
  // Admins and staff managers always have access
  if (u.role === UserRole.ADMIN || u.role === UserRole.STAFF_MANAGER) return true
  
  // Team managers can read
  if (u.role === UserRole.TEAM_MANAGER) return true
  
  // Graphics staff can read
  if (u.departments?.isGraphicsStaff === true) return true
  
  return false
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
