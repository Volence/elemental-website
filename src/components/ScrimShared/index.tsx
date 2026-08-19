'use client'

/**
 * Shared building blocks for scrim analytics pages: breadcrumbs, back links,
 * loading/error/empty states, stat tiles, and URL-persisted UI state.
 *
 * Every scrim page previously re-implemented these per file (four different
 * "stat tile" components, five loading treatments, three back-link classes),
 * which is exactly why the pages all looked different.
 */

import React, { useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { SCRIM_COLORS } from './tokens'

/* ─── URL-persisted state ─── */

/**
 * useState backed by a URL search param (router.replace, no scroll reset).
 * Makes sub-tabs, filters, and selections bookmarkable and Back-safe.
 */
export function useUrlParamState(
  key: string,
  defaultValue: string,
): [string, (v: string) => void] {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const value = searchParams.get(key) ?? defaultValue

  const setValue = useCallback(
    (v: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (v === defaultValue) params.delete(key)
      else params.set(key, v)
      const qs = params.toString()
      router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false })
    },
    [key, defaultValue, pathname, router, searchParams],
  )

  return [value, setValue]
}

/* ─── Navigation ─── */

export function ScrimBreadcrumbs({
  items,
}: {
  items: { label: string; href?: string }[]
}) {
  return (
    <nav className="scrim-breadcrumbs" aria-label="Breadcrumb">
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="scrim-breadcrumbs__item">
          {i > 0 && <span className="scrim-breadcrumbs__sep">/</span>}
          {item.href ? (
            <Link href={item.href} className="scrim-breadcrumbs__link">
              {item.label}
            </Link>
          ) : (
            <span className="scrim-breadcrumbs__current">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="scrim-back-link">
      <ArrowLeft size={12} /> {label}
    </Link>
  )
}

/* ─── States ─── */

export function LoadingCard({ message = 'Loading…' }: { message?: string }) {
  return (
    <div className="scrim-loading">
      <Loader2
        size={18}
        style={{ animation: 'spin 1s linear infinite', verticalAlign: '-3px', marginRight: 8 }}
      />
      {message}
    </div>
  )
}

export function ErrorCard({
  message,
  backHref,
  backLabel,
}: {
  message: string
  backHref?: string
  backLabel?: string
}) {
  return (
    <div className="scrim-loading" role="alert">
      <div style={{ color: SCRIM_COLORS.redSoft, marginBottom: 12 }}>{message}</div>
      {backHref && <BackLink href={backHref} label={backLabel ?? 'Back'} />}
    </div>
  )
}

export function EmptyCard({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="scrim-loading">
      <div>{message}</div>
      {hint && (
        <div style={{ fontSize: 12, color: SCRIM_COLORS.textFaint, marginTop: 6 }}>{hint}</div>
      )}
    </div>
  )
}

/* ─── Stat tile ─── */

export function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  color?: string
}) {
  return (
    <div
      className="scrim-stat-card"
      style={{
        background: SCRIM_COLORS.bgCard,
        border: `1px solid ${SCRIM_COLORS.bgCardBorder}`,
        borderRadius: 10,
        padding: '14px 16px',
      }}
    >
      <div
        style={{
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: SCRIM_COLORS.textMuted,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color ?? SCRIM_COLORS.textPrimary }}>
        {value}
      </div>
      {sub != null && (
        <div style={{ fontSize: 11, color: SCRIM_COLORS.textFaint, marginTop: 4 }}>{sub}</div>
      )}
    </div>
  )
}
