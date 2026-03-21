import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ModelLoader } from './components/ModelLoader';
import { Landing } from './pages/Landing';
import { IngredientScanner } from './components/IngredientScanner';
import { RecipeGrid } from './components/RecipeGrid';
import { SmartStepMode } from './components/SmartStepMode';
import { NavBar } from './components/NavBar';

interface Recipe {
  id: number
  name: string
  description: string
  time: number
  difficulty: string
  macros: { P: number; C: number; F: number }
  calories: number
  matchedIngredients: string[]
}

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
};

const pageTransition = { duration: 0.2, ease: 'easeInOut' }

export function App() {
  const [modelsReady, setModelsReady] = useState(false);
  const [loadingModel, setLoadingModel] = useState('SmolVLM · Vision Model');
  const [loadProgress, setLoadProgress] = useState(0);
  const [confirmedIngredients, setConfirmedIngredients] = useState<string[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const recipeRef = useRef<HTMLDivElement>(null);

  // Preload models simulation
  useEffect(() => {
    let progress = 0;
    const steps = [
      { name: 'SmolVLM · Vision Model', duration: 900 },
      { name: 'SmolLM2 · Recipe Engine', duration: 700 },
      { name: 'Whisper · Voice Recognition', duration: 600 },
      { name: 'Piper · Voice Synthesis', duration: 500 }
    ];
    let stepIndex = 0;
    let stepProgress = 0;

    const tick = setInterval(() => {
      stepProgress += 8;
      if (stepProgress >= 100) {
        stepProgress = 0;
        stepIndex++;
        if (stepIndex >= steps.length) {
          clearInterval(tick);
          setLoadingModel('All models ready');
          setLoadProgress(100);
          setTimeout(() => setModelsReady(true), 600);
          return;
        }
      }
      setLoadingModel(steps[stepIndex].name);
      setLoadProgress(stepProgress);
    }, 80);

    return () => clearInterval(tick);
  }, []);

  const handleStart = () => {
    const appStart = document.getElementById('app-start');
    if (appStart) {
      appStart.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleIngredientsConfirmed = (ingredients: string[]) => {
    setConfirmedIngredients(ingredients);
    setTimeout(() => {
      recipeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleRecipeSelect = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
  };

  return (
    <>
      <NavBar modelsReady={modelsReady} />
      <AnimatePresence mode="wait">
        {!modelsReady && (
          <motion.div
            key="loader"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
            style={{ position: 'fixed', inset: 0, zIndex: 100 }}
          >
            <ModelLoader modelName={loadingModel} progress={loadProgress} />
          </motion.div>
        )}

        {modelsReady && !selectedRecipe && (
          <motion.div
            key="main"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
            style={{ paddingTop: '44px' }}
          >
            <Landing modelsReady={modelsReady} onStart={handleStart} />
            <div id="app-start">
              <IngredientScanner onIngredientsConfirmed={handleIngredientsConfirmed} />
            </div>
            {confirmedIngredients.length > 0 && (
              <div ref={recipeRef} id="recipe-grid">
                <RecipeGrid
                  ingredients={confirmedIngredients}
                  onRecipeSelect={handleRecipeSelect}
                />
              </div>
            )}
          </motion.div>
        )}

        {modelsReady && selectedRecipe && (
          <motion.div
            key="smartstep"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
            style={{ position: 'fixed', inset: 0, zIndex: 200 }}
          >
            <SmartStepMode 
              recipe={selectedRecipe} 
              onExit={() => setSelectedRecipe(null)} 
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
