import React, { useState } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { DialogA11y } from '@/admin-kit/DialogA11y'

afterEach(cleanup)

function Harness({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>open</button>
      {open && (
        <div className="x-overlay" onClick={() => { setOpen(false); onClose() }} role="presentation">
          <DialogA11y onClose={() => { setOpen(false); onClose() }} />
          <div className="x" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>Title</h3>
            <button type="button">Cancel</button>
            <button type="button">Confirm</button>
          </div>
        </div>
      )}
    </>
  )
}

describe('DialogA11y', () => {
  it('moves focus into the dialog, closes on Escape, and restores focus', () => {
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)
    const opener = screen.getByText('open')
    opener.focus()
    fireEvent.click(opener)
    expect(document.activeElement?.textContent).toBe('Cancel')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(opener)
  })

  it('ignores other keys', () => {
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)
    fireEvent.click(screen.getByText('open'))
    fireEvent.keyDown(document, { key: 'Enter' })
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
})
