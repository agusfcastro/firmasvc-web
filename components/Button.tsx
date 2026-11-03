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

/**
 * Densidad de los botones. La landing usa la normal. El portal envuelve sus pantallas en
 * <DensidadBotones.Provider value="compacta">: botones de 36 a 48 px y secundarios sobre papel.
 */
export const DensidadBotones = React.createContext<'normal' | 'compacta'>('normal');

const sizesCompactos: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-[13.5px]',
  md: 'h-11 px-5 text-[14.5px]',
  lg: 'h-12 px-6 text-[15px]',
};

const variantsCompactos: Partial<Record<Variant, string>> = {
  ghost: 'border border-borde-suave bg-papel text-tinta hover:border-tinta',
};

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  ...props
}) => {
  const densidad = React.useContext(DensidadBotones);
  const variante = (densidad === 'compacta' && variantsCompactos[variant]) || variants[variant];
  const tamano = densidad === 'compacta' ? sizesCompactos[size] : sizes[size];
  // Radio 0 y sin sombras: la marca no usa esquinas redondeadas ni profundidad decorativa.
  const baseStyles =
    'inline-flex items-center justify-center gap-2.5 rounded-control font-medium whitespace-nowrap transition-[background-color,color,border-color] duration-150 disabled:opacity-60 disabled:cursor-not-allowed';

  return (
    <button
      className={`${baseStyles} ${variante} ${tamano} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
