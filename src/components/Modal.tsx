import { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

export function Modal({ title, eyebrow, onClose, children, restoreFocusTo, className = '' }: {
  title: string
  eyebrow?: string
  onClose: () => void
  children: ReactNode
  restoreFocusTo?: HTMLElement | null
  className?: string
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const labelId = useId()

  useEffect(() => {
    const element = dialog.current
    const trigger = restoreFocusTo ?? document.activeElement
    element?.showModal()
    return () => {
      element?.close()
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({ preventScroll: true })
      else document.getElementById('room-title')?.focus()
    }
  }, [])

  return (
    <dialog
      ref={dialog}
      className={`modal ${className}`}
      aria-labelledby={labelId}
      onCancel={(event) => { event.preventDefault(); onClose() }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <div className="modal-inner">
        <header className="modal-header">
          <div>
            <h2 id={labelId}>{title}</h2>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          </div>
          <button className="icon-button" aria-label={`Close ${title}`} onClick={onClose}><X size={20} /></button>
        </header>
        {children}
      </div>
    </dialog>
  )
}
