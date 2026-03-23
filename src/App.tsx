import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ModelLoader } from './components/ModelLoader';
import { Landing } from './pages/Landing';
import { IngredientScanner } from './components/IngredientScanner';
import { RecipeGrid } from './components/RecipeGrid';
import { SmartStepMode } from './components/SmartStepMode';
import { NavBar } from './components/NavBar';
import { initSDK } from './runanywhere';

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

const pageTransition = { duration: 0.2, ease: 'easeInOut' as const }

export function App() {
  const [modelsReady, setModelsReady] = useState(false);
  const [loadingModel, setLoadingModel] = useState('Initializing AI backends...');
  const [loadProgress, setLoadProgress] = useState(0);
  const [confirmedIngredients, setConfirmedIngredients] = useState<string[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const recipeRef = useRef<HTMLDivElement>(null);

  // Initialize the RunAnywhere SDK — registers LlamaCPP + ONNX backends
  useEffect(() => {
    let cancelled = false;

    // Animate progress while SDK initializes
    let fakeProgress = 0;
    const tick = setInterval(() => {
      fakeProgress = Math.min(fakeProgress + 3, 88);
      if (!cancelled) setLoadProgress(fakeProgress);
    }, 80);

    const phases = [
      'Initializing AI backends...',
      'Registering LlamaCPP engine...',
      'Registering ONNX runtime...',
      'Loading model catalog...',
    ];
    let phaseIdx = 0;
    const phaseTimer = setInterval(() => {
      phaseIdx = Math.min(phaseIdx + 1, phases.length - 1);
      if (!cancelled) setLoadingModel(phases[phaseIdx]);
    }, 700);

    initSDK()
      .then(() => {
        if (cancelled) return;
        clearInterval(tick);
        clearInterval(phaseTimer);
        setLoadingModel('All systems ready ✓');
        setLoadProgress(100);
        setTimeout(() => { if (!cancelled) setModelsReady(true); }, 500);
      })
      .catch((err) => {
        console.warn('SDK init error (non-fatal):', err);
        if (cancelled) return;
        clearInterval(tick);
        clearInterval(phaseTimer);
        setLoadingModel('Ready');
        setLoadProgress(100);
        setTimeout(() => { if (!cancelled) setModelsReady(true); }, 500);
      });

    return () => {
      cancelled = true;
      clearInterval(tick);
      clearInterval(phaseTimer);
    };
  }, []);

  const handleStart = () => {
    const appStart = document.getElementById('app-start');
    if (appStart) appStart.scrollIntoView({ behavior: 'smooth' });
  };

  const handleIngredientsConfirmed = (ingredients: string[]) => {
    setConfirmedIngredients(ingredients);
    setTimeout(() => {
      recipeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleRecipeSelect = (recipe: Recipe) => setSelectedRecipe(recipe);

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
