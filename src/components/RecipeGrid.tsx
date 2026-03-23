import { useState, useEffect } from 'react'
import { GlassCard } from './GlassCard'

interface Recipe {
  id: number
  name: string
  description: string
  time: number
  difficulty: 'easy' | 'medium' | 'hard'
  macros: { P: number; C: number; F: number }
  calories: number
  matchedIngredients: string[]
}

interface RecipeGridProps {
  ingredients: string[]
  onRecipeSelect: (recipe: Recipe) => void
}

const DEMO_RECIPES: Recipe[] = [
  {
    id: 1,
    name: "Garlic Chicken Stir-fry",
    description: "Quick wok-tossed chicken with aromatics and bell pepper.",
    time: 25,
    difficulty: "easy",
    macros: { P: 38, C: 12, F: 14 },
    calories: 320,
    matchedIngredients: ["Garlic", "Chicken Breast", "Bell Pepper", "Olive Oil"]
  },
  {
    id: 2,
    name: "Tomato Cumin Soup",
    description: "Slow-simmered tomato base with warm cumin and lemon.",
    time: 35,
    difficulty: "easy",
    macros: { P: 8, C: 28, F: 6 },
    calories: 198,
    matchedIngredients: ["Tomatoes", "Cumin", "Onion", "Lemon"]
  },
  {
    id: 3,
    name: "Mediterranean Chicken Bowl",
    description: "Grilled chicken over roasted veg with lemon drizzle.",
    time: 40,
    difficulty: "medium",
    macros: { P: 42, C: 18, F: 16 },
    calories: 388,
    matchedIngredients: ["Chicken Breast", "Bell Pepper", "Olive Oil", "Lemon", "Onion"]
  },
  {
    id: 4,
    name: "Spiced Tomato Shakshuka",
    description: "Eggs poached in a cumin-spiced tomato and pepper sauce.",
    time: 30,
    difficulty: "medium",
    macros: { P: 18, C: 22, F: 12 },
    calories: 268,
    matchedIngredients: ["Tomatoes", "Bell Pepper", "Cumin", "Onion", "Garlic"]
  },
  {
    id: 5,
    name: "Lemon Garlic Roast",
    description: "Simple oven roast with olive oil, garlic and lemon.",
    time: 55,
    difficulty: "easy",
    macros: { P: 34, C: 6, F: 18 },
    calories: 318,
    matchedIngredients: ["Garlic", "Lemon", "Olive Oil", "Chicken Breast"]
  },
  {
    id: 6,
    name: "Chicken Ratatouille",
    description: "French-style stewed vegetables with pan-seared chicken.",
    time: 60,
    difficulty: "hard",
    macros: { P: 36, C: 24, F: 14 },
    calories: 364,
    matchedIngredients: ["Chicken Breast", "Tomatoes", "Bell Pepper", "Onion", "Olive Oil"]
  }
]

const getDifficultyStyles = (difficulty: string) => {
  switch (difficulty) {
    case 'easy':
      return {
        background: 'rgba(76,175,80,0.15)',
        color: '#4CAF50',
        border: '1px solid rgba(76,175,80,0.3)'
      }
    case 'medium':
      return {
        background: 'rgba(255,193,7,0.15)',
        color: '#FFC107',
        border: '1px solid rgba(255,193,7,0.3)'
      }
    case 'hard':
      return {
        background: 'rgba(232,123,79,0.15)',
        color: '#E87B4F',
        border: '1px solid rgba(232,123,79,0.3)'
      }
    default:
      return {}
  }
}

