import React from 'react';
import { RandomizerResult } from '../types';
import { ExternalLink } from 'lucide-react';

interface ResultDisplayProps {
  result: RandomizerResult;
}

export const ResultDisplay: React.FC<ResultDisplayProps> = ({ result }) => {
  const { criteria, imdbUrl } = result;

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('ru-RU').format(num);
  };

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
