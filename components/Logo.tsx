import React from 'react';

import lockupClaro from '../assets/brand/lockup-claro.png';
import lockupOscuro from '../assets/brand/lockup-oscuro.png';

interface LogoProps {
  /** claro = lockup tinta para fondos marfil · oscuro = lockup marfil para fondos carbón */
  variant?: 'claro' | 'oscuro';
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ variant = 'claro', className = '' }) => (
  <img
    src={variant === 'claro' ? lockupClaro : lockupOscuro}
    alt="firma — Castro & Company / Legal Consulting"
    className={`w-auto block object-contain ${className}`}
  />
);
