import { GlassCard } from './GlassCard'

interface ModelLoaderProps {
  modelName: string
  progress: number
}

export const ModelLoader = ({ modelName, progress }: ModelLoaderProps) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: 'var(--bg)',
      padding: '24px',
      textAlign: 'center',
      gap: '32px'
    }}>
      {/* Wordmark */}
      <div>
        <h1 style={{
          fontFamily: "'Instrument Sans', sans-serif",
          fontSize: '32px',
          fontWeight: '700',
          color: 'var(--accent)',
          marginBottom: '8px',
          letterSpacing: '-0.02em'
        }}>
          ChefAI
        </h1>
        <p style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '15px',
          color: 'var(--muted)',
          fontWeight: '400'
        }}>
          Your hands-free kitchen companion
        </p>
      </div>

      {/* Loading Card */}
      <GlassCard style={{
        width: '100%',
        maxWidth: '420px',
        padding: '24px'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {/* Model Name */}
          <div style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '14px',
            color: 'var(--text)',
            fontWeight: '500',
            marginBottom: '4px'
          }}>
            {modelName}
          </div>

          {/* Progress Bar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{
              width: '100%',
              height: '4px',
              background: 'rgba(255,255,255,0.08)',
              borderRadius: '2px',
              overflow: 'hidden',
              position: 'relative'
            }}>
              <div style={{
                height: '100%',
                width: `${progress}%`,
                background: 'var(--accent)',
                borderRadius: '2px',
                transition: 'width 0.3s ease',
                boxShadow: '0 0 12px rgba(232, 123, 79, 0.5)'
              }} />
            </div>

            {/* Progress Percentage */}
            <div style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '13px',
              color: 'var(--accent)',
              fontWeight: '600'
            }}>
              {progress}%
            </div>
          </div>

          {/* Helper Text */}
          <p style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '12px',
            color: 'var(--muted)',
            marginTop: '4px'
          }}>
            Downloading to your device — only happens once
          </p>
        </div>
      </GlassCard>

      {/* Feature List */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        fontFamily: "'DM Sans', sans-serif",
        fontSize: '13px',
        color: 'var(--muted)',
        maxWidth: '360px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🔒</span>
          <span>Runs entirely on your device</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>✈️</span>
          <span>Works offline once downloaded</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🚫</span>
          <span>Your data never leaves this phone</span>
        </div>
      </div>
    </div>
  )
}
