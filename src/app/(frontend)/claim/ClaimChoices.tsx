'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Candidate { id: number; name: string; teams: string[] }

export default function ClaimChoices({ candidates, returnUrl }: { candidates: Candidate[]; returnUrl: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const claim = async (targetId: number) => {
    setBusy(true)
    setMessage('')
    try {
      const res = await fetch('/api/identity/claims', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetId }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not file the request')
      setMessage('Request sent. A manager will confirm it.')
      setTimeout(() => router.push(returnUrl), 1500)
    } catch (e: any) {
      setMessage(e.message)
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      {candidates.map((c) => (
        <div key={c.id} className="flex items-center justify-between rounded-lg border border-border p-4">
          <div>
            <div className="font-medium">{c.name}</div>
            {c.teams.length > 0 && <div className="text-sm text-muted-foreground">{c.teams.join(', ')}</div>}
          </div>
          <button type="button" disabled={busy} onClick={() => claim(c.id)} className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
            Yes, that&apos;s me
          </button>
        </div>
      ))}
      <button type="button" disabled={busy} onClick={() => router.push(returnUrl)} className="w-full mt-2 px-3 py-2 rounded-md border border-border text-sm">
        None of these
      </button>
      {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
    </div>
  )
}
