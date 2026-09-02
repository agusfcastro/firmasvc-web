import React from 'react';

type Variant = 'primary' | 'ghost' | 'dark' | 'light';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary = verde bosque (único acento) · ghost = borde tinta sobre claro · light = marfil sobre carbón */
  variant?: Variant;
  /** sm 40px (header) · md 52px (base) · lg 56px (hero) */
  size?: Size;
  fullWidth?: boolean;
}

const variants: Record<Variant, string> = {
  primary: 'bg-bosque text-marfil hover:bg-bosque-dark',
  ghost: 'border border-tinta text-tinta bg-transparent hover:bg-tinta hover:text-marfil',
  dark: 'bg-tinta text-marfil hover:bg-carbon',
  light: 'bg-marfil text-tinta hover:bg-white',
};

const sizes: Record<Size, string> = {
  sm: 'h-10 px-[18px] text-sm',
  md: 'h-[52px] px-6 text-[15px]',
  lg: 'h-14 px-8 text-base',
};

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  ...props
}) => {
  // Radio 0 y sin sombras: la marca no usa esquinas redondeadas ni profundidad decorativa.
  const baseStyles =
    'inline-flex items-center justify-center gap-2.5 rounded-none font-medium whitespace-nowrap transition-[background-color,color] duration-150';

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
