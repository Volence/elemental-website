'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'

export interface SearchInputProps {
  value: string
  /** Called after the debounce, and immediately on clear. */
  onChange: (value: string) => void
  placeholder?: string
  debounceMs?: number
  autoFocus?: boolean
  /** Press "/" anywhere (outside inputs) to focus this box. */
  hotkey?: boolean
  'aria-label'?: string
  className?: string
  size?: 'sm' | 'md'
}

/**
 * The one search box: type="search", debounced, clear button, Escape clears,
 * optional "/" hotkey. Replaces 34 hand-rolled variants.
 */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  debounceMs = 300,
  autoFocus,
  hotkey,
  className,
  size = 'md',
  ...rest
}: SearchInputProps) {
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep the draft in sync when the parent resets the value (e.g. "clear filters").
  useEffect(() => {
    setDraft(value)
  }, [value])

  useEffect(() => {
    if (!hotkey) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return
      event.preventDefault()
      inputRef.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [hotkey])

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const emit = (next: string, immediate = false) => {
    if (timer.current) clearTimeout(timer.current)
    if (immediate || debounceMs <= 0) {
      onChange(next)
      return
    }
    timer.current = setTimeout(() => onChange(next), debounceMs)
  }

  const clear = () => {
    setDraft('')
    emit('', true)
    inputRef.current?.focus()
  }

  return (
    <div className={`kit-search kit-search--${size}${className ? ` ${className}` : ''}`}>
      <Search size={size === 'sm' ? 14 : 16} className="kit-search__icon" aria-hidden="true" />
      <input
        ref={inputRef}
        type="search"
        className="kit-search__input"
        value={draft}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-label={rest['aria-label'] ?? placeholder}
        onChange={(e) => {
          setDraft(e.target.value)
          emit(e.target.value)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && draft) {
            e.preventDefault()
            clear()
          }
        }}
      />
      {draft && (
        <button type="button" className="kit-search__clear" onClick={clear} aria-label="Clear search">
          <X size={14} />
        </button>
      )}
    </div>
  )
}

export default SearchInput
