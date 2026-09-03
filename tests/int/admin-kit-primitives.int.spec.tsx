import React, { useState } from 'react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'

// next/navigation and Payload's step nav need providers we do not have in jsdom.
const replace = vi.fn()
const push = vi.fn()
let search = ''
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push }),
  usePathname: () => '/admin/pug-dashboard',
  useSearchParams: () => new URLSearchParams(search),
}))
const setStepNav = vi.fn()
vi.mock('@payloadcms/ui', () => ({ useStepNav: () => ({ setStepNav }) }))

import { AdminTabs, tabPanelProps } from '@/admin-kit/AdminTabs'
import { AdminPageHeader } from '@/admin-kit/AdminPageHeader'
import { AdminTable, AdminPagination } from '@/admin-kit/AdminTable'
import { Badge } from '@/admin-kit/Badge'
import { SearchInput } from '@/admin-kit/SearchInput'
import { Avatar } from '@/admin-kit/Avatar'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  search = ''
})

const TABS = [
  { id: 'lobbies', label: 'Lobbies' },
  { id: 'players', label: 'Players' },
  { id: 'hidden', label: 'Hidden', hidden: true },
  { id: 'seasons', label: 'Seasons' },
]

describe('AdminTabs', () => {
  it('renders real tab semantics and skips hidden tabs', () => {
    render(<AdminTabs mode="state" tabs={TABS} active="players" onChange={() => {}} />)
    const list = screen.getByRole('tablist')
    const tabs = screen.getAllByRole('tab')
    expect(list).toBeTruthy()
    expect(tabs.map((t) => t.textContent)).toEqual(['Lobbies', 'Players', 'Seasons'])
    const active = tabs[1]
    expect(active.getAttribute('aria-selected')).toBe('true')
    expect(active.getAttribute('aria-controls')).toBeTruthy()
    expect(tabs[0].getAttribute('aria-selected')).toBe('false')
    // Roving tabindex: only the active tab is reachable by Tab.
    expect(active.getAttribute('tabindex')).toBe('0')
    expect(tabs[0].getAttribute('tabindex')).toBe('-1')
  })

  it('moves with arrow keys, wraps, and supports Home and End', () => {
    function Harness() {
      const [active, setActive] = useState('lobbies')
      return <AdminTabs mode="state" tabs={TABS} active={active} onChange={setActive} id="t" />
    }
    render(<Harness />)
    const [lobbies, players, seasons] = screen.getAllByRole('tab')
    lobbies.focus()
    fireEvent.keyDown(lobbies, { key: 'ArrowRight' })
    expect(players.getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(players)
    fireEvent.keyDown(players, { key: 'End' })
    expect(seasons.getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(seasons, { key: 'ArrowRight' })
    expect(lobbies.getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(lobbies, { key: 'ArrowLeft' })
    expect(seasons.getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(seasons, { key: 'Home' })
    expect(lobbies.getAttribute('aria-selected')).toBe('true')
  })

  it('url mode reads ?tab= and writes it back with router.replace', () => {
    search = 'tab=seasons'
    render(<AdminTabs mode="url" tabs={TABS} defaultTab="lobbies" />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs[2].getAttribute('aria-selected')).toBe('true')
    fireEvent.click(tabs[1])
    expect(replace).toHaveBeenCalledWith('/admin/pug-dashboard?tab=players', { scroll: false })
    // Selecting the default removes the param so the canonical URL stays clean.
    fireEvent.click(tabs[0])
    expect(replace).toHaveBeenLastCalledWith('/admin/pug-dashboard', { scroll: false })
  })

  it('tabPanelProps links a panel back to its tab', () => {
    const props = tabPanelProps('t', 'players')
    expect(props.role).toBe('tabpanel')
    expect(props.id).toBe('t-panel-players')
    expect(props['aria-labelledby']).toBe('t-tab-players')
  })
})

describe('AdminPageHeader', () => {
  it('sets the document title and renders breadcrumbs with aria-current', () => {
    render(
      <AdminPageHeader
        title="PUG Dashboard"
        subtitle="Lobbies and seasons"
        breadcrumbs={[{ label: 'Competition', href: '/admin/competition' }, { label: 'PUG Dashboard' }]}
      />,
    )
    expect(document.title).toBe('PUG Dashboard - Elemental Admin')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('PUG Dashboard')
    const current = screen.getByText('PUG Dashboard', { selector: '[aria-current="page"]' })
    expect(current).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Competition' }).getAttribute('href')).toBe('/admin/competition')
    expect(setStepNav).toHaveBeenCalledWith([
      { label: 'Competition', url: '/admin/competition' },
      { label: 'PUG Dashboard', url: undefined },
    ])
  })
})

describe('Badge', () => {
  it('maps tone to a class and never accepts a raw colour', () => {
    render(<Badge tone="success" dot>Complete</Badge>)
    const el = screen.getByText('Complete')
    expect(el.className).toContain('kit-badge--success')
    expect(el.querySelector('.kit-badge__dot')).toBeTruthy()
  })
})

describe('SearchInput', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('debounces onChange, clears immediately, and is a search input', () => {
    const onChange = vi.fn()
    render(<SearchInput value="" onChange={onChange} placeholder="Search players" debounceMs={300} />)
    const input = screen.getByRole('searchbox') as HTMLInputElement
    expect(input.type).toBe('search')
    fireEvent.change(input, { target: { value: 'ab' } })
    fireEvent.change(input, { target: { value: 'abc' } })
    expect(onChange).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(300) })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('abc')

    fireEvent.click(screen.getByLabelText('Clear search'))
    expect(onChange).toHaveBeenLastCalledWith('')
    expect(input.value).toBe('')
  })

  it('Escape clears when there is text', () => {
    const onChange = vi.fn()
    render(<SearchInput value="" onChange={onChange} />)
    const input = screen.getByRole('searchbox') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'x' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(input.value).toBe('')
    expect(onChange).toHaveBeenLastCalledWith('')
  })
})

describe('Avatar', () => {
  it('falls back to two-letter initials and sizes Discord avatars', () => {
    const { rerender } = render(<Avatar name="Jane Doe" size={32} />)
    expect(screen.getByRole('img', { name: 'Jane Doe' }).textContent).toBe('JD')
    rerender(<Avatar name="Jane Doe" size={32} src="https://cdn.discordapp.com/avatars/1/a.png" />)
    const img = screen.getByAltText('Jane Doe') as HTMLImageElement
    expect(img.getAttribute('src')).toContain('size=64')
    expect(img.getAttribute('width')).toBe('32')
    expect(img.getAttribute('loading')).toBe('lazy')
  })
})

describe('AdminTable', () => {
  type Row = { id: number; name: string; rating: number }
  const rows: Row[] = [
    { id: 1, name: 'Alpha', rating: 4200 },
    { id: 2, name: 'Beta', rating: 3900 },
  ]
  const columns = [
    { key: 'name', header: 'Name', sortable: true },
    { key: 'rating', header: 'Rating', align: 'right' as const, sortable: true },
  ]

  it('right-aligns numeric columns, exposes aria-sort, and renders row links', () => {
    const onSort = vi.fn()
    render(
      <AdminTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        sort={{ key: 'rating', direction: 'desc' }}
        onSort={onSort}
        rowHref={(r) => `/admin/teams/${r.id}`}
        aria-label="Teams"
      />,
    )
    const headers = screen.getAllByRole('columnheader')
    expect(headers[1].getAttribute('aria-sort')).toBe('descending')
    expect(headers[0].getAttribute('aria-sort')).toBe('none')
    expect((headers[1] as HTMLElement).style.textAlign).toBe('right')

    // First cell of each row is a real link so middle click and "open in new tab" work.
    expect(screen.getByRole('link', { name: 'Alpha' }).getAttribute('href')).toBe('/admin/teams/1')

    fireEvent.click(screen.getByRole('button', { name: /Rating/ }))
    expect(onSort).toHaveBeenCalledWith('rating', 'asc')

    // Clicking elsewhere in the row navigates via the router.
    fireEvent.click(screen.getByText('3900'))
    expect(push).toHaveBeenCalledWith('/admin/teams/2')
  })

  it('renders an empty state inside the body when there are no rows', () => {
    render(<AdminTable columns={columns} rows={[]} rowKey={(r: Row) => r.id} emptyTitle="No players match" />)
    expect(screen.getByText('No players match')).toBeTruthy()
  })

  it('keyboard-activates button rows', () => {
    const onRowClick = vi.fn()
    render(<AdminTable columns={columns} rows={rows} rowKey={(r) => r.id} onRowClick={onRowClick} />)
    const row = screen.getAllByRole('button').find((b) => b.tagName === 'TR')!
    expect(row.getAttribute('tabindex')).toBe('0')
    fireEvent.keyDown(row, { key: 'Enter' })
    expect(onRowClick).toHaveBeenCalledWith(rows[0])
  })
})

describe('AdminPagination', () => {
  it('shows the range and disables the edges', () => {
    const onPage = vi.fn()
    render(<AdminPagination page={1} pageSize={25} total={60} onPage={onPage} />)
    expect(screen.getByText('1 to 25 of 60')).toBeTruthy()
    expect((screen.getByLabelText('Previous page') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByLabelText('Next page'))
    expect(onPage).toHaveBeenCalledWith(2)
  })
})
