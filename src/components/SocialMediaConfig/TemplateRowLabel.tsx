'use client'

import React from 'react'

export default function TemplateRowLabel({ data, index }: { data?: any; index?: number }) {
  return <span>{data?.name || `Template ${(index ?? 0) + 1}`}</span>
}

