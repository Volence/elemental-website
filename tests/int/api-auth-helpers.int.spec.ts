import { describe, it, expect } from 'vitest'
import { requireAdminAccess, requireStaffManagerAccess, requireDepartment } from '@/utilities/apiAuth'
import { resolveAccess } from '@/access'

const plainUser = resolveAccess({ id: 1, role: 'user' }, [])
const admin = resolveAccess({ id: 2, role: 'admin' }, [])

describe('requireAdminAccess', () => {
  it('403s a plain user with both error and message set to the same text', async () => {
    const res = requireAdminAccess(plainUser)
    expect(res).toBeDefined()
    expect(res!.status).toBe(403)
    const body = await res!.json()
    expect(body.error).toBeTruthy()
    expect(body.message).toBe(body.error)
  })

  it('is undefined for an admin', () => {
    expect(requireAdminAccess(admin)).toBeUndefined()
  })
})

describe('requireStaffManagerAccess', () => {
  it('403s a plain user with both error and message set to the same text', async () => {
    const res = requireStaffManagerAccess(plainUser)
    expect(res).toBeDefined()
    expect(res!.status).toBe(403)
    const body = await res!.json()
    expect(body.error).toBeTruthy()
    expect(body.message).toBe(body.error)
  })

  it('is undefined for an admin', () => {
    expect(requireStaffManagerAccess(admin)).toBeUndefined()
  })
})

describe('requireDepartment', () => {
  it('403s a plain user with both error and message set to the same text', async () => {
    const res = requireDepartment(plainUser, 'pug')
    expect(res).toBeDefined()
    expect(res!.status).toBe(403)
    const body = await res!.json()
    expect(body.error).toBeTruthy()
    expect(body.message).toBe(body.error)
  })

  it('is undefined for an admin (every department reads lead for staff)', () => {
    expect(requireDepartment(admin, 'pug')).toBeUndefined()
  })
})
