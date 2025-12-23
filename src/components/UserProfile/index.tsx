'use client'

import React, { useState } from 'react'
import { useAuth } from '@payloadcms/ui'
import type { User, Media } from '@/payload-types'

function getMediaUrl(media: string | number | Media | null | undefined): string | null {
  if (!media) return null
  if (typeof media === 'object' && media.url) return media.url
  return null
}

const UserProfile: React.FC = () => {
  const { user } = useAuth()
  const typedUser = user as User | undefined

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [avatarSuccess, setAvatarSuccess] = useState<string | null>(null)

  if (!typedUser) {
    return (
      <div style={{ padding: '2rem' }}>
        <p>Please log in to view your profile.</p>
      </div>
    )
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(null)

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All fields are required')
      return
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match')
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
      // Don't send role - the beforeValidate hook removes it for non-admins anyway
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

      setPasswordSuccess('Password updated successfully!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      setPasswordError(err.message || 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setAvatarFile(file)
      // Create preview URL
      const reader = new FileReader()
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleAvatarUpload = async () => {
    if (!avatarFile) return

    setIsUploadingAvatar(true)
    setAvatarError(null)
    setAvatarSuccess(null)

    try {
      // Upload the file to media
      const formData = new FormData()
      formData.append('file', avatarFile)

      const uploadResponse = await fetch('/api/media', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json()
        throw new Error(errorData.errors?.[0]?.message || 'Failed to upload avatar')
      }

      const uploadData = await uploadResponse.json()
      const mediaId = uploadData.doc.id

      // Update user with new avatar
      // Don't send role or assignedTeams - the beforeValidate hook removes them for non-admins
      const updateResponse = await fetch(`/api/users/${typedUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          avatar: mediaId,
        }),
      })

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json()
        throw new Error(errorData.errors?.[0]?.message || 'Failed to update avatar')
      }

      setAvatarSuccess('Avatar updated successfully!')
      setAvatarFile(null)
      setAvatarPreview(null)
      
      // Reload the page to show new avatar
      setTimeout(() => window.location.reload(), 1500)
    } catch (err: any) {
      setAvatarError(err.message || 'Failed to upload avatar')
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const roleLabels = {
    'admin': 'Admin',
    'team-manager': 'Team Manager',
    'staff-manager': 'Staff Manager',
  }

  const avatarUrl = getMediaUrl(typedUser.avatar)

  return (
    <div style={{ padding: '2rem', maxWidth: '600px' }}>
      {/* Profile Information */}
      <div style={{ 
        background: 'var(--theme-elevation-50)', 
        border: '1px solid var(--theme-elevation-100)', 
        borderRadius: '8px', 
        padding: '1.5rem',
        marginBottom: '2rem'
      }}>
        {avatarError && (
          <div style={{ 
            background: 'var(--theme-error-50)', 
            border: '1px solid var(--theme-error-200)', 
            color: 'var(--theme-error-700)', 
            padding: '0.75rem', 
            borderRadius: '4px',
            marginBottom: '1rem'
          }}>
            {avatarError}
          </div>
        )}

        {avatarSuccess && (
          <div style={{ 
            background: 'var(--theme-success-50)', 
            border: '1px solid var(--theme-success-200)', 
            color: 'var(--theme-success-700)', 
            padding: '0.75rem', 
            borderRadius: '4px',
            marginBottom: '1rem'
          }}>
            {avatarSuccess}
          </div>
        )}

        <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', alignItems: 'flex-start' }}>
          {/* Avatar */}
          <div style={{ flexShrink: 0, textAlign: 'center' }}>
            {avatarPreview || avatarUrl ? (
              <img 
                src={avatarPreview || avatarUrl!} 
                alt={typedUser.name}
                style={{
                  width: '100px',
                  height: '100px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '3px solid var(--theme-elevation-200)',
                  marginBottom: '0.75rem'
                }}
              />
            ) : (
              <div style={{
                width: '100px',
                height: '100px',
                borderRadius: '50%',
                background: 'var(--theme-button-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2.5rem',
                color: 'var(--theme-button-primary-text)',
                fontWeight: 'bold',
                marginBottom: '0.75rem'
              }}>
                {typedUser.name.charAt(0).toUpperCase()}
              </div>
            )}
            
            {/* Avatar upload */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                style={{ display: 'none' }}
                id="avatar-upload"
                disabled={isUploadingAvatar}
              />
              <label
                htmlFor="avatar-upload"
                style={{
                  padding: '0.5rem 1rem',
                  background: 'var(--theme-elevation-100)',
                  color: 'var(--theme-elevation-800)',
                  border: '1px solid var(--theme-elevation-200)',
                  borderRadius: '4px',
                  cursor: isUploadingAvatar ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  display: 'inline-block'
                }}
              >
                Choose Photo
              </label>
              
              {avatarFile && (
                <button
                  type="button"
                  onClick={handleAvatarUpload}
                  disabled={isUploadingAvatar}
                  style={{
                    padding: '0.5rem 1rem',
                    background: isUploadingAvatar ? 'var(--theme-elevation-300)' : 'var(--theme-button-primary)',
                    color: isUploadingAvatar ? 'var(--theme-elevation-600)' : 'var(--theme-button-primary-text)',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: isUploadingAvatar ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500'
                  }}
                >
                  {isUploadingAvatar ? 'Uploading...' : 'Upload'}
                </button>
              )}
            </div>
          </div>
          
          {/* Name and Role */}
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '0.25rem', color: 'var(--theme-elevation-800)' }}>
              {typedUser.name}
            </h2>
            <p style={{ color: 'var(--theme-elevation-500)', marginBottom: '0.5rem' }}>
              {roleLabels[typedUser.role]}
            </p>
          </div>
        </div>

        <div style={{ 
          borderTop: '1px solid var(--theme-elevation-100)',
          paddingTop: '1rem',
          display: 'grid',
          gap: '0.5rem'
        }}>
          <div>
            <span style={{ fontWeight: '500', color: 'var(--theme-elevation-500)' }}>Email:</span>{' '}
            <span style={{ color: 'var(--theme-elevation-800)' }}>{typedUser.email}</span>
          </div>
        </div>
      </div>

      {/* Change Password Form */}
      <div style={{ 
        background: 'var(--theme-elevation-50)', 
        border: '1px solid var(--theme-elevation-100)', 
        borderRadius: '8px', 
        padding: '1.5rem'
      }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>
          Change Password
        </h2>

        {passwordError && (
          <div style={{ 
            background: 'var(--theme-error-50)', 
            border: '1px solid var(--theme-error-200)', 
            color: 'var(--theme-error-700)', 
            padding: '0.75rem', 
            borderRadius: '4px',
            marginBottom: '1rem'
          }}>
            {passwordError}
          </div>
        )}

        {passwordSuccess && (
          <div style={{ 
            background: 'var(--theme-success-50)', 
            border: '1px solid var(--theme-success-200)', 
            color: 'var(--theme-success-700)', 
            padding: '0.75rem', 
            borderRadius: '4px',
            marginBottom: '1rem'
          }}>
            {passwordSuccess}
          </div>
        )}

        <div style={{ display: 'grid', gap: '1rem' }}>
          <div>
            <label 
              htmlFor="currentPassword" 
              style={{ display: 'block', fontWeight: '500', marginBottom: '0.5rem', color: 'var(--theme-elevation-800)' }}
            >
              Current Password
            </label>
            <input
              type="password"
              id="currentPassword"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={isSubmitting}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isSubmitting) {
                  e.preventDefault()
                  handlePasswordChange(e)
                }
              }}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid var(--theme-elevation-150)',
                borderRadius: '4px',
                fontSize: '1rem',
                background: 'var(--theme-elevation-0)',
                color: 'var(--theme-elevation-800)',
              }}
            />
          </div>

          <div>
            <label 
              htmlFor="newPassword" 
              style={{ display: 'block', fontWeight: '500', marginBottom: '0.5rem', color: 'var(--theme-elevation-800)' }}
            >
              New Password
            </label>
            <input
              type="password"
              id="newPassword"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={isSubmitting}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isSubmitting) {
                  e.preventDefault()
                  handlePasswordChange(e)
                }
              }}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid var(--theme-elevation-150)',
                borderRadius: '4px',
                fontSize: '1rem',
                background: 'var(--theme-elevation-0)',
                color: 'var(--theme-elevation-800)',
              }}
            />
            <p style={{ fontSize: '0.875rem', color: 'var(--theme-elevation-500)', marginTop: '0.25rem' }}>
              Must be at least 8 characters
            </p>
          </div>

          <div>
            <label 
              htmlFor="confirmPassword" 
              style={{ display: 'block', fontWeight: '500', marginBottom: '0.5rem', color: 'var(--theme-elevation-800)' }}
            >
              Confirm New Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isSubmitting}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isSubmitting) {
                  e.preventDefault()
                  handlePasswordChange(e)
                }
              }}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid var(--theme-elevation-150)',
                borderRadius: '4px',
                fontSize: '1rem',
                background: 'var(--theme-elevation-0)',
                color: 'var(--theme-elevation-800)',
              }}
            />
          </div>

          <button
            type="button"
            onClick={handlePasswordChange}
            disabled={isSubmitting}
            style={{
              padding: '0.75rem 1.5rem',
              background: isSubmitting ? 'var(--theme-elevation-300)' : 'var(--theme-button-primary)',
              color: isSubmitting ? 'var(--theme-elevation-600)' : 'var(--theme-button-primary-text)',
              border: 'none',
              borderRadius: '4px',
              fontWeight: '500',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
            }}
          >
            {isSubmitting ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default UserProfile

