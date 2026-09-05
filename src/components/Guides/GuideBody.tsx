'use client'

import React from 'react'
import { parseBlocks, type Inline } from '@/guides/markdown'

function Inlines({ inlines }: { inlines: Inline[] }) {
  return (
    <>
      {inlines.map((n, i) => {
        if (n.type === 'bold') return <strong key={i}>{n.text}</strong>
        if (n.type === 'code') return <code key={i}>{n.text}</code>
        if (n.type === 'link') {
          const external = /^https?:\/\//i.test(n.href)
          return (
            <a key={i} href={n.href} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}>
              {n.text}
            </a>
          )
        }
        return <React.Fragment key={i}>{n.text}</React.Fragment>
      })}
    </>
  )
}

/** Renders a guide section body (the small markdown subset) without innerHTML. */
export function GuideBody({ body }: { body: string | null | undefined }) {
  const blocks = parseBlocks(body)
  if (blocks.length === 0) return null
  return (
    <div className="guide-body">
      {blocks.map((b, i) => {
        if (b.type === 'paragraph') return <p key={i}><Inlines inlines={b.inlines} /></p>
        const items = b.items.map((it, j) => <li key={j}><Inlines inlines={it} /></li>)
        return b.ordered ? <ol key={i}>{items}</ol> : <ul key={i}>{items}</ul>
      })}
    </div>
  )
}
