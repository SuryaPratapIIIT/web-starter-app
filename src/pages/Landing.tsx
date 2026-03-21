import { GlassCard } from '../components/GlassCard'

interface LandingProps {
  modelsReady: boolean
  onStart: () => void
}

export const Landing = ({ modelsReady, onStart }: LandingProps) => {
  return (
    <>
      {/* Section 1 - Hero */}
      <section style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        padding: '24px'
      }}>
        {/* Status Badge - Top Right */}
        <GlassCard style={{
          position: 'absolute',
          top: '24px',
          right: '24px',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span 
            className={modelsReady ? 'status-dot status-dot-active' : 'status-dot'}
            style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: modelsReady ? '#4CAF50' : 'var(--muted)'
            }}
          />
          <span style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '13px',
            color: 'var(--muted)',
            fontWeight: '500'
          }}>
            Running on your device
          </span>
        </GlassCard>

        {/* Hero Content */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '24px',
          maxWidth: '720px'
        }}>
          {/* Label */}
          <div style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '12px',
            color: 'var(--muted)',
            textTransform: 'uppercase',
            letterSpacing: '1.5px',
            fontWeight: '600'
          }}>
            AI-Powered Kitchen Assistant
          </div>

          {/* Headline */}
          <h1 className="hero-headline" style={{
            fontFamily: "'Instrument Sans', sans-serif",
            fontSize: '72px',
            fontWeight: '600',
            color: 'var(--text)',
            lineHeight: '1.1',
            margin: '0'
          }}>
            Cook anything.<br />
            Hands-free. Offline.
          </h1>

          {/* Subline */}
          <p style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '18px',
            color: 'var(--muted)',
            maxWidth: '520px',
            lineHeight: '1.6',
            margin: '0'
          }}>
            Point your camera at your ingredients. ChefAI tells you what to cook — then walks you through it, step by step, without you touching your phone.
          </p>

          {/* CTA Button */}
          <button 
            onClick={onStart}
            style={{
              background: 'var(--accent)',
              color: '#0C0C0B',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '16px',
              fontWeight: '600',
              padding: '14px 32px',
              borderRadius: 'var(--radius)',
              border: 'none',
              cursor: 'pointer',
              transition: 'opacity 0.2s',
              marginTop: '8px'
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.88'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            Start Cooking →
          </button>
        </div>
      </section>

      {/* Section 2 - How It Works */}
      <section style={{
        padding: '80px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        {/* Section Label */}
        <div style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '12px',
          color: 'var(--muted)',
          textTransform: 'uppercase',
          letterSpacing: '1.5px',
          fontWeight: '600',
          marginBottom: '48px'
        }}>
          How it works
        </div>

        {/* Cards Container */}
        <div className="how-it-works-cards" style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '24px',
          flexWrap: 'wrap',
          maxWidth: '1000px'
        }}>
          {/* Card 1 - Scan */}
          <GlassCard style={{
            padding: '32px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            maxWidth: '300px',
            flex: '1 1 300px'
          }}>
            <div style={{ fontSize: '48px', lineHeight: '1' }}>📸</div>
            <h3 style={{
              fontFamily: "'Instrument Sans', sans-serif",
              fontSize: '20px',
              color: 'var(--text)',
              fontWeight: '600',
              margin: '0'
            }}>
              Scan
            </h3>
            <p style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '14px',
              color: 'var(--muted)',
              lineHeight: '1.5',
              margin: '0'
            }}>
              Point your camera at any ingredients you have.
            </p>
          </GlassCard>

          {/* Card 2 - Cook */}
          <GlassCard style={{
            padding: '32px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            maxWidth: '300px',
            flex: '1 1 300px'
          }}>
            <div style={{ fontSize: '48px', lineHeight: '1' }}>🍳</div>
            <h3 style={{
              fontFamily: "'Instrument Sans', sans-serif",
              fontSize: '20px',
              color: 'var(--text)',
              fontWeight: '600',
              margin: '0'
            }}>
              Cook
            </h3>
            <p style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '14px',
              color: 'var(--muted)',
              lineHeight: '1.5',
              margin: '0'
            }}>
              Get instant recipe suggestions with full nutrition info.
            </p>
          </GlassCard>

          {/* Card 3 - Talk */}
          <GlassCard style={{
            padding: '32px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            maxWidth: '300px',
            flex: '1 1 300px'
          }}>
            <div style={{ fontSize: '48px', lineHeight: '1' }}>🗣️</div>
            <h3 style={{
              fontFamily: "'Instrument Sans', sans-serif",
              fontSize: '20px',
              color: 'var(--text)',
              fontWeight: '600',
              margin: '0'
            }}>
              Talk
            </h3>
            <p style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '14px',
              color: 'var(--muted)',
              lineHeight: '1.5',
              margin: '0'
            }}>
              Say 'next' or 'repeat' — ChefAI guides you hands-free.
            </p>
          </GlassCard>
        </div>
      </section>
    </>
  )
}
