'use client'

import React, { useState, useRef, useCallback } from 'react'

type UploadState = 'idle' | 'uploading' | 'success' | 'error'

type UploadResult = {
  message: string
  scrims?: Array<{
    scrimId: number
    name: string
    mapsProcessed: number
    mapNames: string[]
  }>
  error?: string
}

/**
 * Admin view for uploading ScrimTime log files.
 * Supports drag-and-drop and multi-file selection.
 * Posts to /api/scrim-upload which handles parsing + DB insertion.
 */
export default function ScrimUploadView() {
  const [files, setFiles] = useState<File[]>([])
  const [scrimName, setScrimName] = useState('')
  const [state, setState] = useState<UploadState>('idle')
  const [result, setResult] = useState<UploadResult | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback((newFiles: FileList | File[]) => {
    const txtFiles = Array.from(newFiles).filter(
      (f) => f.name.endsWith('.txt') || f.name.endsWith('.csv')
    )
    setFiles((prev) => [...prev, ...txtFiles])
    setResult(null)
    setState('idle')
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragActive(false)
      if (e.dataTransfer.files) handleFiles(e.dataTransfer.files)
    },
    [handleFiles]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }, [])

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleUpload = useCallback(async () => {
    if (files.length === 0) return

    setState('uploading')
    setResult(null)

    const formData = new FormData()
    files.forEach((file) => formData.append('files', file))
    if (scrimName.trim()) {
      formData.append('scrimName', scrimName.trim())
    }

    try {
      const res = await fetch('/api/scrim-upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (res.ok) {
        setState('success')
        setResult(data)
        setFiles([])
        setScrimName('')
      } else {
        setState('error')
        setResult({ message: data.error || 'Upload failed', error: data.error })
      }
    } catch {
      setState('error')
      setResult({ message: 'Network error — could not reach the server', error: 'Network error' })
    }
  }, [files, scrimName])

  return (
    <div style={{ padding: '40px', maxWidth: '720px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
        Scrim Log Upload
      </h1>
      <p style={{ color: 'var(--theme-text-secondary, #888)', marginBottom: '32px', fontSize: '14px' }}>
        Upload <code>.txt</code> log files from the ScrimTime workshop code (<code>DKEEH</code>).
        Each file represents one map.
      </p>

      {/* Scrim Name */}
      <div style={{ marginBottom: '20px' }}>
        <label
          htmlFor="scrimName"
          style={{ display: 'block', marginBottom: '6px', fontWeight: 500, fontSize: '14px' }}
        >
          Scrim Name <span style={{ color: 'var(--theme-text-secondary, #888)', fontWeight: 400 }}>(optional)</span>
        </label>
        <input
          id="scrimName"
          type="text"
          value={scrimName}
          onChange={(e) => setScrimName(e.target.value)}
          placeholder="e.g. vs Team Neon — Week 3"
          style={{
            width: '100%',
            padding: '10px 12px',
            border: '1px solid var(--theme-elevation-150, #333)',
            borderRadius: '6px',
            background: 'var(--theme-elevation-0, #1a1a1a)',
            color: 'var(--theme-text, #fff)',
            fontSize: '14px',
          }}
        />
      </div>

      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragActive ? 'var(--theme-success-500, #22c55e)' : 'var(--theme-elevation-300, #555)'}`,
          borderRadius: '12px',
          padding: '48px 24px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s',
          background: dragActive
            ? 'rgba(34, 197, 94, 0.05)'
            : 'var(--theme-elevation-50, #222)',
          marginBottom: '20px',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".txt,.csv"
          multiple
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          style={{ display: 'none' }}
        />
        <div style={{ fontSize: '32px', marginBottom: '8px' }}>📂</div>
        <p style={{ fontWeight: 500, fontSize: '14px' }}>
          {dragActive ? 'Drop files here' : 'Drag & drop log files, or click to browse'}
        </p>
        <p style={{ color: 'var(--theme-text-secondary, #888)', fontSize: '13px', marginTop: '4px' }}>
          Accepts .txt and .csv files
        </p>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
            {files.length} file{files.length !== 1 ? 's' : ''} selected
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {files.map((file, i) => (
              <div
                key={`${file.name}-${i}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  background: 'var(--theme-elevation-50, #222)',
                  borderRadius: '6px',
                  fontSize: '13px',
                }}
              >
                <span style={{ fontFamily: 'monospace' }}>{file.name}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); removeFile(i) }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--theme-error-500, #ef4444)',
                    cursor: 'pointer',
                    fontSize: '16px',
                    padding: '2px 6px',
                  }}
                  title="Remove file"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Button */}
      <button
        onClick={handleUpload}
        disabled={files.length === 0 || state === 'uploading'}
        style={{
          width: '100%',
          padding: '12px',
          borderRadius: '8px',
          border: 'none',
          background:
            state === 'uploading'
              ? 'var(--theme-elevation-300, #555)'
              : 'var(--theme-success-500, #22c55e)',
          color: '#fff',
          fontWeight: 600,
          fontSize: '14px',
          cursor: files.length === 0 || state === 'uploading' ? 'not-allowed' : 'pointer',
          opacity: files.length === 0 ? 0.5 : 1,
          transition: 'all 0.2s',
        }}
      >
        {state === 'uploading' ? 'Uploading & Processing…' : `Upload ${files.length || ''} File${files.length !== 1 ? 's' : ''}`}
      </button>

      {/* Result */}
      {result && (
        <div
          style={{
            marginTop: '24px',
            padding: '16px',
            borderRadius: '8px',
            background:
              state === 'success'
                ? 'rgba(34, 197, 94, 0.1)'
                : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${state === 'success' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
          }}
        >
          <p style={{ fontWeight: 600, fontSize: '14px', marginBottom: result.scrims ? '12px' : '0' }}>
            {state === 'success' ? '✅' : '❌'} {result.message}
          </p>

          {result.scrims?.map((scrim) => (
            <div key={scrim.scrimId} style={{ marginTop: '8px', fontSize: '13px' }}>
              <p style={{ fontWeight: 500 }}>
                {scrim.name} — {scrim.mapsProcessed} map{scrim.mapsProcessed !== 1 ? 's' : ''}
              </p>
              <p style={{ color: 'var(--theme-text-secondary, #888)', marginTop: '2px' }}>
                Maps: {scrim.mapNames.join(', ')}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
