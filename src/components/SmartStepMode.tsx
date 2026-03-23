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
  const [steps, setSteps] = useState<Step[] | null>(null)
  const [isGenerating, setIsGenerating] = useState(true)
  
  const [currentStep, setCurrentStep] = useState(1)
  const [isListening, setIsListening] = useState(true) // Always live by default
  const [isSynthesizing, setIsSynthesizing] = useState(false)
  const [isProcessingAudio, setIsProcessingAudio] = useState(false)
  const [lastCommand, setLastCommand] = useState('')
  const [activeCommandPill, setActiveCommandPill] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [repeatKey, setRepeatKey] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [isCompleted, setIsCompleted] = useState(false)
  
  const toastTimeoutRef = useRef<number | undefined>(undefined)
  const timerIntervalRef = useRef<number | undefined>(undefined)
  const recognitionRef = useRef<any>(null)
  const hasSpokenInitialRef = useRef(false)

  // 1. Generate Voice-Friendly Steps from the Recipe Name on mount
  useEffect(() => {
    const fetchSteps = async () => {
      try {
        const apiUrl = import.meta.env.VITE_LLM_API_URL || 'https://api.groq.com/openai/v1/chat/completions'
        const apiKey = import.meta.env.VITE_LLM_API_KEY
        if (!apiKey) throw new Error("No API key")
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: "meta-llama/llama-4-scout-17b-16e-instruct",
            messages: [
              {
                role: "system",
                 content: `You are an AI chef. Generate a step-by-step recipe for "${recipe.name}". Output ONLY a valid JSON array of objects. DO NOT use markdown code blocks (\`\`\`). Keep steps conversational so they can be spoken aloud.
Schema per object: { "id": number (from 1), "text": string (instruction), "timer": number | null (seconds if cooking/waiting) }`
              }
            ],
            temperature: 0.6
          })
        })
        const data = await response.json()
        const content = data.choices[0]?.message?.content || ""
        const jsonStr = content.substring(content.indexOf('['), content.lastIndexOf(']') + 1)
        const parsedSteps = JSON.parse(jsonStr) as Step[]
        
        setSteps(parsedSteps.length > 0 ? parsedSteps : GENERIC_STEPS)
      } catch (err) {
        console.error("Step gen error:", err)
        setSteps(GENERIC_STEPS)
      } finally {
        setIsGenerating(false)
      }
    }
    fetchSteps()
  }, [recipe.name])

  // Helpers
  const showToast = (message: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    setToast(message)
    toastTimeoutRef.current = setTimeout(() => setToast(null), 4000)
  }

  const speak = (text: string, onEnd?: () => void) => {
    if (!('speechSynthesis' in window)) {
      if (onEnd) onEnd()
      return
    }
    
    // Pause mic so we don't hear ourselves
    setIsSynthesizing(true)
    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch(e){}
    }
    
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    
    const voices = window.speechSynthesis.getVoices()
    const niceVoice = voices.find(v => v.lang.includes('en-') && (v.name.includes('Google') || v.name.includes('Samantha'))) || voices[0]
    if (niceVoice) utterance.voice = niceVoice
    
    utterance.onend = () => {
      setIsSynthesizing(false)
      if (onEnd) onEnd()
    }
    utterance.onerror = () => setIsSynthesizing(false)
    
    window.speechSynthesis.speak(utterance)
  }

  const handleNext = () => {
    if (!steps) return
    if (currentStep < steps.length) {
      setCurrentStep(prev => prev + 1)
    } else {
      setIsCompleted(true)
      speak("You have completed the recipe! Great job!")
    }
  }

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1)
    }
  }

  // Handle conversational questions dynamically!
  const handleUserQuery = async (query: string, stepText: string) => {
    setIsProcessingAudio(true)
    try {
       const apiUrl = import.meta.env.VITE_LLM_API_URL || 'https://api.groq.com/openai/v1/chat/completions'
       const apiKey = import.meta.env.VITE_LLM_API_KEY
       if (!apiKey) throw new Error("No API key")

       const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({
             model: "meta-llama/llama-4-scout-17b-16e-instruct",
             messages: [
               {
                 role: "system",
                 content: `You are an AI cooking assistant. The user is cooking ${recipe.name}. They are on this step: "${stepText}". They just said: "${query}". Answer them in 1-2 short conversational sentences meant to be spoken aloud. No markdown.`
               }
             ],
             temperature: 0.7,
             max_completion_tokens: 150
          })
       })
       const data = await res.json()
       const answer = data.choices[0]?.message?.content || "I'm not sure about that."
       setLastCommand(`AI: ${answer}`)
       speak(answer)
    } catch(e) {
       speak("Sorry, I had trouble thinking about that.")
    } finally {
       setIsProcessingAudio(false)
    }
  }

  // 2. Setup Mic Web Speech API
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      showToast("Speech recognition not supported in your browser.")
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'en-US'
    recognitionRef.current = recognition

    recognition.onresult = (event: any) => {
      if (isSynthesizing || isProcessingAudio || !steps) return
      
      const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase()
      setLastCommand(`You said: "${transcript}"`)
      
      if (transcript.includes('next')) {
        setActiveCommandPill('next')
        handleNext()
      } else if (transcript.includes('back') || transcript.includes('previous')) {
        setActiveCommandPill('back')
        handlePrev()
      } else if (transcript.includes('repeat')) {
        setActiveCommandPill('repeat')
        speak(steps[currentStep - 1].text)
        setRepeatKey(prev => prev + 1)
      } else if (transcript.includes('done') || transcript.includes('exit')) {
        setActiveCommandPill('done')
        onExit()
      } else {
        handleUserQuery(transcript, steps[currentStep - 1].text)
      }
      
      setTimeout(() => setActiveCommandPill(''), 1000)
    }

    recognition.onerror = (e: any) => {
       console.warn("Speech Error:", e.error)
    }
    
    recognition.onend = () => {
      if (isListening && !isSynthesizing) {
         try { recognition.start() } catch (e) {}
      }
    }

    if (isListening && !isSynthesizing) {
      try { recognition.start() } catch (e) {}
    }

    return () => {
      recognition.abort()
    }
  }, [isListening, currentStep, steps, isSynthesizing, isProcessingAudio, recipe.name])

  // Ensure mic respects synthesizing state
  useEffect(() => {
     if (isSynthesizing && recognitionRef.current) {
         try { recognitionRef.current.abort() } catch(e){}
     } else if (!isSynthesizing && isListening && recognitionRef.current) {
         try { recognitionRef.current.start() } catch(e){}
     }
  }, [isSynthesizing, isListening])

  // Read step out loud when the step changes
  useEffect(() => {
    if (steps && !isGenerating) {
      if (!hasSpokenInitialRef.current) {
         hasSpokenInitialRef.current = true
         speak(`Let's make ${recipe.name}. Step 1. ` + steps[0].text)
      } else {
         speak(steps[currentStep - 1].text)
      }
    }
  }, [currentStep, steps, isGenerating])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
      window.speechSynthesis.cancel()
    }
  }, [])

  // Timer logic
  useEffect(() => {
    if (!steps) return
    const currentStepData = steps[currentStep - 1]
    
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    
    if (currentStepData.timer) {
      setTimeRemaining(currentStepData.timer)
      let hasShown10s = false

      timerIntervalRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev === null || prev <= 0) {
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
            showToast("⏱ Time's up! Check your progress.")
            speak("Time is up!")
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
  }, [currentStep, steps])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (isGenerating || !steps) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, flexDirection: 'column' }}>
        <h2 style={{ color: 'var(--accent)', fontFamily: "'Instrument Sans', sans-serif" }}>Generating recipe instructions...</h2>
      </div>
    )
  }

  const totalSteps = steps.length
  const currentStepData = steps[currentStep - 1]

  if (isCompleted) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: 'var(--bg)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', zIndex: 200, padding: '24px'
      }}>
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎉</div>
          <h1 style={{
            fontFamily: "'Instrument Sans', sans-serif", fontSize: '36px', color: 'var(--text)',
            marginBottom: '8px', fontWeight: '600'
          }}>You're done!</h1>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '16px', color: 'var(--muted)', marginBottom: '8px' }}>
            {recipe.name}
          </div>
          <button
            onClick={() => { window.speechSynthesis.cancel(); onExit(); }}
            style={{
              background: 'var(--accent)', color: '#0C0C0B', border: 'none', borderRadius: 'var(--radius)',
              padding: '14px 32px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontSize: '16px',
              fontWeight: '600', transition: 'opacity 0.2s', marginTop: '24px'
            }}
          >Back to recipes</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200, background: 'var(--bg)', display: 'flex',
      flexDirection: 'column', overflow: 'hidden'
    }}>
      {/* Progress Bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'var(--surface)', zIndex: 3 }}>
        <div style={{ background: 'var(--accent)', height: '100%', width: `${(currentStep / totalSteps) * 100}%`, transition: 'width 0.5s ease' }} />
      </div>

      {/* Top Bar */}
      <div style={{ height: '56px', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
        <button
          onClick={() => { if (window.confirm('Leave this recipe? Your progress will be lost.')) { window.speechSynthesis.cancel(); onExit() } }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontSize: '14px', color: 'var(--muted)' }}
        >← Back</button>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', color: 'var(--muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {recipe.name}
        </div>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', color: 'var(--muted)' }}>
          Step {currentStep} of {totalSteps}
        </div>
      </div>

      {/* Top Half - Step Display */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 32px', textAlign: 'center', maxWidth: '680px', margin: '0 auto', width: '100%' }}>
        <div
          key={`${currentStep}-${repeatKey}`}
          className="step-text"
          style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: '32px', fontWeight: '500', color: 'var(--text)', lineHeight: '1.45', opacity: 0, animation: 'stepIn 0.4s ease forwards' }}
        >
          {currentStepData.text}
        </div>

        {timeRemaining !== null && timeRemaining > 0 && (
          <div style={{ marginTop: '20px' }}>
            <div style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: '48px', fontWeight: '300', color: 'var(--accent)' }}>
              {formatTime(timeRemaining)}
            </div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: 'var(--muted)' }}>remaining</div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', marginTop: '32px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button onClick={handlePrev} disabled={currentStep === 1} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 20px', fontFamily: "'DM Sans', sans-serif", fontSize: '14px', color: 'var(--text)', cursor: currentStep === 1 ? 'default' : 'pointer', opacity: currentStep === 1 ? 0.3 : 1 }}>← Prev</button>
          <button onClick={handleNext} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 20px', fontFamily: "'DM Sans', sans-serif", fontSize: '14px', color: 'var(--text)', cursor: 'pointer' }}>Next →</button>
        </div>
      </div>

      {/* Bottom Half - Voice Panel */}
      <div style={{ height: '280px', background: 'var(--glass)', borderTop: '1px solid var(--glass-border)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '24px', position: 'relative' }}>
        
        {/* Mic Button */}
        <div style={{ position: 'relative', width: '80px', height: '80px' }}>
          {(isListening && !isSynthesizing && !isProcessingAudio) && (
            <>
              <div className="ping-ring-1" style={{ position: 'absolute', inset: '-12px', borderRadius: '50%', border: '2px solid rgba(232,123,79,0.5)', animation: 'ping 1.5s ease-out infinite' }} />
              <div className="ping-ring-2" style={{ position: 'absolute', inset: '-24px', borderRadius: '50%', border: '2px solid rgba(232,123,79,0.25)', animation: 'ping 1.5s ease-out infinite', animationDelay: '0.4s' }} />
            </>
          )}
          <button
            onClick={() => setIsListening(!isListening)}
            style={{ width: '80px', height: '80px', borderRadius: '50%', background: isListening ? 'var(--accent)' : 'var(--surface)', border: `2px solid ${isListening ? 'var(--accent)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.3s ease', zIndex: 1, position: 'relative' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="9" y="2" width="6" height="12" rx="3" fill={isListening ? '#0C0C0B' : 'rgba(255,255,255,0.7)'} />
              <path d="M5 10a7 7 0 0 0 14 0" stroke={isListening ? '#0C0C0B' : 'rgba(255,255,255,0.7)'} strokeWidth="2" strokeLinecap="round" />
              <line x1="12" y1="17" x2="12" y2="21" stroke={isListening ? '#0C0C0B' : 'rgba(255,255,255,0.7)'} strokeWidth="2" strokeLinecap="round" />
              <line x1="9" y1="21" x2="15" y2="21" stroke={isListening ? '#0C0C0B' : 'rgba(255,255,255,0.7)'} strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', color: isListening ? 'var(--accent)' : 'var(--muted)', transition: 'opacity 0.2s' }}>
          {isProcessingAudio ? "AI is thinking..." : isSynthesizing ? "AI Chef is speaking..." : isListening ? "Listening... say 'next', 'back', 'repeat', or ask a question" : "Mic paused"}
        </div>
        {lastCommand && <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: 'var(--muted)', opacity: 0.6 }}>{lastCommand}</div>}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {['next', 'back', 'repeat', 'done'].map(cmd => (
            <div key={cmd} style={{ background: activeCommandPill === cmd ? 'rgba(232,123,79,0.15)' : 'var(--surface)', border: `1px solid ${activeCommandPill === cmd ? 'rgba(232,123,79,0.4)' : 'var(--border)'}`, color: activeCommandPill === cmd ? 'var(--accent)' : 'var(--muted)', borderRadius: '999px', padding: '5px 14px', fontFamily: "'DM Sans', sans-serif", fontSize: '13px', transition: 'all 0.2s ease' }}>{cmd}</div>
          ))}
        </div>
      </div>

      {toast && (
        <div className="toast" style={{ position: 'absolute', bottom: '300px', left: '50%', transform: 'translateX(-50%)', background: 'var(--glass)', border: '1px solid rgba(232,123,79,0.4)', borderRadius: 'var(--radius)', padding: '12px 20px', fontFamily: "'DM Sans', sans-serif", fontSize: '14px', color: 'var(--text)', whiteSpace: 'nowrap', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', animation: 'slideUp 0.3s ease forwards', zIndex: 10 }}>{toast}</div>
      )}
    </div>
  )
}
