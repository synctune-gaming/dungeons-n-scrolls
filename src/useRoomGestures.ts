import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import type { Direction } from './game/types'

export function useRoomGestures(onDirection: (direction: Direction) => void, enabled: boolean) {
  const element = useRef<HTMLDivElement>(null)
  const pointer = useRef<{ id: number; x: number; y: number } | null>(null)
  const wheel = useRef({ last: 0, distance: 0, locked: false, axis: '' })
  const [drag, setDrag] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const target = element.current
    if (!target) return
    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) return
      event.preventDefault()
      const now = performance.now()
      const current = wheel.current
      if (now - current.last > 220) {
        current.distance = 0
        current.locked = false
        current.axis = ''
      }
      current.last = now
      if (current.locked || !enabled) return
      const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY)
      const delta = horizontal ? event.deltaX : event.deltaY
      if (!horizontal && delta <= 0) return
      const axis = horizontal ? (delta > 0 ? 'right' : 'left') : 'up'
      if (current.axis !== axis) current.distance = 0
      current.axis = axis
      const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? target.clientHeight : 1
      current.distance += Math.abs(delta) * scale
      if (current.distance >= 65) {
        current.locked = true
        onDirection(axis)
      }
    }
    target.addEventListener('wheel', handleWheel, { passive: false })
    return () => target.removeEventListener('wheel', handleWheel)
  }, [onDirection, enabled])

  const onPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (!enabled || !event.isPrimary || event.button !== 0) return
    if (event.target instanceof Element && event.target.closest('button, a, input')) return
    pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [enabled])

  const onPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const start = pointer.current
    if (!start || start.id !== event.pointerId) return
    setDrag({
      x: Math.max(-90, Math.min(90, (event.clientX - start.x) * 0.3)),
      y: Math.max(-55, Math.min(20, (event.clientY - start.y) * 0.2)),
    })
  }, [])

  const onPointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const start = pointer.current
    pointer.current = null
    setDrag({ x: 0, y: 0 })
    if (!start || !enabled || start.id !== event.pointerId) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) >= 60) onDirection(dx > 0 ? 'right' : 'left')
    else if (dy <= -60) onDirection('up')
  }, [onDirection, enabled])

  const onPointerCancel = useCallback(() => {
    pointer.current = null
    setDrag({ x: 0, y: 0 })
  }, [])

  return {
    element, drag,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  }
}
