'use client'

import React, { Fragment, useCallback, useState } from 'react'
import { toast } from '@payloadcms/ui'

import './index.scss'

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
                  <div style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
                    Fixed {data.results.orgStaffFixed} org staff and {data.results.productionStaffFixed} production staff.
                    {data.results.orgStaffErrors.length > 0 || data.results.productionStaffErrors.length > 0 ? (
                      <div style={{ marginTop: '0.5rem', color: '#856404' }}>
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
        className="fixStaffButton" 
        onClick={handleFix}
        disabled={loading}
        style={{ opacity: loading ? 0.6 : 1 }}
      >
        {loading ? 'Fixing...' : 'Fix Staff Relationships'}
      </button>
      {fixed && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#28a745' }}>
          ✓ Staff relationships fixed
        </div>
      )}
      {error && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#dc3545' }}>
          ✗ Error: {error}
        </div>
      )}
    </Fragment>
  )
}
