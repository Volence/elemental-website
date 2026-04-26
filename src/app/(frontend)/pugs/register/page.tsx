'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function PugRegisterPage() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleRegister() {
    setStatus('loading')
    try {
      const res = await fetch('/api/pug/register', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setStatus('success')
        setMessage(data.message ?? 'You are now registered for Open-Tier PUGs!')
      } else {
        setStatus('error')
        setMessage(data.error ?? 'Registration failed.')
      }
    } catch {
      setStatus('error')
      setMessage('Something went wrong. Please try again.')
    }
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-md">
      <h1 className="text-2xl font-bold mb-4">Register for Open-Tier PUGs</h1>
      <p className="text-gray-600 mb-6">
        Open tier is available to all registered users with a linked Discord account. You can play
        any role and queue at any time.
      </p>

      {status === 'success' ? (
        <div className="rounded-lg border border-green-600 bg-green-950 p-4 text-green-300">
          <p className="font-medium mb-3">{message}</p>
          <Link href="/pugs" className="text-sm text-green-400 hover:underline">
            ← Back to PUGs
          </Link>
        </div>
      ) : (
        <>
          {status === 'error' && (
            <div className="rounded-lg border border-red-600 bg-red-950 p-3 text-red-300 text-sm mb-4">
              {message}
            </div>
          )}
          <p className="text-sm text-gray-500 mb-4">
            Click below to register. You must be logged in and have Discord linked.
          </p>
          <button
            onClick={handleRegister}
            disabled={status === 'loading'}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === 'loading' ? 'Registering…' : 'Register for Open-Tier PUGs'}
          </button>
        </>
      )}
    </main>
  )
}
