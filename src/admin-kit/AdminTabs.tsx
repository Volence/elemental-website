'use client'

import React, { useCallback, useId, useRef, useState } from 'react'
import { useUrlParamState } from './hooks'

export interface AdminTab {
  id: string
  label: React.ReactNode
  icon?: React.ReactNode
  /** Omit the tab entirely (role gating). */
  hidden?: boolean
  /** Small count or status shown after the label. */
  badge?: React.ReactNode
  description?: string
}

export type AdminTabsAccent = 'info' | 'primary' | 'warning' | 'success'

interface CommonProps {
  tabs: AdminTab[]
  accent?: AdminTabsAccent
  /** aria-label for the tablist. */
  label?: string
  className?: string
  /** Stable id prefix so panels can point back with aria-labelledby. */
  id?: string
}

interface UrlModeProps extends CommonProps {
  /** Active tab lives in `?${param}=`; back button and deep links work. */
  mode: 'url'
  param?: string
  defaultTab: string
  onChange?: (id: string) => void
}

interface StateModeProps extends CommonProps {
  /** Controlled: caller owns the active id. */
  mode: 'state'
  active: string
  onChange: (id: string) => void
}

export type AdminTabsProps = UrlModeProps | StateModeProps

export function tabId(prefix: string, id: string) {
  return `${prefix}-tab-${id}`
}

export function tabPanelId(prefix: string, id: string) {
  return `${prefix}-panel-${id}`
}

/** Props to spread on the element that renders the active tab's content. */
export function tabPanelProps(prefix: string, id: string) {
  return { role: 'tabpanel' as const, id: tabPanelId(prefix, id), 'aria-labelledby': tabId(prefix, id), tabIndex: 0 }
}

function UrlTabs(props: UrlModeProps) {
  const [active, setActive] = useUrlParamState(props.param ?? 'tab', props.defaultTab)
  const onChange = useCallback(
    (id: string) => {
      setActive(id)
      props.onChange?.(id)
    },
    [setActive, props],
  )
  return <TabList {...props} active={active} onChange={onChange} />
}

function TabList({
  tabs,
  active,
  onChange,
  accent = 'info',
  label = 'Sections',
  className,
  id,
}: CommonProps & { active: string; onChange: (id: string) => void }) {
  const autoId = useId()
  const prefix = id ?? autoId
  const visible = tabs.filter((t) => !t.hidden)
  const listRef = useRef<HTMLDivElement | null>(null)
  // Roving focus: only the active tab is in the tab order; arrows move between tabs.
  const [focusedId, setFocusedId] = useState<string | null>(null)

  const focusTab = (tab: AdminTab) => {
    setFocusedId(tab.id)
    onChange(tab.id)
    const el = listRef.current?.querySelector<HTMLElement>(`#${cssEscape(tabId(prefix, tab.id))}`)
    el?.focus()
  }

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    let next: number | null = null
    if (event.key === 'ArrowRight') next = (index + 1) % visible.length
    else if (event.key === 'ArrowLeft') next = (index - 1 + visible.length) % visible.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = visible.length - 1
    if (next === null) return
    event.preventDefault()
    focusTab(visible[next])
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      className={`kit-tabs kit-tabs--${accent}${className ? ` ${className}` : ''}`}
    >
      {visible.map((tab, index) => {
        const selected = tab.id === active
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={tabId(prefix, tab.id)}
            aria-selected={selected}
            aria-controls={tabPanelId(prefix, tab.id)}
            tabIndex={selected || focusedId === tab.id ? 0 : -1}
            title={tab.description}
            className={`kit-tabs__tab${selected ? ' kit-tabs__tab--active' : ''}`}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => onKeyDown(e, index)}
            onBlur={() => setFocusedId(null)}
          >
            {tab.icon && <span className="kit-tabs__icon">{tab.icon}</span>}
            <span className="kit-tabs__label">{tab.label}</span>
            {tab.badge != null && <span className="kit-tabs__badge">{tab.badge}</span>}
          </button>
        )
      })}
    </div>
  )
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value)
  return value.replace(/([^a-zA-Z0-9_-])/g, '\\$1')
}

/**
 * One tab bar for every dashboard. Real tab semantics (tablist / tab /
 * aria-selected / aria-controls), arrow-key navigation, and an optional URL
 * mode so the active tab survives reloads and the back button.
 */
export function AdminTabs(props: AdminTabsProps) {
  if (props.mode === 'url') return <UrlTabs {...props} />
  return <TabList {...props} />
}

export default AdminTabs
