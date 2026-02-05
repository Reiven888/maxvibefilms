import React from 'react';

interface VibeButtonProps {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
  variant?: 'primary' | 'secondary';
}

export const VibeButton: React.FC<VibeButtonProps> = ({ 
  onClick, 
  disabled, 
  children, 
  className = '',
  variant = 'primary'
}) => {
  const baseStyles = "px-8 py-4 rounded-xl font-bold text-xl transition-all duration-300 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg";
  
  const variants = {
    primary: "bg-gradient-to-r from-vibe-purple to-vibe-accent text-white hover:shadow-[0_0_20px_rgba(247,183,51,0.6)]",
    secondary: "bg-transparent border-2 border-vibe-neon text-vibe-neon hover:bg-vibe-neon hover:text-black shadow-[0_0_10px_rgba(0,242,96,0.3)]"
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};