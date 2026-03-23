import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Step  { id: number; text: string; timer: number | null }
interface Recipe { id: number; name: string; calories: number; macros: { P: number; C: number; F: number } }
interface SmartStepModeProps { recipe: Recipe; onExit: () => void }

// ─── Fallback steps ───────────────────────────────────────────────────────────
const GENERIC_STEPS: Step[] = [
  { id: 1, text: "Prepare all your ingredients — wash, chop, and measure everything before you start.", timer: null },
  { id: 2, text: "Heat your pan or pot over medium-high heat. Add oil when ready.", timer: null },
  { id: 3, text: "Add your aromatics first — garlic, onion, or spices. Cook until fragrant.", timer: 60 },
  { id: 4, text: "Add your main protein or vegetables. Cook until done.", timer: 180 },
  { id: 5, text: "Adjust seasoning to taste. Add salt, pepper, and any finishing herbs.", timer: null },
  { id: 6, text: "Rest for a moment before plating. This lets flavours settle.", timer: 30 },
  { id: 7, text: "Plate and serve. You're done — enjoy your meal.", timer: null },
]

// ─── AI API Service constants ──────────────────────────────────────────────────
const API_KEY       = import.meta.env.VITE_LLM_API_KEY as string
const API_BASE      = (import.meta.env.VITE_PRIMARY_INFERENCE_ENDPOINT as string) 
const STT_ENGINE    = (import.meta.env.VITE_SPEECH_RECOGNIZER_MODEL as string) 
const INFERENCE_LLM = (import.meta.env.VITE_CORE_REASONING_MODEL as string) 
const TTS_ENGINE    = (import.meta.env.VITE_VOICE_SYNTHESIS_MODEL as string) 
const VOICE_PROFILE = (import.meta.env.VITE_VOICE_SPEAKER_PROFILE as string) 

// ─── Cloud STT ─────────────────────────────────────────────────────────────────
async function remoteTranscribe(blob: Blob): Promise<string> {
  const ext  = blob.type.includes('ogg') ? 'ogg'
             : blob.type.includes('mp4') ? 'mp4'
             : blob.type.includes('webm') ? 'webm'
             : 'm4a'
  const form = new FormData()
  form.append('file', blob, `audio.${ext}`)
  form.append('model', STT_ENGINE)
  form.append('temperature', '0')
  form.append('response_format', 'verbose_json')
    const res  = await fetch(`${API_BASE}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${API_KEY}` },
      body: form,
    })
  if (!res.ok) return ''
  const data = await res.json()
  return (data.text as string || '').trim()
}

// ─── Cloud LLM ─────────────────────────────────────────────────────────────────
async function remoteAnswer(question: string, stepText: string, recipeName: string): Promise<string> {
  const res = await fetch(`${API_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: INFERENCE_LLM,
      messages: [
        {
          role: 'system',
          content: `You are a warm, expert cooking assistant helping someone cook "${recipeName}". They are currently on this step: "${stepText}". Answer their question in 1-3 short, conversational sentences. No markdown, no bullet points. Speak naturally.`,
        },
        { role: 'user', content: question },
      ],
      temperature: 0.7,
      max_completion_tokens: 120,
    }),
  })
  const data = await res.json()
  return (data.choices?.[0]?.message?.content as string || "I'm not sure about that.").trim()
}

// ─── Cloud TTS ─────────────────────────────────────────────────────────────────
async function remoteSpeak(text: string): Promise<void> {
  if (!text.trim()) return
  try {
    const res = await fetch(`${API_BASE}/audio/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({ model: TTS_ENGINE, voice: VOICE_PROFILE, input: text }),
    })
    if (!res.ok) throw new Error('TTS failed')
    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    await new Promise<void>((resolve) => {
      const audio = new Audio(url)
      audio.onended  = () => { URL.revokeObjectURL(url); resolve() }
      audio.onerror  = () => { URL.revokeObjectURL(url); resolve() }
      audio.play().catch(() => {
        // fallback to browser TTS
        URL.revokeObjectURL(url)
        browserSpeak(text, resolve)
      })
    })
  } catch {
    // fallback: Web Speech API
    await new Promise<void>((resolve) => browserSpeak(text, resolve))
  }
}

