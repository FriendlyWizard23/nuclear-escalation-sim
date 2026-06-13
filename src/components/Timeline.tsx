import { useEffect, useMemo, useRef } from 'react'
import type { EscalationEvent } from '../engine/escalationEngine'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface TimelineProps {
  currentTime: number
  totalDuration: number
  isPlaying: boolean
  onToggle: () => void
  events: EscalationEvent[]
  /** Current playback multiplier (2 / 4 / 8 / 16) */
  clockSpeed: number
  /** Called when the user picks a new speed */
  onSpeedChange: (speed: number) => void
}

const SPEED_OPTIONS = [2, 4, 8, 16] as const

function formatClock(seconds: number) {
  const wholeSeconds = Math.max(0, Math.floor(seconds))
  return new Date(wholeSeconds * 1000).toISOString().slice(11, 19)
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function Timeline({
  currentTime,
  totalDuration,
  isPlaying,
  onToggle,
  events,
  clockSpeed,
  onSpeedChange,
}: TimelineProps) {
  const logRef = useRef<HTMLDivElement | null>(null)
  const visibleEvents = useMemo(
    () => events.filter((event) => event.time <= currentTime),
    [currentTime, events],
  )
  const progress = totalDuration > 0 ? Math.min(100, (currentTime / totalDuration) * 100) : 0

  // Auto-scroll the event log to the latest entry
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [visibleEvents])

  return (
    <section className="panel timeline-panel card">
      <div className="timeline-header">
        <div>
          <p className="eyebrow">Timeline</p>
          <h2>{formatClock(currentTime)}</h2>
        </div>
        <button className="btn-secondary" onClick={onToggle} type="button">
          {isPlaying ? '⏸ Pause' : '▶ Play'}
        </button>
      </div>

      {/* ── Speed selector ─────────────────────────────────────────────────── */}
      <div className="speed-selector" aria-label="Playback speed">
        {SPEED_OPTIONS.map((speed) => (
          <button
            key={speed}
            className={`speed-btn${clockSpeed === speed ? ' speed-btn--active' : ''}`}
            onClick={() => onSpeedChange(speed)}
            type="button"
            aria-pressed={clockSpeed === speed}
          >
            {speed}×
          </button>
        ))}
      </div>

      <div className="progress-track" aria-hidden="true">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="event-log" ref={logRef}>
        {visibleEvents.length === 0 ? (
          <p className="muted">No launches have occurred yet.</p>
        ) : (
          visibleEvents.map((event) => (
            <div className={`event-item event-${event.type}`} key={`${event.time}-${event.message}`}>
              <span className="event-time">{formatClock(event.time)}</span>
              <span>{event.message}</span>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
