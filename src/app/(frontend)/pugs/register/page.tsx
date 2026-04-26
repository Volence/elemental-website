import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Register for PUGs | Elemental' }

export default async function PugRegisterPage() {
  return (
    <main className="container mx-auto px-4 py-8 max-w-md min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Register for Open-Tier PUGs</h1>
      <p className="text-gray-600 mb-6">
        Open tier is available to all registered users with a linked Discord account. You can play
        any role and queue at any time.
      </p>
      <form action="/api/pug/register" method="POST">
        <p className="text-sm text-gray-500 mb-4">
          Click below to register. You must be logged in and have Discord linked.
        </p>
        <button
          type="submit"
          className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Register for Open-Tier PUGs
        </button>
      </form>
    </main>
  )
}
