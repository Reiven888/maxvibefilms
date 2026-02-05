import React, { useState, useEffect, useRef } from 'react';
import { MIN_YEAR, MAX_YEAR, getRandomInt, getVoteRangeByTier, buildImdbUrl } from './utils';
import { FilmCriteria } from './types';
import { VibeButton } from './components/VibeButton';

const App: React.FC = () => {
  const [criteria, setCriteria] = useState<FilmCriteria | null>(null);
  const [isRolling, setIsRolling] = useState<boolean>(false);
  
  // Animation state
  const [displayYear, setDisplayYear] = useState<number>(2025);
  const [displayTier, setDisplayTier] = useState<number>(1);
  const [displayRange, setDisplayRange] = useState<string>("?????");

  const rollSoundRef = useRef<HTMLAudioElement | null>(null);

  const handleRoll = () => {
    if (isRolling) return;
    setIsRolling(true);
    setCriteria(null);

    // Determines the final result
    const finalYear = getRandomInt(MIN_YEAR, MAX_YEAR);
    const finalTier = getRandomInt(1, 11);
    const finalVoteRange = getVoteRangeByTier(finalTier);
    const finalUrl = buildImdbUrl(finalYear, finalVoteRange);

    let steps = 0;
    const maxSteps = 20; // How many numbers to cycle through
    const intervalTime = 50; // Speed of cycle

    const interval = setInterval(() => {
      steps++;
      
      // Random values for animation effect
      const tempTier = getRandomInt(1, 11);
      setDisplayYear(getRandomInt(MIN_YEAR, MAX_YEAR));
      setDisplayTier(tempTier);
      setDisplayRange(getVoteRangeByTier(tempTier).label);

      if (steps >= maxSteps) {
        clearInterval(interval);
        
        // Set final values
        setDisplayYear(finalYear);
        setDisplayTier(finalTier);
        setDisplayRange(finalVoteRange.label);
        
        setCriteria({
          year: finalYear,
          voteTier: finalTier,
          voteRange: finalVoteRange,
          url: finalUrl
        });
        setIsRolling(false);
      }
    }, intervalTime);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none opacity-20">
        <div className="absolute top-10 left-10 w-64 h-64 bg-vibe-purple rounded-full blur-[100px]"></div>
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-vibe-accent rounded-full blur-[100px]"></div>
      </div>

      <div className="max-w-md w-full bg-vibe-light/30 backdrop-blur-md rounded-3xl border border-white/10 p-8 shadow-2xl flex flex-col items-center gap-8">
        
        <header className="text-center">
          <h1 className="text-4xl md:text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-vibe-accent to-vibe-neon drop-shadow-sm tracking-tighter">
            MaxVibeFilms
          </h1>
          <p className="text-gray-300 mt-2 text-sm font-light">
            Найди свой фильм на вечер по хаотичным правилам
          </p>
        </header>

        {/* Display Area */}
        <div className="w-full grid grid-cols-2 gap-4">
          {/* Year Card */}
          <div className="bg-black/40 rounded-2xl p-4 flex flex-col items-center justify-center border border-white/5 relative group">
            <span className="text-xs text-vibe-purple uppercase tracking-widest font-bold mb-1">Год</span>
            <span className={`text-4xl font-mono font-bold ${isRolling ? 'text-gray-400 blur-[1px]' : 'text-white'}`}>
              {displayYear}
            </span>
            <div className="absolute inset-0 bg-gradient-to-t from-vibe-purple/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"></div>
          </div>

          {/* Tier Card */}
          <div className="bg-black/40 rounded-2xl p-4 flex flex-col items-center justify-center border border-white/5 relative group">
            <span className="text-xs text-vibe-accent uppercase tracking-widest font-bold mb-1">Тир (1-11)</span>
            <span className={`text-4xl font-mono font-bold ${isRolling ? 'text-gray-400 blur-[1px]' : 'text-vibe-accent'}`}>
              {displayTier}
            </span>
            <div className="absolute inset-0 bg-gradient-to-t from-vibe-accent/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"></div>
          </div>
        </div>

        {/* Vote Range Detail */}
        <div className="w-full bg-black/20 rounded-xl p-3 text-center border border-white/5">
          <span className="text-xs text-gray-400 block mb-1">Количество голосов</span>
          <span className="text-lg md:text-xl font-medium text-vibe-neon tracking-wide">
             {displayRange}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-4">
          <VibeButton 
            onClick={handleRoll} 
            disabled={isRolling}
            className="w-full"
          >
            {isRolling ? 'ВЫБИРАЮ...' : 'РАНДОМ'}
          </VibeButton>

          {criteria && !isRolling && (
            <a 
              href={criteria.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full block"
            >
              <VibeButton variant="secondary" onClick={() => {}} className="w-full flex items-center justify-center gap-2">
                <span>ОТКРЫТЬ НА IMDB</span>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </VibeButton>
            </a>
          )}
        </div>
        
        {/* Helper Rules Text */}
        <div className="text-xs text-gray-500 text-center max-w-xs leading-relaxed">
          <p>Тир 1: 20к-100к голосов. Тир 2-10: шаг 100к. Тир 11: 1М+ голосов.</p>
        </div>

      </div>
    </div>
  );
};

export default App;