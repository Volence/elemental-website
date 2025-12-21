'use client'

import React, { Fragment, useCallback, useState } from 'react'
import { toast } from '@payloadcms/ui'

export const FixStaffButton: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [fixed, setFixed] = useState(false)
  const [error, setError] = useState<null | string>(null)

  const handleFix = useCallback(
    async () => {
      if (loading) {
        toast.info('Fix already in progress.')
        return
      }
      if (error) {
        toast.error(`An error occurred, please refresh and try again.`)
        return
      }

      setLoading(true)
      setError(null)

      try {
        toast.promise(
          new Promise((resolve, reject) => {
            try {
              fetch('/api/fix-staff-relationships', { method: 'POST', credentials: 'include' })
                .then(async (res) => {
                  if (res.ok) {
                    const data = await res.json()
                    resolve(data)
                    setFixed(true)
                  } else {
                    const text = await res.text()
                    reject(text || 'An error occurred while fixing staff relationships.')
                  }
                })
                .catch((error) => {
                  reject(error.message || 'Network error occurred.')
                })
            } catch (error) {
              reject(error instanceof Error ? error.message : 'Unknown error')
            }
          }),
          {
            loading: 'Fixing staff relationships...',
            success: (data: any) => (
              <div>
                Staff relationships fixed! 
                {data?.results && (
                  <div className="mt-2 text-sm">
                    Fixed {data.results.orgStaffFixed} org staff and {data.results.productionStaffFixed} production staff.
                    {data.results.orgStaffErrors.length > 0 || data.results.productionStaffErrors.length > 0 ? (
                      <div className="mt-2 text-yellow-700 dark:text-yellow-300">
                        Some errors occurred - check console for details.
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            ),
            error: 'An error occurred while fixing staff relationships.',
          },
        )
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err)
        setError(error)
        toast.error(error)
      } finally {
        setLoading(false)
      }
    },
    [loading, error],
  )

  return (
    <Fragment>
      <button 
        className="px-4 py-2 bg-blue-600 text-white rounded cursor-pointer text-sm font-medium transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60" 
        onClick={handleFix}
        disabled={loading}
      >
        {loading ? 'Fixing...' : 'Fix Staff Relationships'}
      </button>
      {fixed && (
        <div className="mt-2 text-sm text-green-600 dark:text-green-400">
          ✓ Staff relationships fixed
        </div>
      )}
      {error && (
        <div className="mt-2 text-sm text-red-600 dark:text-red-400">
          ✗ Error: {error}
        </div>
      )}
    </Fragment>
  )
}
