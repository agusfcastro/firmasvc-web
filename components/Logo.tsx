import React from 'react';

export const Logo: React.FC<{ className?: string }> = ({ className = "" }) => {
  // Replicating the visual style of the provided logo: "firma" in lowercase, heavy bold, blue
  return (
    <span className={`font-[900] tracking-tighter text-firma lowercase ${className}`}>
      firma
    </span>
  );
};