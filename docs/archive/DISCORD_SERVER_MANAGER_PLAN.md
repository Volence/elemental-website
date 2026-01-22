# Discord Server Manager Migration Plan

## Overview
Migrate the standalone discord-manager bot into the admin panel as an admin-only tool.

## Source Analysis
The existing discord-manager has:
- **Frontend**: React + TypeScript + Vite + Tailwind
- **Backend**: Express + Discord.js API
- **Features**:
  - Server structure management (channels, categories, roles)
  - Statistics dashboard
  - Health check system
  - Member management
  - Category templates (save/reuse)
  - Bulk operations
  - ~~Year in Review~~ (will be removed)

## Migration Strategy

### Phase 1: Infrastructure (Current)
1. Create Payload Global: `discord-server-manager`
2. Create API routes in Next.js:
   - `/api/discord/server/structure` - Get server structure
   - `/api/discord/server/stats` - Get statistics
   - `/api/discord/server/health` - Health check
   - `/api/discord/server/members` - Member management
   - `/api/discord/server/channels` - Channel operations
   - `/api/discord/server/categories` - Category operations
   - `/api/discord/server/roles` - Role operations
3. Add Discord service utilities for server management

### Phase 2: Core Components
1. Server structure viewer (channels, categories)
2. Channel creation/editing
3. Category management
4. Role viewer

### Phase 3: Advanced Features
1. Statistics dashboard
2. Health check system
3. Member management
4. Category templates
5. Bulk operations

### Phase 4: Polish
1. Add to Discord sidebar group
2. Admin-only access control
3. Keyboard shortcuts
4. Search functionality

## Implementation Order
1. ✅ Setup infrastructure (Global, API routes, services)
2. Server structure display
3. Channel/category CRUD
4. Statistics & health check
5. Member management
6. Templates & bulk ops
7. UI polish

## Notes
- Will NOT migrate Year in Review feature
- Will use existing Discord bot client
- Admin-only access (no Team Manager access)
- Keep UI consistent with Clean Glow design system
