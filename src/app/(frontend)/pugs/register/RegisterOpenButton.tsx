'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RegisterOpenButton() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleRegister() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/pug/register', { method: 'POST' })
      if (res.ok) {
        router.refresh()
      } else {
        const data = await res.json()
        setError(data.error || 'Registration failed. Please try again.')
        setLoading(false)
      }
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleRegister}
        disabled={loading}
        className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50"
      >
        {loading ? 'Registering…' : 'Register for Open Tier PUGs'}
      </button>
      {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
    </div>
  )
}
