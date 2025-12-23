'use client'

import React, { useState } from 'react'
import { useAuth } from '@payloadcms/ui'
import type { User } from '@/payload-types'

const UserProfile: React.FC = () => {
  const { user } = useAuth()
  const typedUser = user as User | undefined

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!typedUser) {
    return (
      <div style={{ padding: '2rem' }}>
        <p>Please log in to view your profile.</p>
      </div>
    )
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('All fields are required')
      return
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match')
      return
    }

    setIsSubmitting(true)

    try {
      // First, verify current password by attempting login
      const loginResponse = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: typedUser.email,
          password: currentPassword,
        }),
      })

      if (!loginResponse.ok) {
        throw new Error('Current password is incorrect')
      }

      // Update password using Payload API
      const updateResponse = await fetch(`/api/users/${typedUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          password: newPassword,
        }),
      })

      if (!updateResponse.ok) {
        const data = await updateResponse.json()
        throw new Error(data.error || 'Failed to update password')
      }

      setSuccess('Password updated successfully!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const roleLabels = {
    'admin': 'Admin',
    'team-manager': 'Team Manager',
    'staff-manager': 'Staff Manager',
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '600px' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '2rem' }}>
        My Profile
      </h1>

      {/* Profile Information */}
      <div style={{ 
        background: '#f9fafb', 
        border: '1px solid #e5e7eb', 
        borderRadius: '8px', 
        padding: '1.5rem',
        marginBottom: '2rem'
      }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>
          Account Information
        </h2>
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <div>
            <span style={{ fontWeight: '500', color: '#6b7280' }}>Name:</span>{' '}
            <span>{typedUser.name}</span>
          </div>
          <div>
            <span style={{ fontWeight: '500', color: '#6b7280' }}>Email:</span>{' '}
            <span>{typedUser.email}</span>
          </div>
          <div>
            <span style={{ fontWeight: '500', color: '#6b7280' }}>Role:</span>{' '}
            <span>{roleLabels[typedUser.role]}</span>
          </div>
        </div>
      </div>

      {/* Change Password Form */}
      <div style={{ 
        background: 'white', 
        border: '1px solid #e5e7eb', 
        borderRadius: '8px', 
        padding: '1.5rem'
      }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>
          Change Password
        </h2>

        {error && (
          <div style={{ 
            background: '#fee2e2', 
            border: '1px solid #fecaca', 
            color: '#991b1b', 
            padding: '0.75rem', 
            borderRadius: '4px',
            marginBottom: '1rem'
          }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{ 
            background: '#d1fae5', 
            border: '1px solid #a7f3d0', 
            color: '#065f46', 
            padding: '0.75rem', 
            borderRadius: '4px',
            marginBottom: '1rem'
          }}>
            {success}
          </div>
        )}

        <form onSubmit={handlePasswordChange} style={{ display: 'grid', gap: '1rem' }}>
          <div>
            <label 
              htmlFor="currentPassword" 
              style={{ display: 'block', fontWeight: '500', marginBottom: '0.5rem' }}
            >
              Current Password
            </label>
            <input
              type="password"
              id="currentPassword"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '1rem',
              }}
            />
          </div>

          <div>
            <label 
              htmlFor="newPassword" 
              style={{ display: 'block', fontWeight: '500', marginBottom: '0.5rem' }}
            >
              New Password
            </label>
            <input
              type="password"
              id="newPassword"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '1rem',
              }}
            />
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
              Must be at least 8 characters
            </p>
          </div>

          <div>
            <label 
              htmlFor="confirmPassword" 
              style={{ display: 'block', fontWeight: '500', marginBottom: '0.5rem' }}
            >
              Confirm New Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '1rem',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              padding: '0.75rem 1.5rem',
              background: isSubmitting ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontWeight: '500',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
            }}
          >
            {isSubmitting ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default UserProfile

