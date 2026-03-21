import { useState, useEffect, useRef } from 'react'

interface Step {
  id: number
  text: string
  timer: number | null
}

interface Recipe {
  id: number
  name: string
  calories: number
  macros: { P: number; C: number; F: number }
}

interface SmartStepModeProps {
  recipe: Recipe
  onExit: () => void
}

const RECIPE_STEPS: Record<number, Step[]> = {
  1: [
    { id: 1, text: "Mince 4 cloves of garlic finely and slice the chicken breast into thin strips.", timer: null },
    { id: 2, text: "Heat 2 tablespoons of olive oil in a wok or large pan over high heat.", timer: null },
    { id: 3, text: "Add garlic to the hot oil. Stir constantly for 30 seconds until fragrant — don't let it burn.", timer: 30 },
    { id: 4, text: "Add chicken strips in a single layer. Let them sear without moving for 2 minutes.", timer: 120 },
    { id: 5, text: "Toss the chicken, add sliced bell pepper. Stir-fry together for 3 minutes.", timer: 180 },
    { id: 6, text: "Season with salt, pepper and a squeeze of lemon. Toss once more.", timer: null },
    { id: 7, text: "Plate immediately and serve hot. Your stir-fry is ready.", timer: null }
  ]
}

const GENERIC_STEPS: Step[] = [
  { id: 1, text: "Prepare all your ingredients — wash, chop, and measure everything before you start.", timer: null },
  { id: 2, text: "Heat your pan or pot over medium-high heat. Add oil when ready.", timer: null },
  { id: 3, text: "Add your aromatics first — garlic, onion, or spices. Cook until fragrant.", timer: 60 },
  { id: 4, text: "Add your main protein or vegetables. Cook according to the recipe.", timer: 180 },
  { id: 5, text: "Adjust seasoning to taste. Add salt, pepper, and any finishing herbs.", timer: null },
  { id: 6, text: "Rest for a moment before plating. This lets flavours settle.", timer: 30 },
  { id: 7, text: "Plate and serve. You're done — enjoy your meal.", timer: null }
]

