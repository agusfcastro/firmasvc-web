import React, { useEffect, useRef, useState } from 'react';
import { CirclePlay, X } from 'lucide-react';

/**
 * Tutoriales en video de cada sección, grabados sobre la empresa demo.
 * Los archivos viven en public/tutoriales: <clave>.mp4 y <clave>.jpg (portada).
 * Una sección muestra el botón solo si su clave está en TUTORIALES.
 * Para regrabar y sumar la voz: scripts/tutoriales (grabar.mjs, mezclar.py y narracion.md).
 */
export type ClaveTutorial =
  | 'inicio'
  | 'crm'
  | 'crm-alta'
  | 'crm-ficha'
  | 'casos'
  | 'documentos'
  | 'protocolos'
  | 'firmas'
  | 'asuntos'
  | 'agenda'
  | 'pagos';

interface Tutorial {
  titulo: string;
  /** Duración aproximada para el botón, por ejemplo 1:20 */
  duracion?: string;
  /** Sube con cada regrabación para que el navegador no muestre la versión en caché. */
  version: number;
}

// Se completa al grabar. Clave ausente = sin botón.
export const TUTORIALES: Partial<Record<ClaveTutorial, Tutorial>> = {
  inicio: { titulo: 'Recorrido por el portal', duracion: '0:30', version: 1 },
  crm: { titulo: 'CRM legal, la lista de clientes', duracion: '0:32', version: 1 },
  'crm-alta': { titulo: 'Cómo dar de alta un cliente', duracion: '1:01', version: 1 },
  'crm-ficha': { titulo: 'La ficha del cliente', duracion: '0:39', version: 1 },
  casos: { titulo: 'Casos de conflicto', duracion: '0:30', version: 1 },
  documentos: { titulo: 'Documentos de tu empresa', duracion: '0:20', version: 1 },
  protocolos: { titulo: 'Protocolos de tu equipo', duracion: '0:16', version: 1 },
  firmas: { titulo: 'Cómo mandar un documento a firmar', duracion: '0:47', version: 1 },
  asuntos: { titulo: 'Estado de asuntos y chat con FIRMA', duracion: '0:36', version: 1 },
  agenda: { titulo: 'Cómo agendar una reunión', duracion: '0:11', version: 1 },
  pagos: { titulo: 'Tu abono y los planes', duracion: '0:15', version: 1 },
};

const ruta = (clave: ClaveTutorial, ext: 'mp4' | 'jpg', version: number) => `/tutoriales/${clave}.${ext}?v=${version}`;

export const BotonTutorial: React.FC<{ clave: ClaveTutorial }> = ({ clave }) => {
  const [abierto, setAbierto] = useState(false);
  const tutorial = TUTORIALES[clave];
  if (!tutorial) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-2 h-11 px-4 rounded-control text-[14px] font-medium border border-borde-suave bg-papel text-tinta transition-colors duration-150 hover:border-tinta"
      >
        <CirclePlay size={16} aria-hidden="true" />
        Ver tutorial{tutorial.duracion ? ` · ${tutorial.duracion}` : ''}
      </button>
      {abierto && <VisorTutorial clave={clave} tutorial={tutorial} alCerrar={() => setAbierto(false)} />}
    </>
  );
};

const VisorTutorial: React.FC<{ clave: ClaveTutorial; tutorial: Tutorial; alCerrar: () => void }> = ({ clave, tutorial, alCerrar }) => {
  const cerrarRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cerrarRef.current?.focus();
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && alCerrar();
    const desborde = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', alTeclear);
    return () => {
      window.removeEventListener('keydown', alTeclear);
      document.body.style.overflow = desborde;
    };
  }, [alCerrar]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(27,31,27,0.72)] p-3 tab:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={`Tutorial: ${tutorial.titulo}`}
      onMouseDown={(e) => e.target === e.currentTarget && alCerrar()}
    >
      <div className="w-full max-w-[1100px] bg-marfil">
        <div className="flex items-center justify-between gap-4 px-5 py-3" style={{ borderBottom: '1px solid rgba(27,31,27,0.12)' }}>
          <div className="flex flex-col">
            <span className="eyebrow text-piedra">Tutorial</span>
            <span className="font-medium">{tutorial.titulo}</span>
          </div>
          <button ref={cerrarRef} type="button" onClick={alCerrar} aria-label="Cerrar el tutorial" className="h-10 w-10 inline-flex items-center justify-center hover:bg-tinta hover:text-marfil transition-colors duration-150">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <video
          className="block w-full h-auto bg-carbon"
          src={ruta(clave, 'mp4', tutorial.version)}
          poster={ruta(clave, 'jpg', tutorial.version)}
          controls
          autoPlay
          playsInline
          preload="metadata"
        />
      </div>
    </div>
  );
};
