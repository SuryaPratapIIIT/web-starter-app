import { useState, useEffect } from 'react'
import { GlassCard } from './GlassCard'

interface NavBarProps {
  modelsReady: boolean
}

export const NavBar = ({ modelsReady }: NavBarProps) => {
  const [justActivated, setJustActivated] = useState(false)

  useEffect(() => {
    if (modelsReady) {
      setJustActivated(true)
      setTimeout(() => setJustActivated(false), 1000)
    }
  }, [modelsReady])

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: '44px',
      background: 'rgba(12,12,11,0.8)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      zIndex: 999
    }}>
      {/* ChefAI Wordmark */}
      <div style={{
        fontFamily: "'Instrument Sans', sans-serif",
        fontSize: '16px',
        fontWeight: '600',
        color: 'var(--accent)'
      }}>
        ChefAI
      </div>

      {/* Status Pill */}
      <GlassCard
        className={justActivated ? 'status-pill status-pill--just-activated' : 'status-pill'}
        style={{
          padding: '4px 12px',
          borderRadius: '999px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          transition: 'border-color 0.8s ease'
        }}
      >
        {/* Status Dot */}
        <div
          className={modelsReady ? 'status-dot-ready' : ''}
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: modelsReady ? '#4CAF50' : 'var(--muted)'
          }}
        />

        {/* Status Text */}
        <div style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '12px',
          color: modelsReady ? '#4CAF50' : 'var(--muted)',
          transition: 'color 0.3s ease'
        }}>
          {modelsReady ? 'On-device · Offline ready' : 'Loading AI...'}
        </div>
      </GlassCard>
    </div>
  )
}
