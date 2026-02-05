import React, { useState } from 'react';
import { Film, Sparkles } from 'lucide-react';
import { VibeButton } from './components/VibeButton.js';
import { ResultDisplay } from './components/ResultDisplay.js';
import { generateRandomCriteria } from './utils/randomizerLogic.js';

const App = () => {
  const [result, setResult] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const handleRandomize = () => {
    setIsAnimating(true);
    setResult(null);

    // Simulate a calculation "vibe" delay
    setTimeout(() => {
      const newResult = generateRandomCriteria();
      setResult(newResult);
      setIsAnimating(false);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-vibe-purple rounded-full blur-[120px] opacity-20"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-vibe-cyan rounded-full blur-[120px] opacity-20"></div>
      </div>

      <main className="z-10 w-full max-w-2xl flex flex-col items-center">
        
        <header className="mb-12 text-center">
          <div className="inline-flex items-center justify-center p-3 mb-4 rounded-full glass-panel">
            <Film className="text-vibe-cyan mr-2" size={24} />
            <span className="text-vibe-pink font-bold tracking-wider uppercase text-xs">Movie Randomizer</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400 font-mono tracking-tighter drop-shadow-lg">
            MaxVibe<span className="text-vibe-purple">Films</span>
          </h1>
          <p className="mt-4 text-gray-300 text-lg max-w-md mx-auto">
            Найди свой вайб. Случайный год, случайная популярность.
          </p>
        </header>

        <div className="mb-8">
          <VibeButton onClick={handleRandomize} disabled={isAnimating}>
            {isAnimating ? (
              <span className="flex items-center gap-2">
                <Sparkles className="animate-spin" /> ВАЙБИМ...
              </span>
            ) : (
              'ПОЙМАТЬ ВАЙБ'
            )}
          </VibeButton>
        </div>

        {result && !isAnimating && (
          <ResultDisplay result={result} />
        )}

      </main>

      <footer className="absolute bottom-4 text-center text-gray-600 text-xs font-mono">
        &copy; {new Date().getFullYear()} MaxVibeFilms. Github Pages Edition.
      </footer>
    </div>
  );
};

export default App;