import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { Film, Sparkles, ExternalLink } from 'lucide-react';

// --- LOGIC ---
const generateRandomCriteria = () => {
  const minYear = 1975;
  const maxYear = 2025;
  const year = Math.floor(Math.random() * (maxYear - minYear + 1)) + minYear;
  const tier = Math.floor(Math.random() * 11) + 1;

  let minVotes = 0;
  let maxVotes = 0;

  if (tier === 1) {
    minVotes = 20000;
    maxVotes = 100000;
  } else if (tier === 11) {
    minVotes = 1000001;
    maxVotes = null;
  } else {
    minVotes = (tier - 1) * 100000 + 1;
    maxVotes = tier * 100000;
  }

  const dateStart = `${year}-01-01`;
  const dateEnd = `${year}-12-31`;
  const votesString = maxVotes ? `${minVotes},${maxVotes}` : `${minVotes},`;

  const baseUrl = 'https://www.imdb.com/search/title/';
  const params = new URLSearchParams({
    title_type: 'feature',
    release_date: `${dateStart},${dateEnd}`,
    num_votes: votesString,
    sort: 'user_rating,desc'
  });

  return {
    criteria: { year, tier, minVotes, maxVotes },
    imdbUrl: `${baseUrl}?${params.toString()}`
  };
};

// --- COMPONENTS ---

const VibeButton = ({ onClick, children, disabled }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        relative group px-8 py-4 bg-transparent overflow-hidden rounded-xl
        transition-all duration-300 ease-out
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95 cursor-pointer'}
      `}
    >
      <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-vibe-purple via-vibe-pink to-vibe-purple opacity-70 group-hover:opacity-100 transition-opacity duration-300"></div>
      <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-vibe-purple to-vibe-pink blur-xl opacity-40 group-hover:opacity-60 transition-opacity duration-300"></div>
      <div className="absolute inset-[2px] rounded-lg bg-black bg-opacity-90 flex items-center justify-center">
        <span className="relative z-10 font-mono text-xl md:text-2xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-300 group-hover:from-vibe-cyan group-hover:to-white transition-colors">
          {children}
        </span>
      </div>
    </button>
  );
};

const ResultDisplay = ({ result }) => {
  const { criteria, imdbUrl } = result;
  const formatNumber = (num) => new Intl.NumberFormat('ru-RU').format(num);

  return (
    <div className="w-full max-w-md mx-auto mt-8 animate-float">
      <div className="glass-panel rounded-2xl p-6 md:p-8 shadow-[0_0_50px_rgba(124,58,237,0.3)]">
        <div className="text-center mb-6">
          <h2 className="text-gray-400 text-sm font-mono uppercase tracking-widest mb-2">Выпавший Год</h2>
          <div className="text-5xl md:text-6xl font-bold text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
            {criteria.year}
          </div>
        </div>
        <div className="space-y-4 mb-8">
          <div className="flex justify-between items-center border-b border-gray-700 pb-2">
            <span className="text-gray-400 font-mono text-sm">Тир популярности</span>
            <span className="text-vibe-cyan font-bold font-mono">#{criteria.tier}</span>
          </div>
          <div className="flex justify-between items-center border-b border-gray-700 pb-2">
            <span className="text-gray-400 font-mono text-sm">Мин. голосов</span>
            <span className="text-white font-mono">{formatNumber(criteria.minVotes)}</span>
          </div>
          <div className="flex justify-between items-center pb-2">
            <span className="text-gray-400 font-mono text-sm">Макс. голосов</span>
            <span className="text-white font-mono">
              {criteria.maxVotes ? formatNumber(criteria.maxVotes) : '∞'}
            </span>
          </div>
        </div>
        <a 
          href={imdbUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="block w-full text-center bg-vibe-cyan hover:bg-cyan-400 text-black font-bold py-3 px-6 rounded-lg transition-all hover:shadow-[0_0_20px_rgba(6,182,212,0.6)] flex items-center justify-center gap-2"
        >
          <span>Искать на IMDB</span>
          <ExternalLink size={20} />
        </a>
      </div>
    </div>
  );
};

const App = () => {
  const [result, setResult] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const handleRandomize = () => {
    setIsAnimating(true);
    setResult(null);
    setTimeout(() => {
      const newResult = generateRandomCriteria();
      setResult(newResult);
      setIsAnimating(false);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col items-center justify-center p-4 relative overflow-hidden">
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

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);