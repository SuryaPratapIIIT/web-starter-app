import { useState, useRef, useEffect } from 'react'

interface IngredientScannerProps {
  onIngredientsConfirmed: (ingredients: string[]) => void
}

export const IngredientScanner = ({ onIngredientsConfirmed }: IngredientScannerProps) => {
  const [isDragging, setIsDragging] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [detectedIngredients, setDetectedIngredients] = useState<string[]>([])
  const [showChips, setShowChips] = useState(false)
  const [showCTA, setShowCTA] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImage = (file: File) => {
    if (!file || !file.type.startsWith('image/')) return

    const reader = new FileReader()
    reader.onload = async (e) => {
      const base64Image = e.target?.result as string
      setImagePreview(base64Image)
      setIsScanning(true)

      try {
        const apiUrl = import.meta.env.VITE_LLM_API_URL || 'https://api.groq.com/openai/v1/chat/completions'
        const apiKey = import.meta.env.VITE_LLM_API_KEY

        if (!apiKey) {
          console.warn("API Key not found in environment variables. Set VITE_LLM_API_KEY in .env")
          setDetectedIngredients(["Garlic", "Olive Oil", "Tomatoes (Fallback)"])
          setIsScanning(false)
          setShowChips(true)
          setShowCTA(true)
          return
        }

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
                role: "user",
                content: [
                  { type: "text", text: "Identify the main raw food ingredients in this image. Return ONLY a comma-separated list of the ingredients (e.g., 'Tomato, Onion, Garlic'). No other text or explanation." },
                  { type: "image_url", image_url: { url: base64Image } }
                ]
              }
            ],
            temperature: 0.1,
            max_completion_tokens: 150,
            top_p: 1,
            stream: true
          })
        })

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`)
        }

        if (!response.body) throw new Error("No response body available to stream");

        const streamReader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let fullContent = "";

        // Prepare UI for real-time chips
        setShowChips(true);

        while (true) {
          const { done, value } = await streamReader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6).trim();
              if (dataStr === '[DONE]') break;
              if (!dataStr) continue;
              
              try {
                const parsed = JSON.parse(dataStr);
                const textChunk = parsed.choices[0]?.delta?.content || "";
                fullContent += textChunk;
                
                // Real-time chip parsing
                const ingredients = fullContent.split(',')
                  .map((s) => s.trim().replace(/^['"*\-.]+/, '').replace(/['"*\-.]+$/, ''))
                  .filter(Boolean);
                
                setDetectedIngredients(ingredients);
              } catch (err) {
                // Ignore incomplete JSON chunks during stream iteration
              }
            }
          }
        }
        
        // Finished streaming
        setIsScanning(false);
        setShowCTA(true);

      } catch (error) {
        console.error("Error recognizing ingredients:", error)
        setDetectedIngredients(["Error scanning image"])
        setIsScanning(false)
        setShowChips(true)
        setShowCTA(true)
      }
    }
    reader.readAsDataURL(file)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleImage(file)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleImage(file)
  }

  const handleReset = () => {
    setImagePreview(null)
    setDetectedIngredients([])
    setShowChips(false)
    setShowCTA(false)
    setIsScanning(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <section style={{
      width: '100%',
      maxWidth: '720px',
      margin: '0 auto',
      padding: '60px 24px'
    }}>
      {/* Section Label */}
      <div style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: '12px',
        color: 'var(--muted)',
        textTransform: 'uppercase',
        letterSpacing: '1.5px',
        fontWeight: '600',
        marginBottom: '24px',
        textAlign: 'center'
      }}>
        Step 1 — What's in your kitchen?
      </div>

      {/* Upload Zone */}
      <div
        onClick={() => !imagePreview && fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        style={{
          minHeight: '340px',
          background: 'var(--surface)',
          border: `1px dashed ${isDragging ? 'var(--accent)' : 'rgba(255,255,255,0.18)'}`,
          borderRadius: 'var(--radius)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: imagePreview ? 'default' : 'pointer',
          position: 'relative',
          overflow: 'hidden',
          transition: 'border-color 0.2s'
        }}
      >
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        {/* EMPTY STATE */}
        {!imagePreview && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '40px' }}>📸</div>
            <div style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '16px',
              color: 'var(--muted)'
            }}>
              Drop a photo of your ingredients
            </div>
            <div style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '13px',
              color: 'var(--muted)',
              opacity: 0.5
            }}>
              or click to browse
            </div>
          </div>
        )}

        {/* IMAGE LOADED STATE */}
        {imagePreview && (
          <>
            {/* Background Image */}
            <img
              src={imagePreview}
              alt="Your ingredients"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />

            {/* Frosted Overlay */}
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(12,12,11,0.55)',
              backdropFilter: 'blur(2px)',
              WebkitBackdropFilter: 'blur(2px)',
              zIndex: 1
            }} />

            {/* Scanning Animation */}
            {isScanning && (
              <div style={{
                position: 'absolute',
                zIndex: 2,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px'
              }}>
                <div className="scanning-line" style={{
                  width: '200px',
                  height: '2px',
                  background: 'var(--accent)',
                  opacity: 0.7
                }} />
                <div style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '14px',
                  color: 'var(--muted)'
                }}>
                  Scanning ingredients...
                </div>
              </div>
            )}

            {/* Ingredient Chips */}
            {showChips && detectedIngredients.length > 0 && (
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                padding: '20px',
                zIndex: 2,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
              }}>
                {/* Count Badge */}
                <div style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '13px',
                  color: 'var(--muted)',
                  marginBottom: '10px'
                }}>
                  {detectedIngredients.length} ingredients detected
                </div>

                {/* Chips */}
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px',
                  justifyContent: 'center'
                }}>
                  {detectedIngredients.map((ingredient, index) => (
                    <div
                      key={ingredient}
                      className="ingredient-chip"
                      style={{
                        background: 'rgba(232,123,79,0.12)',
                        border: '1px solid rgba(232,123,79,0.3)',
                        color: 'var(--accent)',
                        borderRadius: '8px',
                        padding: '6px 14px',
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: '14px',
                        fontWeight: '500',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        opacity: 0,
                        animation: 'chipIn 0.3s ease forwards',
                        animationDelay: `${index * 80}ms`
                      }}
                    >
                      <span>✓</span>
                      <span>{ingredient}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Reset Link */}
      {imagePreview && !isScanning && (
        <div style={{
          textAlign: 'center',
          marginTop: '12px'
        }}>
          <button
            onClick={handleReset}
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '13px',
              color: 'var(--muted)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: '4px'
            }}
          >
            × Try another photo
          </button>
        </div>
      )}

      {/* Find Recipes CTA */}
      {showCTA && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginTop: '24px'
        }}>
          <button
            onClick={() => onIngredientsConfirmed(detectedIngredients)}
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
              opacity: 0,
              animation: 'chipIn 0.4s ease forwards'
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.88'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            Find Recipes →
          </button>
        </div>
      )}
    </section>
  )
}