function browserSpeak(text: string, onDone: () => void) {
  if (!('speechSynthesis' in window)) { onDone(); return }
  window.speechSynthesis.cancel()
  const utt = new SpeechSynthesisUtterance(text)
  const voices = window.speechSynthesis.getVoices()
  const preferred = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google'))
    || voices.find(v => v.lang.startsWith('en-US'))
    || voices[0]
  if (preferred) utt.voice = preferred
  utt.rate = 0.95
  utt.onend = () => onDone()
  utt.onerror = () => onDone()
  window.speechSynthesis.speak(utt)
}

// ──────────────────────────────────────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────────────────────────────────────
export const SmartStepMode = ({ recipe, onExit }: SmartStepModeProps) => {
  // Step state
  const [steps, setSteps]               = useState<Step[] | null>(null)
  const [isGenerating, setIsGenerating] = useState(true)
  const [currentStep, setCurrentStep]   = useState(1)
  const [repeatKey, setRepeatKey]       = useState(0)
  const [isCompleted, setIsCompleted]   = useState(false)

  // Mic / voice state
  const [micStatus, setMicStatus]             = useState<'idle' | 'recording' | 'processing'>('idle')
  const [liveTranscript, setLiveTranscript]   = useState('')
  const [lastUserSaid, setLastUserSaid]       = useState('')
  const [aiResponse, setAiResponse]           = useState('')
  const [activeCommandPill, setActivePill]    = useState('')
  const [micError, setMicError]               = useState('')
  const [isSpeaking, setIsSpeaking]           = useState(false)

  // Timer
  const [timeRemaining, setTimeRemaining]     = useState<number | null>(null)
  const [isTimerPulsing, setIsTimerPulsing]   = useState(false)

  // UI
  const [toast, setToast]             = useState<string | null>(null)
  const [showExitModal, setShowExitModal] = useState(false)

  // Refs
  const stepsRef          = useRef<Step[] | null>(null)
  const currentStepRef    = useRef(1)
  const mediaRecorderRef  = useRef<MediaRecorder | null>(null)
  const chunksRef         = useRef<Blob[]>([])
  const mimeTypeRef       = useRef('audio/webm')
  const isRecordingRef    = useRef(false)
  const isSpeakingRef     = useRef(false)
  const isProcessingRef   = useRef(false)
  const timerIntervalRef  = useRef<number | undefined>(undefined)
  const toastTimeoutRef   = useRef<number | undefined>(undefined)
  const pillTimeoutRef    = useRef<number | undefined>(undefined)
  const streamRef         = useRef<MediaStream | null>(null)

  // keep refs synced
  useEffect(() => { stepsRef.current      = steps },       [steps])
  useEffect(() => { currentStepRef.current = currentStep }, [currentStep])
  useEffect(() => { isSpeakingRef.current  = isSpeaking },  [isSpeaking])

  // ── Toast ──────────────────────────────────────────────────────────────────
  const showToast = useCallback((msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    setToast(msg)
    toastTimeoutRef.current = window.setTimeout(() => setToast(null), 4000)
  }, [])

  // ── Pill ───────────────────────────────────────────────────────────────────
  const highlightPill = useCallback((cmd: string) => {
    if (pillTimeoutRef.current) clearTimeout(pillTimeoutRef.current)
    setActivePill(cmd)
    pillTimeoutRef.current = window.setTimeout(() => setActivePill(''), 1000)
  }, [])

  // ── Speak via Cloud TTS ────────────────────────────────────────────────────
  const speak = useCallback(async (text: string) => {
    setIsSpeaking(true)
    isSpeakingRef.current = true
    try {
      await remoteSpeak(text)
    } finally {
      setIsSpeaking(false)
      isSpeakingRef.current = false
    }
  }, [])

  // ── Navigation ─────────────────────────────────────────────────────────────
  const handleNext = useCallback(async () => {
    const s = stepsRef.current
    if (!s) return
    const next = currentStepRef.current + 1
    if (currentStepRef.current < s.length) {
      setCurrentStep(next)
      currentStepRef.current = next
      await speak(`Step ${next}. ${s[next - 1].text}`)
    } else {
      setIsCompleted(true)
      await speak("You've completed the recipe! Great cooking!")
    }
  }, [speak])

  const handlePrev = useCallback(async () => {
    const s = stepsRef.current
    if (!s || currentStepRef.current <= 1) return
    const prev = currentStepRef.current - 1
    setCurrentStep(prev)
    currentStepRef.current = prev
    await speak(`Going back. Step ${prev}. ${s[prev - 1].text}`)
  }, [speak])

  const handleRepeat = useCallback(async () => {
    const s = stepsRef.current
    if (!s) return
    setRepeatKey(p => p + 1)
    await speak(s[currentStepRef.current - 1].text)
  }, [speak])

  // ── Q&A via Cloud LLM ──────────────────────────────────────────────────────
  const handleQuestion = useCallback(async (question: string) => {
    const stepText = stepsRef.current?.[currentStepRef.current - 1]?.text ?? ''
    setAiResponse('')
    isProcessingRef.current = true
    setMicStatus('processing')
    try {
      const answer = await remoteAnswer(question, stepText, recipe.name)
      setAiResponse(answer)
      await speak(answer)
    } catch {
      await speak("Sorry, I had trouble answering that.")
    } finally {
      isProcessingRef.current = false
    }
  }, [recipe.name, speak])

  // ── Command parser ─────────────────────────────────────────────────────────
  const handleTranscript = useCallback(async (text: string) => {
    if (!text.trim()) return
    const t = text.toLowerCase().trim()
    console.log('[ChefAI] Transcript:', t)
    setLastUserSaid(`You: "${text}"`)
    setLiveTranscript('')

    if (t.includes('next') || t.includes('continue') || t.includes('forward')) {
      highlightPill('next')
      await handleNext()
    } else if (t.includes('back') || t.includes('previous') || t.includes('last') || t.includes('undo')) {
      highlightPill('back')
      await handlePrev()
    } else if (t.includes('repeat') || t.includes('again') || t.includes('say that again')) {
      highlightPill('repeat')
      await handleRepeat()
    } else if (t.includes('done') || t.includes('finish') || t.includes('exit') || t.includes('stop cooking') || t.includes('quit')) {
      highlightPill('done')
      onExit()
    } else {
      // Free-form question
      await handleQuestion(t)
    }
  }, [highlightPill, handleNext, handlePrev, handleRepeat, handleQuestion, onExit])

  // ── Single self-contained mic loop (no stale closures) ───────────────────
  const handleTranscriptRef = useRef(handleTranscript)
  useEffect(() => { handleTranscriptRef.current = handleTranscript }, [handleTranscript])

  useEffect(() => {
    let destroyed = false

    // Inner loop — defined locally so it always reads fresh refs
    const record = (recorder: MediaRecorder, mimeType: string) => {
      if (destroyed) return
      if (recorder.state !== 'inactive') return // already running, skip

      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }

      recorder.onstop = async () => {
        if (destroyed) return
        const blob = new Blob(chunks, { type: mimeType })

        // Always restart first so mic is never off
        setTimeout(() => record(recorder, mimeType), 80)

        // Skip transcription only while AI is actively speaking
        if (isSpeakingRef.current) return
        if (blob.size < 500) return // genuine silence

        setMicStatus('processing')
        try {
          const text = await remoteTranscribe(blob)
          console.log('[Whisper]', text)
          if (text && text.trim().length > 1) {
            setLiveTranscript(text)
            setLastUserSaid(`You: "${text.trim()}"`)
            await handleTranscriptRef.current(text.trim())
          }
        } catch (err) {
          console.warn('Transcribe error:', err)
        } finally {
          if (!isSpeakingRef.current) setMicStatus('recording')
        }
      }

      recorder.onerror = () => {
        setTimeout(() => record(recorder, mimeType), 300)
      }

      try {
        recorder.start()
        setMicStatus('recording')
      } catch (e) {
        console.warn('recorder.start error:', e)
        setTimeout(() => record(recorder, mimeType), 500)
      }

      // Stop after CHUNK_MS to flush the audio
      setTimeout(() => {
        if (!destroyed && recorder.state === 'recording') recorder.stop()
      }, 4500)
    }

    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      .then(stream => {
        if (destroyed) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream

        const mimes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
        const mime  = mimes.find(m => MediaRecorder.isTypeSupported(m)) || ''
        const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
        mediaRecorderRef.current = recorder

        setMicError('')
        console.log('[Mic] Ready. Starting loop.')
        record(recorder, mime || 'audio/webm')
      })
      .catch(err => {
        console.error('[Mic] Permission error:', err)
        setMicError('Microphone blocked. Please allow mic access and reload.')
      })

    return () => {
      destroyed = true
      try { mediaRecorderRef.current?.stop() } catch (_) {}
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Speak first step when steps load ──────────────────────────────────────
  useEffect(() => {
    if (isGenerating || !steps) return
    speak(`Let's cook ${recipe.name}. ${steps[0].text}`)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGenerating])

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showExitModal) return
      if (e.key === 'ArrowRight') { e.preventDefault(); handleNext() }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); handlePrev() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleNext, handlePrev, showExitModal])

  // ── Fetch steps via Cloud API ───────────────────────────────────────────────────
  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch(`${API_BASE}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
          body: JSON.stringify({
            model: INFERENCE_LLM,
            messages: [{
              role: 'system',
              content: `You are an AI chef. Generate a clear, detailed step-by-step recipe for "${recipe.name}". Output ONLY a valid JSON array with no markdown, no code fences, no commentary. Steps should be phrased naturally for speaking aloud. Schema: [{ "id": number, "text": string, "timer": number | null }]`,
            }],
            temperature: 0.5,
            max_completion_tokens: 1200,
          }),
        })
        const data    = await res.json()
        const content = data.choices?.[0]?.message?.content ?? ''
        const start   = content.indexOf('[')
        const end     = content.lastIndexOf(']')
        if (start !== -1 && end !== -1) {
          const parsed = JSON.parse(content.slice(start, end + 1)) as Step[]
          setSteps(parsed.length > 0 ? parsed : GENERIC_STEPS)
        } else {
          setSteps(GENERIC_STEPS)
        }
      } catch {
        setSteps(GENERIC_STEPS)
      } finally {
        setIsGenerating(false)
      }
    }
    fetch_()
  }, [recipe.name])

  // ── Timer ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!steps) return
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    setIsTimerPulsing(false)
    const stepData = steps[currentStep - 1]
    if (stepData?.timer) {
      setTimeRemaining(stepData.timer)
      let alerted = false
      timerIntervalRef.current = window.setInterval(() => {
        setTimeRemaining(prev => {
          if (prev === null || prev <= 0) {
            clearInterval(timerIntervalRef.current)
            showToast('⏱️ Timer done! Ready for next step')
            speak('Time is up! Check your dish.')
            setIsTimerPulsing(true)
            return 0
          }
          if (prev === 10 && !alerted) { alerted = true; showToast('⏱ 10 seconds left') }
          return prev - 1
        })
      }, 1000)
    } else {
      setTimeRemaining(null)
    }
    return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current) }
  }, [currentStep, steps, showToast, speak])

  // ── Cleanup ────────────────────────────────────────────────────────────────
  useEffect(() => () => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    if (pillTimeoutRef.current) clearTimeout(pillTimeoutRef.current)
    window.speechSynthesis.cancel()
    mediaRecorderRef.current?.stop()
    streamRef.current?.getTracks().forEach(t => t.stop())
  }, [])

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  // ── Loading screen ─────────────────────────────────────────────────────────
  if (isGenerating || !steps) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: '#0C0C0B',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', zIndex: 200, gap: '20px',
      }}>
        <div style={{
          width: '44px', height: '44px',
          border: '3px solid rgba(255,255,255,0.08)',
          borderTop: '3px solid #E87B4F',
          borderRadius: '50%',
          animation: 'spin 0.9s linear infinite',
        }} />
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '15px', color: 'rgba(255,255,255,0.4)' }}>
          Preparing your recipe…
        </div>
      </div>
    )
  }

  const totalSteps     = steps.length
  const currentStepData = steps[currentStep - 1]

  // ── Completion screen ──────────────────────────────────────────────────────
  if (isCompleted) {
    return (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}
        style={{
          position: 'fixed', inset: 0, background: '#0C0C0B',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200, padding: '24px',
        }}>
        <div style={{ textAlign: 'center', maxWidth: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            style={{ color: '#E87B4F', marginBottom: '20px' }}>
            <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </motion.div>
          <h1 style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: '38px', color: 'rgba(255,255,255,0.88)', marginBottom: '8px', fontWeight: '600' }}>
            Dish complete.
          </h1>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '18px', color: 'rgba(255,255,255,0.4)', marginBottom: '32px' }}>
            {recipe.name}
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)',
            backdropFilter: 'blur(12px)', borderRadius: '14px',
            padding: '20px', width: '100%', marginBottom: '32px',
          }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px', fontWeight: '500' }}>Final Macros</div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {[
                { label: `${recipe.calories} kcal`, accent: true },
                { label: `${recipe.macros.P}g Protein`, accent: false },
                { label: `${recipe.macros.C}g Carbs`,   accent: false },
                { label: `${recipe.macros.F}g Fat`,     accent: false },
              ].map(({ label, accent }) => (
                <span key={label} style={{
                  background: accent ? 'rgba(232,123,79,0.1)' : 'rgba(255,255,255,0.06)',
                  color: accent ? '#E87B4F' : 'rgba(255,255,255,0.8)',
                  padding: '5px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: '600',
                }}>{label}</span>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
            <button onClick={() => { window.speechSynthesis.cancel(); onExit() }}
              style={{
                flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)',
                color: 'rgba(255,255,255,0.88)', borderRadius: '14px', padding: '14px',
                cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontSize: '14px', fontWeight: '600',
                transition: 'all 0.2s ease',
              }}>
              🍳 Cook again
            </button>
            <button onClick={() => { setCurrentStep(1); setIsCompleted(false) }}
              style={{
                flex: 1, background: '#E87B4F', color: '#0C0C0B', border: 'none',
                borderRadius: '14px', padding: '14px', cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif", fontSize: '14px', fontWeight: '600',
                transition: 'all 0.2s ease',
              }}>
              🔄 Start over
            </button>
          </div>
        </div>
      </motion.div>
    )
  }

  // ── Mic visual state ───────────────────────────────────────────────────────
  const micIsActive   = micStatus === 'recording'
  const micStatusText = micError
    ? micError
    : isSpeaking
    ? '🔊 AI speaking…'
    : micStatus === 'processing'
    ? '⚙️ Processing…'
    : micIsActive
    ? '🎙️ Listening — speak freely'
    : '🎙️ Starting mic…'

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200, background: '#0C0C0B',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      fontFamily: "'DM Sans', sans-serif",
    }}>

      {/* Progress bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'rgba(255,255,255,0.06)', zIndex: 3 }}>
        <motion.div
          style={{ background: '#E87B4F', height: '100%' }}
          animate={{ width: `${(currentStep / totalSteps) * 100}%` }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
        />
      </div>

      {/* Exit modal */}
      <AnimatePresence>
        {showExitModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'absolute', inset: 0, zIndex: 300,
              background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
            }}>
            <motion.div
              initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 12 }}
              style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)',
                borderRadius: '14px', padding: '28px', width: '100%', maxWidth: '320px', textAlign: 'center',
              }}>
              <h3 style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: '20px', fontWeight: '500', marginBottom: '8px', color: 'rgba(255,255,255,0.88)' }}>Leave recipe?</h3>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', marginBottom: '24px' }}>Your progress will be lost.</p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setShowExitModal(false)}
                  style={{ flex: 1, padding: '11px', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.88)', cursor: 'pointer', fontSize: '14px' }}>
                  Cancel
                </button>
                <button onClick={() => { window.speechSynthesis.cancel(); onExit() }}
                  style={{ flex: 1, padding: '11px', borderRadius: '10px', background: '#E87B4F', border: 'none', color: '#0C0C0B', fontWeight: '700', cursor: 'pointer', fontSize: '14px' }}>
                  Leave
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top bar */}
      <div style={{ height: '60px', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 2 }}>
        <button onClick={() => setShowExitModal(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', opacity: 0.5, display: 'flex', alignItems: 'center', transition: 'opacity 0.2s' }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.88)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', fontWeight: '500', letterSpacing: '0.5px' }}>
            STEP {currentStep} / {totalSteps}
          </div>
          <AnimatePresence>
            {timeRemaining !== null && (
              <motion.div
                initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                style={{ fontFamily: "'DM Mono', monospace", fontSize: '18px', color: '#E87B4F', fontWeight: '700' }}>
                {fmt(timeRemaining)}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── TOP ZONE: Step text (60%) ──────────────────────────────────────── */}
      <div style={{
        flex: '0 0 56%', display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: '0 36px 24px',
      }}>
        <div style={{ maxWidth: '640px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={`${currentStep}-${repeatKey}`}
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0, scale: isTimerPulsing ? [1, 1.015, 1] : 1 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.25, ease: 'easeInOut' as const }}
              style={{
                fontFamily: "'Instrument Sans', sans-serif",
                fontSize: 'clamp(22px, 4vw, 34px)',
                fontWeight: '500',
                color: 'rgba(255,255,255,0.88)',
                lineHeight: '1.5',
                textAlign: 'center',
                textShadow: '0 4px 32px rgba(0,0,0,0.6)',
              }}>
              {currentStepData.text}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ── BOTTOM ZONE: Voice panel (40%) ────────────────────────────────── */}
      <div style={{
        flex: '1',
        background: 'rgba(255,255,255,0.03)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '20px 24px 28px', gap: '0', position: 'relative',
      }}>

        {/* Command pills */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          {[
            { cmd: 'next',   label: '→ next'   },
            { cmd: 'repeat', label: '↺ repeat' },
            { cmd: 'back',   label: '← back'   },
            { cmd: 'done',   label: '✓ done'   },
          ].map(({ cmd, label }) => {
            const isActive = activeCommandPill === cmd
            return (
              <div key={cmd} style={{
                background:  isActive ? 'rgba(232,123,79,0.15)' : 'rgba(255,255,255,0.05)',
                border:     `1px solid ${isActive ? 'rgba(232,123,79,0.55)' : 'rgba(255,255,255,0.09)'}`,
                color:       isActive ? '#E87B4F' : 'rgba(255,255,255,0.35)',
                borderRadius: '20px', padding: '5px 14px',
                fontSize: '12px', fontWeight: '500',
                transition: 'all 0.15s ease',
                boxShadow: isActive ? '0 0 14px rgba(232,123,79,0.2)' : 'none',
              }}>
                {label}
              </div>
            )
          })}
        </div>

        {/* Mic Button */}
        <div style={{ position: 'relative', width: '84px', height: '84px', flexShrink: 0 }}>
          {/* Pulsing rings when recording */}
          {micIsActive && !isSpeaking && (
            <>
              <div style={{ position: 'absolute', inset: '-14px', borderRadius: '50%', border: '2px solid rgba(232,123,79,0.5)', animation: 'ping 1.8s ease-out infinite' }} />
              <div style={{ position: 'absolute', inset: '-26px', borderRadius: '50%', border: '2px solid rgba(232,123,79,0.2)', animation: 'ping 1.8s ease-out infinite', animationDelay: '0.6s' }} />
            </>
          )}
          <div style={{
            width: '84px', height: '84px', borderRadius: '50%',
            background: isSpeaking
              ? 'rgba(255,255,255,0.06)'
              : micIsActive
              ? '#E87B4F'
              : 'rgba(232,123,79,0.7)',
            border: `1px solid ${micIsActive && !isSpeaking ? '#E87B4F' : 'rgba(255,255,255,0.1)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative', zIndex: 1,
            transition: 'all 0.3s ease',
            boxShadow: micIsActive && !isSpeaking ? '0 0 32px rgba(232,123,79,0.3)' : 'none',
          }}>
            {isSpeaking ? (
              // Speaker wave icon
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
              </svg>
            ) : (
              // Mic icon
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <rect x="9" y="2" width="6" height="12" rx="3"
                  fill={micIsActive ? '#0C0C0B' : 'rgba(255,255,255,0.85)'} />
                <path d="M5 10a7 7 0 0 0 14 0"
                  stroke={micIsActive ? '#0C0C0B' : 'rgba(255,255,255,0.85)'} strokeWidth="2" strokeLinecap="round" />
                <line x1="12" y1="17" x2="12" y2="21"
                  stroke={micIsActive ? '#0C0C0B' : 'rgba(255,255,255,0.85)'} strokeWidth="2" strokeLinecap="round" />
                <line x1="9" y1="21" x2="15" y2="21"
                  stroke={micIsActive ? '#0C0C0B' : 'rgba(255,255,255,0.85)'} strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
          </div>
        </div>

        {/* Mic status label */}
        <div style={{
          marginTop: '12px',
          fontSize: '13px',
          color: micError ? '#ff6b6b' : isSpeaking ? 'rgba(255,255,255,0.5)' : micIsActive ? 'rgba(232,123,79,0.85)' : 'rgba(255,255,255,0.35)',
          fontStyle: 'italic',
          minHeight: '20px',
          transition: 'color 0.3s',
        }}>
          {micStatusText}
        </div>

        {/* Live / last transcript */}
        {(liveTranscript || lastUserSaid) && (
          <div style={{
            marginTop: '8px',
            fontSize: '12px',
            color: 'rgba(255,255,255,0.35)',
            fontStyle: 'italic',
            maxWidth: '380px',
            textAlign: 'center',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {liveTranscript || lastUserSaid}
          </div>
        )}

        {/* AI response box */}
        <AnimatePresence>
          {(aiResponse || (micStatus === 'processing' && !isSpeaking && !micIsActive)) && (
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
              style={{
                maxWidth: '460px', width: '100%', marginTop: '12px',
                background: 'rgba(232,123,79,0.07)',
                border: '1px solid rgba(232,123,79,0.2)',
                borderRadius: '12px', padding: '12px 16px',
                fontSize: '14px', color: 'rgba(255,255,255,0.8)',
                lineHeight: '1.55', textAlign: 'center',
              }}>
              {aiResponse || <span style={{ opacity: 0.4 }}>Thinking…</span>}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Nav buttons */}
        <div style={{ display: 'flex', gap: '10px', marginTop: 'auto', paddingTop: '12px' }}>
          <button onClick={handlePrev} disabled={currentStep === 1}
            style={{
              background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.09)', borderRadius: '10px',
              padding: '9px 20px', color: 'rgba(255,255,255,0.7)',
              cursor: currentStep === 1 ? 'default' : 'pointer',
              opacity: currentStep === 1 ? 0.3 : 1,
              fontSize: '13px', transition: 'all 0.2s',
            }}>
            ← Prev
          </button>
          <button onClick={handleNext}
            style={{
              background: 'rgba(232,123,79,0.12)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(232,123,79,0.25)', borderRadius: '10px',
              padding: '9px 20px', color: '#E87B4F',
              cursor: 'pointer', fontSize: '13px', fontWeight: '600',
              transition: 'all 0.2s',
            }}>
            Next →
          </button>
        </div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
            style={{
              position: 'absolute', bottom: '180px', left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(255,255,255,0.06)', border: '1px solid #E87B4F',
              borderRadius: '10px', padding: '11px 20px',
              fontSize: '14px', color: 'rgba(255,255,255,0.88)', whiteSpace: 'nowrap',
              backdropFilter: 'blur(12px)', zIndex: 10,
              boxShadow: '0 8px 32px rgba(232,123,79,0.15)',
            }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
