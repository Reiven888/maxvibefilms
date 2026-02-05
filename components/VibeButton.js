import React from 'react';

export const VibeButton = ({ onClick, children, disabled }) => {
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
      {/* Background Gradient */}
      <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-vibe-purple via-vibe-pink to-vibe-purple opacity-70 group-hover:opacity-100 transition-opacity duration-300"></div>
      
      {/* Glow Effect */}
      <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-vibe-purple to-vibe-pink blur-xl opacity-40 group-hover:opacity-60 transition-opacity duration-300"></div>
      
      {/* Border Gradient (simulated with inset) */}
      <div className="absolute inset-[2px] rounded-lg bg-black bg-opacity-90 flex items-center justify-center">
        <span className="relative z-10 font-mono text-xl md:text-2xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-300 group-hover:from-vibe-cyan group-hover:to-white transition-colors">
          {children}
        </span>
      </div>
    </button>
  );
};