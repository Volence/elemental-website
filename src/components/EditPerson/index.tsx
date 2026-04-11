'use client'

import { useSearchParams } from 'next/navigation'
import PersonEditor from '@/components/PersonEditor'

/** Manager view — edit any person by ID */
export default function EditPersonView() {
  const searchParams = useSearchParams()
  const personId = searchParams.get('id')

  return <PersonEditor personId={personId ? Number(personId) : null} isManager={true} />
}
