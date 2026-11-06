import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { CaraTina } from './CaraTina';

/**
 * Botón flotante de Tina, abajo a la derecha. En el celular queda arriba de la
 * barra inferior. El panel se carga recién la primera vez que se abre, así no
 * pesa en el resto del portal.
 * Lo monta Marco solo para usuarios de clientes (no para FIRMA ni en la vista previa).
 */
const ChatTina = lazy(() => import('./ChatTina'));

export const BurbujaTina: React.FC<{ nombre: string | null }> = ({ nombre }) => {
  const [abierto, setAbierto] = useState(false);
  const [cargado, setCargado] = useState(false);
  const boton = useRef<HTMLButtonElement>(null);

  // Al cerrar, el foco vuelve al botón.
  const cerrar = () => {
    setAbierto(false);
    requestAnimationFrame(() => boton.current?.focus());
  };

  useEffect(() => {
    if (abierto) setCargado(true);
  }, [abierto]);

  return (
    <>
      <button
        ref={boton}
        type="button"
        onClick={() => setAbierto(true)}
        aria-label="Abrir el chat con Tina"
        aria-haspopup="dialog"
        aria-expanded={abierto}
        className={`${abierto ? 'hidden' : 'flex'} fixed z-40 right-4 bottom-[calc(76px+env(safe-area-inset-bottom))] desk:right-6 desk:bottom-6 items-center gap-2.5 h-14 pl-2.5 pr-5 rounded-pastilla bg-tinta text-marfil shadow-flotante hover:bg-grafito focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta`}
      >
        <CaraTina tamano={38} />
        <span className="text-[15px] font-semibold">Tina</span>
      </button>
      {cargado && (
        <Suspense fallback={null}>
          <ChatTina abierto={abierto} alCerrar={cerrar} nombre={nombre} />
        </Suspense>
      )}
    </>
  );
};
