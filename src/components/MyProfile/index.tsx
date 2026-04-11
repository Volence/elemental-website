'use client'

import PersonEditor from '@/components/PersonEditor'

/** Player's own profile — uses PersonEditor in player mode */
export default function MyProfileView() {
  return <PersonEditor isManager={false} />
}
