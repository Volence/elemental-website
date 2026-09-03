'use client'

import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { EmptyState } from './states'

export type SortDirection = 'asc' | 'desc'

export interface AdminTableColumn<Row> {
  key: string
  header: React.ReactNode
  /** Numbers are right-aligned and use tabular figures. */
  align?: 'left' | 'right' | 'center'
  width?: string | number
  /** Custom cell. Defaults to `row[key]`. */
  render?: (row: Row, index: number) => React.ReactNode
  sortable?: boolean
  /** Hide below 768px to keep the table usable on phones. */
  hideOnMobile?: boolean
  /** Keep the cell on one line (dates, statuses, short codes). */
  nowrap?: boolean
}

export interface AdminTableProps<Row> {
  columns: AdminTableColumn<Row>[]
  rows: Row[]
  rowKey: (row: Row) => string | number
  sort?: { key: string; direction: SortDirection }
  onSort?: (key: string, direction: SortDirection) => void
  /** Row becomes a link: the first cell renders an <a> so middle click works. */
  rowHref?: (row: Row) => string | undefined
  /** Row becomes a button (Enter and Space activate). Prefer rowHref when the target is a page. */
  onRowClick?: (row: Row) => void
  loading?: boolean
  /** Rendered inside the table body when there are no rows. */
  empty?: React.ReactNode
  emptyTitle?: React.ReactNode
  emptyHint?: React.ReactNode
  /** Sticky header inside its scroll container (default true). */
  stickyHeader?: boolean
  dense?: boolean
  className?: string
  'aria-label'?: string
  footer?: React.ReactNode
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  return !!el?.closest('a, button, input, select, textarea, [role="button"], [data-no-row-click]')
}

/**
 * One data table. Scroll wrapper, sticky head, right-aligned numbers, sortable
 * headers with aria-sort, and rows that are real links or real buttons.
 */
export function AdminTable<Row>({
  columns,
  rows,
  rowKey,
  sort,
  onSort,
  rowHref,
  onRowClick,
  loading,
  empty,
  emptyTitle = 'Nothing here yet',
  emptyHint,
  stickyHeader = true,
  dense,
  className,
  footer,
  ...rest
}: AdminTableProps<Row>) {
  const router = useRouter()
  const interactive = !!rowHref || !!onRowClick

  const handleSort = (col: AdminTableColumn<Row>) => {
    if (!col.sortable || !onSort) return
    const next: SortDirection = sort?.key === col.key && sort.direction === 'asc' ? 'desc' : 'asc'
    onSort(col.key, next)
  }

  const activate = (row: Row) => {
    const href = rowHref?.(row)
    if (href) router.push(href)
    else onRowClick?.(row)
  }

  return (
    <div className={`kit-table-wrap${className ? ` ${className}` : ''}`}>
      <table
        className={`kit-table${stickyHeader ? ' kit-table--sticky' : ''}${dense ? ' kit-table--dense' : ''}${interactive ? ' kit-table--interactive' : ''}`}
        aria-label={rest['aria-label']}
        aria-busy={loading || undefined}
      >
        <thead>
          <tr>
            {columns.map((col) => {
              const sorted = sort?.key === col.key
              const ariaSort = sorted ? (sort!.direction === 'asc' ? 'ascending' : 'descending') : col.sortable ? 'none' : undefined
              return (
                <th
                  key={col.key}
                  scope="col"
                  style={{ width: col.width, textAlign: col.align ?? 'left' }}
                  className={`kit-table__th${col.align ? ` kit-table__th--${col.align}` : ''}${col.hideOnMobile ? ' kit-table__th--hide-mobile' : ''}`}
                  aria-sort={ariaSort}
                >
                  {col.sortable && onSort ? (
                    <button type="button" className="kit-table__sort" onClick={() => handleSort(col)}>
                      <span>{col.header}</span>
                      {sorted ? (
                        sort!.direction === 'asc' ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />
                      ) : (
                        <ArrowUpDown size={12} aria-hidden="true" className="kit-table__sort-idle" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {loading && rows.length === 0 &&
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={`skeleton-${i}`} className="kit-table__skeleton-row" aria-hidden="true">
                {columns.map((col) => (
                  <td key={col.key}>
                    <div className="kit-skeleton" />
                  </td>
                ))}
              </tr>
            ))}
          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="kit-table__empty">
                {empty ?? <EmptyState compact title={emptyTitle} hint={emptyHint} />}
              </td>
            </tr>
          )}
          {rows.map((row, rowIndex) => {
            const href = rowHref?.(row)
            const rowProps: React.HTMLAttributes<HTMLTableRowElement> = {}
            if (interactive) {
              rowProps.onClick = (e) => {
                if (isInteractiveTarget(e.target)) return
                // Modified clicks (new tab, select) keep their browser meaning.
                if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
                activate(row)
              }
              if (!href && onRowClick) {
                rowProps.role = 'button'
                rowProps.tabIndex = 0
                rowProps.onKeyDown = (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onRowClick(row)
                  }
                }
              }
            }
            return (
              <tr key={rowKey(row)} {...rowProps}>
                {columns.map((col, colIndex) => {
                  const content = col.render ? col.render(row, rowIndex) : ((row as Record<string, unknown>)[col.key] as React.ReactNode)
                  const cell = href && colIndex === 0 ? <Link href={href} className="kit-table__row-link">{content}</Link> : content
                  return (
                    <td
                      key={col.key}
                      style={{ textAlign: col.align ?? 'left' }}
                      className={`kit-table__td${col.align === 'right' ? ' kit-table__td--num' : ''}${col.nowrap ? ' kit-table__td--nowrap' : ''}${col.hideOnMobile ? ' kit-table__td--hide-mobile' : ''}`}
                    >
                      {cell}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
        {footer && (
          <tfoot>
            <tr>
              <td colSpan={columns.length}>{footer}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

export interface AdminPaginationProps {
  page: number
  pageSize: number
  total: number
  onPage: (page: number) => void
  className?: string
}

export function AdminPagination({ page, pageSize, total, onPage, className }: AdminPaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(total, page * pageSize)
  return (
    <nav className={`kit-pagination${className ? ` ${className}` : ''}`} aria-label="Pagination">
      <span className="kit-pagination__range">
        {start.toLocaleString()} to {end.toLocaleString()} of {total.toLocaleString()}
      </span>
      <div className="kit-pagination__controls">
        <button type="button" className="kit-btn" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page">
          Previous
        </button>
        <span className="kit-pagination__page">
          Page {page} of {pages}
        </span>
        <button type="button" className="kit-btn" onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label="Next page">
          Next
        </button>
      </div>
    </nav>
  )
}

export default AdminTable
