'use client'

import React from 'react'
import { useSearchParams } from 'next/navigation'

const DISCORD_SVG = (
  <svg width="20" height="15" viewBox="0 0 71 55" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2785 53.4875 44.2898 53.5547 44.3433C53.9101 44.6363 54.2823 44.9293 54.6573 45.2082C54.786 45.304 54.7776 45.5041 54.6377 45.5858C52.869 46.6197 51.0303 47.4931 49.0965 48.2228C48.9706 48.2707 48.9146 48.4172 48.9762 48.5383C50.038 50.6034 51.2554 52.5699 52.5765 54.435C52.632 54.5139 52.7327 54.5477 52.8251 54.5195C58.6257 52.7249 64.5084 50.0174 70.5813 45.5576C70.6344 45.5182 70.668 45.459 70.6736 45.3942C72.1672 29.9752 68.2139 16.6868 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978Z" />
  </svg>
)

const ERRORS: Record<string, string> = {
  membership_unavailable: 'Could not verify your Discord server membership. Try again in a minute.',
  not_authenticated: 'Sign in first, then link your Discord account.',
  invalid_state: 'The sign-in link expired. Try again.',
  discord_token_failed: 'Discord rejected the sign-in. Try again.',
  discord_user_failed: 'Discord did not return your profile. Try again.',
  discord_request_failed: 'Could not reach Discord. Try again.',
  discord_auth_failed: 'Sign-in was cancelled.',
}

/**
 * Login screen: Discord only. Payload's email/password form stays mounted but hidden unless
 * ?breakglass=1 is present. Only admin-role rows carry a password (scripts/set-admin-password.ts).
 */
const BeforeLogin: React.FC = () => {
  const params = useSearchParams()
  const breakglass = params?.get('breakglass') === '1'
  const error = params?.get('error') ?? ''
  const message = ERRORS[error]

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      {!breakglass && <style>{`.login form { display: none !important; }`}</style>}
      <p style={{ marginBottom: '1rem', textAlign: 'center' }}>
        <b>Elemental staff dashboard</b>
      </p>
      {message && (
        <p role="alert" style={{ marginBottom: '1rem', padding: '0.75rem', borderRadius: 6, background: 'rgba(248,113,113,0.12)', color: '#f87171', fontSize: '0.875rem' }}>
          {message}
        </p>
      )}
      <a
        href="/api/auth/discord?returnUrl=/admin"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%', padding: '0.75rem 1rem', borderRadius: '0.375rem', fontWeight: 500, color: '#ffffff', backgroundColor: '#5865F2', textDecoration: 'none', fontSize: '1rem' }}
      >
        {DISCORD_SVG}
        Login with Discord
      </a>
      {breakglass && (
        <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--theme-elevation-500, #888)', marginTop: '1rem' }}>
          Break-glass login. Admin accounts only.
        </p>
      )}
    </div>
  )
}

export default BeforeLogin
