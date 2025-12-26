import { getPayload } from 'payload'
import config from '@payload-config'
import { notFound } from 'next/navigation'
import SignupForm from './components/SignupForm'
import type { InviteLink } from '@/payload-types'

interface PageProps {
  params: Promise<{
    token: string
  }>
}

export default async function InvitePage({ params }: PageProps) {
  const { token } = await params
  const payload = await getPayload({ config })

  // Fetch the invite link
  const invites = await payload.find({
    collection: 'invite-links',
    where: {
      token: {
        equals: token,
      },
    },
    limit: 1,
  })

  const invite = invites.docs[0] as InviteLink | undefined

  // Check if invite exists
  if (!invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Invalid Invite Link</h1>
          <p className="text-gray-600 dark:text-gray-400">
            This invite link doesn't exist. Please check the URL and try again, or contact an administrator.
          </p>
        </div>
      </div>
    )
  }

  // Check if already used
  if (invite.usedAt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Invite Already Used</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            This invite link has already been used and cannot be used again.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            If you need access, please contact an administrator for a new invite link.
          </p>
        </div>
      </div>
    )
  }

  // Check if expired
  const now = new Date()
  const expiresAt = new Date(invite.expiresAt)
  if (expiresAt < now) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
          <div className="text-6xl mb-4">⏰</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Invite Expired</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            This invite link expired on {expiresAt.toLocaleDateString()} at {expiresAt.toLocaleTimeString()}.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Please contact an administrator for a new invite link.
          </p>
        </div>
      </div>
    )
  }

  // Invite is valid - show signup form
  const roleLabels = {
    'admin': 'Admin',
    'team-manager': 'Team Manager',
    'staff-manager': 'Staff Manager',
    'user': 'User',
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🎮</div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Join Elemental</h1>
          <p className="text-gray-600 dark:text-gray-400">
            You've been invited to join as a <span className="font-semibold">{roleLabels[invite.role]}</span>
          </p>
        </div>

        <SignupForm token={token} prefilledEmail={invite.email || undefined} />

        <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>This invite expires on {expiresAt.toLocaleDateString()} at {expiresAt.toLocaleTimeString()}</p>
        </div>
      </div>
    </div>
  )
}

export async function generateMetadata({ params }: PageProps) {
  return {
    title: 'Join Elemental - Admin Invite',
    description: 'Accept your invitation to join the Elemental admin panel.',
  }
}

