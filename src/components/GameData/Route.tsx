import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import React from 'react'
import { redirect } from 'next/navigation'
import GameDataView from '@/components/GameData'

/** /admin/game-data: Heroes and Maps in one tabbed page. Anyone who can read heroes or maps may open it. */
const GameDataRoute: React.FC<AdminViewServerProps> = ({ initPageResult, params, searchParams }) => {
  const user = initPageResult.req.user
  const visible = initPageResult.visibleEntities.collections
  if (!user || !(visible.includes('heroes') || visible.includes('maps'))) redirect('/admin')

  return (
    <DefaultTemplate
      i18n={initPageResult.req.i18n}
      locale={initPageResult.locale}
      params={params}
      payload={initPageResult.req.payload}
      permissions={initPageResult.permissions}
      req={initPageResult.req}
      searchParams={searchParams}
      user={user}
      viewActions={[]}
      visibleEntities={initPageResult.visibleEntities}
    >
      <GameDataView />
    </DefaultTemplate>
  )
}

export default GameDataRoute