export const RecipeGrid = ({ ingredients, onRecipeSelect }: RecipeGridProps) => {
  const [visible, setVisible] = useState(false)
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setTimeout(() => setVisible(true), 300)

    const fetchRecipes = async () => {
      try {
        setIsLoading(true)
        const apiUrl = import.meta.env.VITE_LLM_API_URL || `${import.meta.env.VITE_PRIMARY_INFERENCE_ENDPOINT}`
        const apiKey = import.meta.env.VITE_LLM_API_KEY

        if (!apiKey) {
          console.warn("API Key not found, falling back to demo recipes.")
          setRecipes(DEMO_RECIPES)
          setIsLoading(false)
          return
        }

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: import.meta.env.VITE_CORE_REASONING_MODEL,
            messages: [
              {
                role: "system",
                content: `You are a world-class culinary AI. Output ONLY a valid JSON array of recipe objects. Do NOT use markdown code blocks (\`\`\`). The user will provide a list of ingredients. Invent 3 to 6 delicious recipes utilizing some or all of these ingredients.

Each object in the array MUST have this exact schema:
{
  "id": number (unique),
  "name": string,
  "description": string (short, engaging 1-sentence),
  "time": number (minutes to cook),
  "difficulty": "easy" | "medium" | "hard",
  "macros": { "P": number, "C": number, "F": number },
  "calories": number,
  "matchedIngredients": [string] (list of input ingredients used)
}`
              },
              {
                role: "user",
                content: `Here are my ingredients: ${ingredients.join(", ")}`
              }
            ],
            temperature: 0.6,
            max_completion_tokens: 1500
          })
        })

        if (!response.ok) throw new Error("Failed to fetch recipes")

        const data = await response.json()
        const content = data.choices[0]?.message?.content || ""

        // Extract array from response in case there is trailing/leading text
        const jsonStr = content.substring(content.indexOf('['), content.lastIndexOf(']') + 1)
        const parsedRecipes = JSON.parse(jsonStr) as Recipe[]

        setRecipes(parsedRecipes.length > 0 ? parsedRecipes : DEMO_RECIPES)
      } catch (err) {
        console.error("Error generating recipes:", err)
        setRecipes(DEMO_RECIPES)
      } finally {
        setIsLoading(false)
      }
    }

    if (ingredients.length > 0) {
      fetchRecipes()
    }
  }, [ingredients])

  return (
    <section style={{
      width: '100%',
      padding: '60px 24px',
      maxWidth: '1080px',
      margin: '0 auto',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.4s ease'
    }}>
      {/* Section Label */}
      <div style={{
        textAlign: 'center',
        marginBottom: '32px'
      }}>
        <div style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '12px',
          color: 'var(--muted)',
          textTransform: 'uppercase',
          letterSpacing: '1.5px',
          fontWeight: '600',
          marginBottom: '8px'
        }}>
          {isLoading ? 'Generating custom recipes...' : 'Recipes you can make right now'}
        </div>
        <div style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '13px',
          color: 'var(--muted)',
          height: '20px'
        }}>
          {isLoading ? (
            <span className="animate-pulse">Chef AI is experimenting...</span>
          ) : (
            `Based on ${ingredients.length} ingredients detected · ${recipes.length} matches found`
          )}
        </div>
      </div>

      {/* Recipe Grid */}
      <div className="recipe-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '20px',
        opacity: isLoading ? 0.4 : 1,
        pointerEvents: isLoading ? 'none' : 'auto',
        transition: 'opacity 0.3s ease'
      }}>
        {recipes.map((recipe, index) => (
          <GlassCard
            key={recipe.id}
            className="recipe-card"
            style={{
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              cursor: 'pointer',
              position: 'relative',
              transition: 'transform 0.2s ease, border-color 0.2s ease',
              opacity: 0,
              animation: 'cardIn 0.35s ease forwards',
              animationDelay: `${index * 80}ms`
            }}
            onClick={() => onRecipeSelect(recipe)}
          >
            {/* Top Row - Name & Difficulty */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '12px'
            }}>
              <h3 style={{
                fontFamily: "'Instrument Sans', sans-serif",
                fontSize: '18px',
                fontWeight: '600',
                color: 'var(--text)',
                margin: 0,
                lineHeight: '1.3'
              }}>
                {recipe.name}
              </h3>
              <div style={{
                borderRadius: '999px',
                padding: '3px 10px',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '12px',
                fontWeight: '500',
                textTransform: 'capitalize',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                ...getDifficultyStyles(recipe.difficulty)
              }}>
                {recipe.difficulty}
              </div>
            </div>

            {/* Description */}
            <p style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '14px',
              color: 'var(--muted)',
              lineHeight: '1.5',
              margin: 0,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical'
            }}>
              {recipe.description}
            </p>

            {/* Calories */}
            <div style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '13px',
              color: 'var(--accent)',
              fontWeight: '500'
            }}>
              {recipe.calories} kcal
            </div>

            {/* Macro Pills */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px'
            }}>
              <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '999px',
                padding: '4px 10px',
                fontFamily: "'DM Mono', monospace",
                fontSize: '12px'
              }}>
                <span style={{ color: 'var(--accent)' }}>P</span>
                <span style={{ color: 'var(--text)' }}> {recipe.macros.P}g</span>
              </div>
              <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '999px',
                padding: '4px 10px',
                fontFamily: "'DM Mono', monospace",
                fontSize: '12px'
              }}>
                <span style={{ color: 'var(--accent)' }}>C</span>
                <span style={{ color: 'var(--text)' }}> {recipe.macros.C}g</span>
              </div>
              <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '999px',
                padding: '4px 10px',
                fontFamily: "'DM Mono', monospace",
                fontSize: '12px'
              }}>
                <span style={{ color: 'var(--accent)' }}>F</span>
                <span style={{ color: 'var(--text)' }}> {recipe.macros.F}g</span>
              </div>
            </div>

            {/* Bottom Row - Time & Matched Count */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '13px',
                color: 'var(--muted)'
              }}>
                ⏱ {recipe.time} min
              </div>
              <div style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '12px',
                color: 'var(--muted)',
                opacity: 0.65
              }}>
                {recipe.matchedIngredients.length} of your ingredients
              </div>
            </div>

            {/* Cook This Link */}
            <div style={{
              marginTop: 'auto',
              color: 'var(--accent)',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '13px',
              fontWeight: '500',
              letterSpacing: '0.02em',
              transition: 'opacity 0.2s'
            }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              Cook this →
            </div>
          </GlassCard>
        ))}
      </div>
    </section>
  )
}
