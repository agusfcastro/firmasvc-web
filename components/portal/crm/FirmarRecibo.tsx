import React, { useEffect, useState } from 'react';
import { PenLine, ShieldCheck, Type, X } from 'lucide-react';
import { Button } from '../../Button';
import { Aviso, Campo, claseInput } from '../ui';
import { llamarSobres } from '../firmas/api';
import { Lienzo, nombreComoImagen } from '../../firma/Lienzo';
import { descargar, generarPdfConLugar, nombreArchivo, type Logo } from '../../comprobantes/pdf';
import type { DatosComprobante } from '../../comprobantes/modelo';

/** El mismo texto que registra el servidor (api/firma/firmar.ts, CONSENTIMIENTO). */
const CONSENTIMIENTO =
  'Leí el documento completo, estoy de acuerdo con su contenido y acepto firmarlo de forma electrónica. Reconozco esta firma como propia y con el mismo valor que mi firma manuscrita.';

export interface Firma {
  imagen: string;
  tipo: 'dibujada' | 'escrita';
}

/**
 * Arma el PDF del recibo, lo firma en el servidor con la sesión del titular
 * y descarga el firmado. La firma va sobre la línea «Firma y aclaración».
 * Devuelve el error, o null si salió bien.
 */
export async function firmarYDescargar(comprobanteId: string, datos: DatosComprobante, numero: string, logo: Logo | null, firma: Firma): Promise<string | null> {
  const { bytes, lugar } = await generarPdfConLugar(datos, { numero, logo });
  if (!lugar) return 'Este comprobante no tiene lugar para la firma.';
  let binario = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const r = await llamarSobres<{ pdf: string; codigo: string }>(
    { accion: 'firmar_recibo', comprobante_id: comprobanteId, pdf: btoa(binario), lugar, imagen: firma.imagen, tipo: firma.tipo, acepto: true },
    '/api/firma/firmar',
  );
  if (!r.ok) return r.error;
  const firmado = Uint8Array.from(atob(r.datos.pdf), (ch) => ch.charCodeAt(0));
  descargar(firmado, nombreArchivo(datos, numero).replace(/\.pdf$/, ' (firmado).pdf'));
  return null;
}

/** Cuadro para firmar: dibujar o escribir el nombre, y aceptar. */
export const CuadroFirma: React.FC<{ abierto: boolean; nombre: string; ocupado: boolean; error: string | null; alCerrar: () => void; alFirmar: (f: Firma) => void }> = ({
  abierto,
  nombre,
  ocupado,
  error,
  alCerrar,
  alFirmar,
}) => {
  const [modo, setModo] = useState<'dibujada' | 'escrita'>('dibujada');
  const [dibujo, setDibujo] = useState<string | null>(null);
  const [escrito, setEscrito] = useState(nombre);
  const [acepto, setAcepto] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && !ocupado && alCerrar();
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [abierto, ocupado, alCerrar]);

  if (!abierto) return null;
  const imagen = modo === 'dibujada' ? dibujo : nombreComoImagen(escrito);

  return (
    <div className="fixed inset-0 z-50 bg-tinta/50 flex items-end tab:items-center justify-center p-0 tab:p-6" onClick={() => !ocupado && alCerrar()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-firma"
        className="w-full tab:max-w-[560px] max-h-[92vh] overflow-y-auto bg-marfil rounded-t-[16px] tab:rounded-control p-5 tab:p-7 flex flex-col gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="titulo-firma" className="text-[20px] font-semibold">
              Firmar el recibo
            </h2>
            <p className="text-[13.5px] text-piedra leading-[1.45]">La firma va sobre la línea «Firma y aclaración». El PDF sale con el código para verificarlo y la constancia de firma electrónica.</p>
          </div>
          <button type="button" onClick={alCerrar} disabled={ocupado} aria-label="Cerrar" className="w-9 h-9 -mr-2 -mt-1 grid place-items-center rounded-control hover:bg-marfil-oscuro shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="flex border border-tinta self-start" role="tablist">
          {(
            [
              ['dibujada', 'Dibujar', PenLine],
              ['escrita', 'Escribir', Type],
            ] as const
          ).map(([clave, rotulo, Icono]) => (
            <button
              key={clave}
              type="button"
              role="tab"
              aria-selected={modo === clave}
              onClick={() => setModo(clave)}
              className={`inline-flex items-center gap-2 h-10 px-4 text-sm font-medium ${modo === clave ? 'bg-tinta text-marfil' : 'hover:bg-marfil-oscuro'}`}
            >
              <Icono size={15} aria-hidden="true" /> {rotulo}
            </button>
          ))}
        </div>

        {modo === 'dibujada' ? (
          <Lienzo alCambiar={setDibujo} />
        ) : (
          <div className="flex flex-col gap-3">
            <Campo etiqueta="Tu nombre completo">
              <input value={escrito} onChange={(e) => setEscrito(e.target.value.slice(0, 80))} className={claseInput} autoComplete="name" />
            </Campo>
            <div className="bg-white border border-tinta/22 h-24 flex items-center px-6 overflow-hidden">
              <span className="text-[40px] leading-none truncate" style={{ fontFamily: '"Snell Roundhand", "Segoe Script", "Brush Script MT", "Apple Chancery", Georgia, serif', fontStyle: 'italic' }}>
                {escrito || ' '}
              </span>
            </div>
          </div>
        )}

        <label className="flex items-start gap-3 text-[13.5px] leading-[1.5] cursor-pointer">
          <input type="checkbox" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} className="mt-1 w-4 h-4 accent-bosque shrink-0" />
          {CONSENTIMIENTO}
        </label>

        {error && <Aviso tipo="error">{error}</Aviso>}

        <Button type="button" fullWidth disabled={ocupado || !acepto || !imagen} onClick={() => imagen && alFirmar({ imagen, tipo: modo })}>
          <ShieldCheck size={17} /> {ocupado ? 'Firmando' : 'Firmar y descargar'}
        </Button>
      </div>
    </div>
  );
};
