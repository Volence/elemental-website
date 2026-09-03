import React, { useState } from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { AdminModal } from '@/admin-kit/AdminModal'
import { ConfirmDialogProvider, useConfirm } from '@/components/ConfirmDialog'

afterEach(() => {
  cleanup()
  document.body.style.overflow = ''
})

function Harness({ onClose }: { onClose: () => void }) {
  return (
    <>
      <button>outside</button>
      <AdminModal open title="Hello" onClose={onClose} footer={<button>Save</button>}>
        <input aria-label="name" />
      </AdminModal>
    </>
  )
}

describe('AdminModal', () => {
  it('renders as an accessible dialog labelled by its title', () => {
    render(<Harness onClose={() => {}} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    const labelledBy = dialog.getAttribute('aria-labelledby')
    expect(labelledBy).toBeTruthy()
    expect(document.getElementById(labelledBy!)?.textContent).toBe('Hello')
  })

  it('locks body scroll while open and restores it on unmount', () => {
    const { unmount } = render(<Harness onClose={() => {}} />)
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('closes on Escape', () => {
    let closed = 0
    render(<Harness onClose={() => { closed += 1 }} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(closed).toBe(1)
  })

  it('closes on backdrop click but not on panel click', () => {
    let closed = 0
    render(<Harness onClose={() => { closed += 1 }} />)
    fireEvent.mouseDown(screen.getByRole('dialog'))
    expect(closed).toBe(0)
    fireEvent.mouseDown(screen.getByTestId('kit-modal-backdrop'))
    expect(closed).toBe(1)
  })

  it('moves focus inside on open and traps Tab within the panel', () => {
    render(<Harness onClose={() => {}} />)
    const input = screen.getByLabelText('name')
    // Initial focus prefers the first control in the body over the header close button.
    expect(document.activeElement).toBe(input)

    // Shift+Tab from the first focusable (the close button) wraps to the last (Save).
    const close = screen.getByLabelText('Close')
    close.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect((document.activeElement as HTMLElement).textContent).toBe('Save')

    // Tab from the last wraps back to the first.
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(close)
  })

  it('returns focus to the opener when it closes', () => {
    function Opener() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button onClick={() => setOpen(true)}>open</button>
          <AdminModal open={open} title="T" onClose={() => setOpen(false)}>
            <button>inner</button>
          </AdminModal>
        </>
      )
    }
    render(<Opener />)
    const opener = screen.getByText('open')
    opener.focus()
    fireEvent.click(opener)
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(document.activeElement).not.toBe(opener)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(opener)
  })
})

describe('ConfirmDialogProvider on AdminModal', () => {
  function Consumer({ onResult }: { onResult: (v: boolean) => void }) {
    const confirm = useConfirm()
    return (
      <button
        onClick={async () => {
          onResult(await confirm({ title: 'Delete team', message: 'Sure?', variant: 'danger', confirmLabel: 'Delete' }))
        }}
      >
        trigger
      </button>
    )
  }

  it('resolves true on confirm and false on Escape', async () => {
    const results: boolean[] = []
    render(
      <ConfirmDialogProvider>
        <Consumer onResult={(v) => results.push(v)} />
      </ConfirmDialogProvider>,
    )

    fireEvent.click(screen.getByText('trigger'))
    expect(screen.getByRole('dialog')).toBeTruthy()
    await act(async () => {
      fireEvent.click(screen.getByText('Delete'))
    })
    expect(results).toEqual([true])
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(screen.getByText('trigger'))
    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    expect(results).toEqual([true, false])
  })
})