export const SmartStepMode = ({ recipe, onExit }: SmartStepModeProps) => {
  const steps = RECIPE_STEPS[recipe.id] || GENERIC_STEPS
  const [currentStep, setCurrentStep] = useState(1)
  const [isListening, setIsListening] = useState(false)
  const [lastCommand, setLastCommand] = useState('')
  const [activeCommandPill, setActiveCommandPill] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [repeatKey, setRepeatKey] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [isCompleted, setIsCompleted] = useState(false)
  
  const toastTimeoutRef = useRef<number | undefined>(undefined)
  const voiceSimulationRef = useRef<number | undefined>(undefined)
  const timerIntervalRef = useRef<number | undefined>(undefined)

  const currentStepData = steps[currentStep - 1]
  const totalSteps = steps.length

  // Show toast helper
  const showToast = (message: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    setToast(message)
    toastTimeoutRef.current = setTimeout(() => setToast(null), 4000)
  }

  // Timer logic
  useEffect(() => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    
    if (currentStepData.timer) {
      setTimeRemaining(currentStepData.timer)
      let hasShown10s = false

      timerIntervalRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev === null || prev <= 0) {
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
            showToast("⏱ Time's up! Check your progress.")
            return 0
          }
          if (prev === 10 && !hasShown10s) {
            hasShown10s = true
            showToast("⏱ 10 seconds remaining")
          }
          return prev - 1
        })
      }, 1000)
    } else {
      setTimeRemaining(null)
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    }
  }, [currentStep, currentStepData.timer])

  // Voice simulation
  useEffect(() => {
    if (voiceSimulationRef.current) clearInterval(voiceSimulationRef.current)

    if (isListening) {
      voiceSimulationRef.current = setInterval(() => {
        const commands = ["next", "repeat", "next", "next"]
        const command = commands[Math.floor(Math.random() * commands.length)]
        
        setLastCommand(`You said: ${command}`)
        setActiveCommandPill(command)
        
        setTimeout(() => setActiveCommandPill(''), 1000)

        if (command === "next" && currentStep < totalSteps) {
          setCurrentStep(prev => prev + 1)
        } else if (command === "repeat") {
          setRepeatKey(prev => prev + 1)
        } else if (command === "done") {
          onExit()
        }
      }, 3000)
    }

    return () => {
      if (voiceSimulationRef.current) clearInterval(voiceSimulationRef.current)
    }
  }, [isListening, currentStep, totalSteps, onExit])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
      if (voiceSimulationRef.current) clearInterval(voiceSimulationRef.current)
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    }
  }, [])

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(prev => prev + 1)
    } else {
      setIsCompleted(true)
    }
  }

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Completion overlay
  if (isCompleted) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        padding: '24px'
      }}>
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎉</div>
          <h1 style={{
            fontFamily: "'Instrument Sans', sans-serif",
            fontSize: '36px',
            color: 'var(--text)',
            marginBottom: '8px',
            fontWeight: '600'
          }}>
            You're done!
          </h1>
          <div style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '16px',
            color: 'var(--muted)',
            marginBottom: '8px'
          }}>
            {recipe.name}
          </div>
          <div style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '13px',
            color: 'var(--muted)',
            marginBottom: '32px'
          }}>
            {recipe.calories} kcal · {recipe.macros.P}g protein
          </div>
          <button
            onClick={onExit}
            style={{
              background: 'var(--accent)',
              color: '#0C0C0B',
              border: 'none',
              borderRadius: 'var(--radius)',
              padding: '14px 32px',
              cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '16px',
              fontWeight: '600',
              transition: 'opacity 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.88'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            Back to recipes
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 200,
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Progress Bar */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '2px',
        background: 'var(--surface)',
        zIndex: 3
      }}>
        <div style={{
          background: 'var(--accent)',
          height: '100%',
          width: `${(currentStep / totalSteps) * 100}%`,
          transition: 'width 0.5s ease'
        }} />
      </div>

      {/* Top Bar */}
      <div style={{
        height: '56px',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'relative',
        zIndex: 2
      }}>
        <button
          onClick={() => {
            if (window.confirm('Leave this recipe? Your progress will be lost.')) {
              onExit()
            }
          }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '14px',
            color: 'var(--muted)',
            transition: 'color 0.2s',
            padding: '8px 0'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--muted)'}
        >
          ← Back
        </button>

        <div style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '14px',
          color: 'var(--muted)',
          maxWidth: '200px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {recipe.name}
        </div>

        <div style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '13px',
          color: 'var(--muted)'
        }}>
          Step {currentStep} of {totalSteps}
        </div>
      </div>

      {/* Top Half - Step Display */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 32px',
        textAlign: 'center',
        maxWidth: '680px',
        margin: '0 auto',
        width: '100%'
      }}>
        {/* Step Text */}
        <div
          key={`${currentStep}-${repeatKey}`}
          className="step-text"
          style={{
            fontFamily: "'Instrument Sans', sans-serif",
            fontSize: '32px',
            fontWeight: '500',
            color: 'var(--text)',
            lineHeight: '1.45',
            opacity: 0,
            animation: 'stepIn 0.4s ease forwards'
          }}
        >
          {currentStepData.text}
        </div>

        {/* Timer Display */}
        {timeRemaining !== null && timeRemaining > 0 && (
          <div style={{ marginTop: '20px' }}>
            <div style={{
              fontFamily: "'Instrument Sans', sans-serif",
              fontSize: '48px',
              fontWeight: '300',
              color: 'var(--accent)'
            }}>
              {formatTime(timeRemaining)}
            </div>
            <div style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '12px',
              color: 'var(--muted)'
            }}>
              remaining
            </div>
          </div>
        )}

        {/* Navigation Arrows */}
        <div style={{
          display: 'flex',
          gap: '12px',
          marginTop: '32px',
          flexWrap: 'wrap',
          justifyContent: 'center'
        }}>
          <button
            onClick={handlePrev}
            disabled={currentStep === 1}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '10px 20px',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '14px',
              color: 'var(--text)',
              cursor: currentStep === 1 ? 'default' : 'pointer',
              opacity: currentStep === 1 ? 0.3 : 1,
              transition: 'opacity 0.2s'
            }}
          >
            ← Prev
          </button>
          <button
            onClick={handleNext}
            disabled={currentStep === totalSteps}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '10px 20px',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '14px',
              color: 'var(--text)',
              cursor: currentStep === totalSteps ? 'default' : 'pointer',
              opacity: currentStep === totalSteps ? 0.3 : 1,
              transition: 'opacity 0.2s'
            }}
          >
            Next →
          </button>
        </div>
      </div>

      {/* Bottom Half - Voice Panel */}
      <div style={{
        height: '280px',
        background: 'var(--glass)',
        borderTop: '1px solid var(--glass-border)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        padding: '24px',
        position: 'relative'
      }}>
        {/* Mic Button with Ping Rings */}
        <div style={{ position: 'relative', width: '80px', height: '80px' }}>
          {/* Ping Ring 1 */}
          {isListening && (
            <>
              <div className="ping-ring-1" style={{
                position: 'absolute',
                inset: '-12px',
                borderRadius: '50%',
                border: '2px solid rgba(232,123,79,0.5)',
                animation: 'ping 1.5s ease-out infinite'
              }} />
              {/* Ping Ring 2 */}
              <div className="ping-ring-2" style={{
                position: 'absolute',
                inset: '-24px',
                borderRadius: '50%',
                border: '2px solid rgba(232,123,79,0.25)',
                animation: 'ping 1.5s ease-out infinite',
                animationDelay: '0.4s'
              }} />
            </>
          )}

          {/* Mic Button */}
          <button
            onClick={() => setIsListening(!isListening)}
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: isListening ? 'var(--accent)' : 'var(--surface)',
              border: `2px solid ${isListening ? 'var(--accent)' : 'var(--border)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              zIndex: 1,
              position: 'relative'
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect
                x="9"
                y="2"
                width="6"
                height="12"
                rx="3"
                fill={isListening ? '#0C0C0B' : 'rgba(255,255,255,0.7)'}
              />
              <path
                d="M5 10a7 7 0 0 0 14 0"
                stroke={isListening ? '#0C0C0B' : 'rgba(255,255,255,0.7)'}
                strokeWidth="2"
                strokeLinecap="round"
              />
              <line
                x1="12"
                y1="17"
                x2="12"
                y2="21"
                stroke={isListening ? '#0C0C0B' : 'rgba(255,255,255,0.7)'}
                strokeWidth="2"
                strokeLinecap="round"
              />
              <line
                x1="9"
                y1="21"
                x2="15"
                y2="21"
                stroke={isListening ? '#0C0C0B' : 'rgba(255,255,255,0.7)'}
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Status Text */}
        <div style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '13px',
          color: isListening ? 'var(--accent)' : 'var(--muted)',
          transition: 'opacity 0.2s'
        }}>
          {isListening
            ? "Listening... say 'next', 'repeat', or 'done'"
            : "Tap to start voice control"}
        </div>

        {/* Last Transcribed Text */}
        {lastCommand && (
          <div style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '12px',
            color: 'var(--muted)',
            opacity: 0.6
          }}>
            {lastCommand}
          </div>
        )}

        {/* Voice Command Pills */}
        <div style={{
          display: 'flex',
          gap: '8px',
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          {['next', 'repeat', 'done'].map(cmd => (
            <div
              key={cmd}
              style={{
                background: activeCommandPill === cmd
                  ? 'rgba(232,123,79,0.15)'
                  : 'var(--surface)',
                border: `1px solid ${
                  activeCommandPill === cmd
                    ? 'rgba(232,123,79,0.4)'
                    : 'var(--border)'
                }`,
                color: activeCommandPill === cmd ? 'var(--accent)' : 'var(--muted)',
                borderRadius: '999px',
                padding: '5px 14px',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '13px',
                transition: 'all 0.2s ease'
              }}
            >
              {cmd}
            </div>
          ))}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="toast"
          style={{
            position: 'absolute',
            bottom: '300px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--glass)',
            border: '1px solid rgba(232,123,79,0.4)',
            borderRadius: 'var(--radius)',
            padding: '12px 20px',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '14px',
            color: 'var(--text)',
            whiteSpace: 'nowrap',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            animation: 'slideUp 0.3s ease forwards',
            zIndex: 10
          }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}
