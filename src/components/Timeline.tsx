import { useEffect, useMemo, useRef } from 'react'
import type { EscalationEvent } from '../engine/escalationEngine'

interface TimelineProps {
  currentTime: number
  totalDuration: number
  isPlaying: boolean
  onToggle: () => void
  events: EscalationEvent[]
  clockSpeed: number
  onSpeedChange: (speed: number) => void
}

const SPEED_OPTIONS = [2, 4, 8, 16] as const

function formatClock(seconds: number) {
  const wholeSeconds = Math.max(0, Math.floor(seconds))
  return new Date(wholeSeconds * 1000).toISOString().slice(11, 19)
}

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
  const visibleEvents = useMemo(() => events.filter((event) => event.time <= currentTime), [currentTime, events])
  const progress = totalDuration > 0 ? Math.min(100, (currentTime / totalDuration) * 100) : 0

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [visibleEvents])

  return (
    <section className="panel timeline-panel card">
      <div className="timeline-header">
        <div>
          <p className="eyebrow">Launch timeline</p>
          <h2>{formatClock(currentTime)}</h2>
          <p className="timeline-subhead">Auto-escalation underway</p>
        </div>
        <button className="btn-secondary" onClick={onToggle} type="button">
          {isPlaying ? 'Pause feed' : 'Resume feed'}
        </button>
      </div>

      <div className="speed-selector" aria-label="Playback speed">
        {SPEED_OPTIONS.map((speed) => (
          <button
            key={speed}
            aria-pressed={clockSpeed === speed}
            className={`speed-btn${clockSpeed === speed ? ' speed-btn--active' : ''}`}
            onClick={() => onSpeedChange(speed)}
            type="button"
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
          <p className="muted">Awaiting first launches.</p>
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
