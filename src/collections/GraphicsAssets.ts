import type { CollectionConfig } from 'payload'

import path from 'path'
import { fileURLToPath } from 'url'
import { anyone, department, hideUnless } from '@/access'

/**
 * Hide graphics collection from users who have no business seeing it.
 * Show it to: admins, staff-managers, anyone with isGraphicsStaff department flag, and
 * anyone with team access (the old team-manager role carve-out, translated to teamIds).
 * Hide from: plain users and players WITHOUT graphics department or team access.
 */
const hideGraphicsFromNonStaff = hideUnless((a) => a.departments.graphics !== 'none' || a.teamIds.size > 0)

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

/**
 * Access: Graphics assets are publicly readable (needed for team logos, etc.)
 * Write access restricted to graphics staff, staff managers, and admins
 */
const canReadGraphicsAssets = anyone

const canWriteGraphicsAssets = department('graphics')

export const GraphicsAssets: CollectionConfig = {
  slug: 'graphics-assets',
  labels: {
    singular: 'File',
    plural: 'Files',
  },
  folders: true, // Enable hierarchical folder organization
  admin: {
    description: 'Graphics department file library. Drag & drop files, create folders to organize.',
    group: 'Data',
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
    staticDir: path.resolve(dirname, '../../public/graphics-assets'),
    adminThumbnail: 'thumbnail',
    focalPoint: false,
    mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/avif', 'image/tiff', 'application/pdf', 'application/postscript', 'image/vnd.adobe.photoshop'],
    imageSizes: [
      {
        name: 'thumbnail',
        width: 300,
      },
    ],
  },
}
