import React from 'react'

interface FixResultMessageProps {
  message: string
}

export function FixResultMessage({ message }: FixResultMessageProps) {
  const isError = message.includes('Error')

  return (
    <div className={`fix-result-message ${isError ? 'fix-result-message--error' : 'fix-result-message--success'}`}>
      {message}
    </div>
  )
}
