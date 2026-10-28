import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, FileUp, ShieldCheck, X } from 'lucide-react';
import { Button } from '../Button';
import { Aviso, Campo, Etiqueta, claseInput } from '../portal/ui';
import { ESTADO_FIRMANTE, ESTADO_SOBRE, MarcoPublico, fechaHora, llamarFirma, usePaginaPrivada } from './comun';

/**
 * Verificación pública de documentos firmados. /verificar y /verificar/<código>
 * Con el código se ve el estado del envío. Subiendo el PDF se calcula su
 * SHA-256 en el navegador (el archivo no sale de la computadora) y se compara
 * con el que quedó registrado.
 */

interface Resultado {
  encontrado: boolean;
  coincide?: 'final' | 'original' | 'ninguno' | null;
  cadena_integra?: boolean;
  sobre?: {
    codigo: string;
    titulo: string;
    emisor: string;
    estado: string;
    creado_en: string;
    completado_en: string | null;
    cerrado_en: string | null;
    original_sha256: string;
    final_sha256: string | null;
    paginas: number;
  };
  /** Sello de tiempo en la Blockchain Federal Argentina. Sin bloque, todavía está entrando. */
  bfa?: { bloque: number | null; registrado_en: string | null; recibo: string } | null;
  firmantes?: { nombre: string; email: string; estado: string; firmado_en: string | null; rechazado_en: string | null }[];
}

async function hashDe(archivo: File): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', await archivo.arrayBuffer());
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export const Verificar: React.FC<{ codigoInicial?: string }> = ({ codigoInicial = '' }) => {
  usePaginaPrivada('Verificar documento firmado · FIRMA');
  const [codigo, setCodigo] = useState(codigoInicial.toUpperCase());
  const [archivo, setArchivo] = useState<File | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);

  const consultar = useCallback(async (c: string, a: File | null) => {
    setOcupado(true);
    setError(null);
    setResultado(null);
    const sha256 = a ? await hashDe(a) : undefined;
    // Con archivo se busca por el hash. El código, si está, solo se usa sin archivo.
    const r = await llamarFirma<Resultado>({ accion: 'verificar', ...(sha256 ? { sha256 } : { codigo: c }) });
    setOcupado(false);
    if (!r.ok) return setError(r.error);
    setResultado(r.datos);
  }, []);

  useEffect(() => {
    if (codigoInicial) void consultar(codigoInicial, null);
  }, [codigoInicial, consultar]);

  function elegir(a: File | undefined | null) {
    if (!a) return;
    if (!/\.pdf$/i.test(a.name) && a.type !== 'application/pdf') return setError('Subí el PDF firmado.');
    setArchivo(a);
    void consultar(codigo, a);
  }

  const s = resultado?.sobre;
  const estado = s ? (ESTADO_SOBRE[s.estado] ?? ESTADO_SOBRE.en_curso) : null;

  return (
    <MarcoPublico eyebrow="Verificación de documentos">
      <section style={{ borderBottom: '1px solid rgba(27,31,27,0.12)' }}>
        <div className="wrap pt-10 pb-9 desk:pt-14 desk:pb-11 flex flex-col gap-4 max-w-[860px] ml-0">
          <p className="eyebrow text-piedra">Verificación</p>
          <h1 className="h2">
            ¿Este documento es <span className="text-bosque">el que se firmó</span>?
          </h1>
          <p className="text-piedra text-[17px] leading-[1.55] max-w-[56ch]">
            Subí el PDF y lo comparamos con el registro. El archivo no se sube a ningún lado, la cuenta se hace en tu navegador. También podés buscar con el código del pie de cada hoja.
          </p>
        </div>
      </section>

      <div className="wrap py-10 desk:py-14 grid gap-10 desk:grid-cols-[minmax(320px,1fr)_minmax(0,1.4fr)] desk:items-start">
        <div className="flex flex-col gap-6">
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setArrastrando(true);
            }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={(e) => {
              e.preventDefault();
              setArrastrando(false);
              elegir(e.dataTransfer.files?.[0]);
            }}
            className={`flex flex-col items-center justify-center gap-3 p-10 text-center border-2 border-dashed cursor-pointer transition-colors duration-150 ${arrastrando ? 'border-bosque bg-[#E4E9E3]' : 'border-[rgba(27,31,27,0.25)] bg-white hover:border-tinta'}`}
          >
            <FileUp size={28} aria-hidden="true" className="text-bosque" />
            <span className="font-medium">{archivo ? archivo.name : 'Arrastrá el PDF o tocá para elegirlo'}</span>
            <span className="text-xs text-piedra">Se compara su huella SHA-256</span>
            <input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => elegir(e.target.files?.[0])} />
          </label>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setArchivo(null);
              void consultar(codigo, null);
            }}
            className="flex flex-col gap-3"
          >
            <Campo etiqueta="O buscá por código">
              <input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase().replace(/[^0-9A-F]/g, '').slice(0, 12))}
                placeholder="12 caracteres"
                className={`${claseInput} tracking-[0.2em] uppercase`}
                spellCheck={false}
              />
            </Campo>
            <Button type="submit" variant="ghost" disabled={ocupado || codigo.length !== 12}>
              Buscar
            </Button>
          </form>
        </div>

        <section aria-live="polite" className="flex flex-col gap-6 min-w-0">
          {ocupado && <p className="eyebrow text-piedra animate-pulse">Verificando</p>}
          {error && <Aviso tipo="error">{error}</Aviso>}

          {resultado && !resultado.encontrado && (
            <div className="bg-[#f6e7e4] p-7 flex flex-col gap-3 text-[#5c1d15]">
              <span className="inline-flex items-center gap-2 font-semibold">
                <X size={18} aria-hidden="true" /> No hay registro
              </span>
              <p className="text-[15px] leading-[1.6]">
                {archivo
                  ? 'Este PDF no coincide con ningún documento firmado con FIRMA. Si lo modificaron, aunque sea una coma, o lo volvieron a guardar, la huella cambia.'
                  : 'No hay ningún envío con ese código.'}
              </p>
            </div>
          )}

          {s && estado && (
            <>
              {resultado?.coincide === 'final' && (
                <div className="bg-[#E4E9E3] p-6 flex items-start gap-3 text-bosque">
                  <ShieldCheck size={22} aria-hidden="true" className="shrink-0 mt-0.5" />
                  <p className="text-[15px] leading-[1.6]">
                    <strong>Es el documento firmado original.</strong> Coincide byte por byte con el PDF que generamos cuando firmaron todos.
                  </p>
                </div>
              )}
              {resultado?.coincide === 'original' && (
                <div className="bg-marfil-oscuro p-6 flex items-start gap-3">
                  <AlertTriangle size={22} aria-hidden="true" className="shrink-0 mt-0.5" />
                  <p className="text-[15px] leading-[1.6]">
                    <strong>Es el documento sin firmar.</strong> Coincide con el PDF que se envió a firmar, pero no con la versión firmada. Pedí la versión con la constancia de firma.
                  </p>
                </div>
              )}
              {resultado?.cadena_integra === false && <Aviso tipo="error">El registro de eventos de este envío no cierra. Avisanos a agustin@firmasvc.com.</Aviso>}

              <div className="bg-white border border-[rgba(27,31,27,0.14)] p-6 desk:p-8 flex flex-col gap-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <span className="eyebrow text-[11px] text-piedra">Código {s.codigo}</span>
                    <h2 className="h3 break-words">{s.titulo}</h2>
                    <span className="text-sm text-piedra">Enviado por {s.emisor}</span>
                  </div>
                  <Etiqueta tono={estado.tono}>{estado.texto}</Etiqueta>
                </div>

                <dl className="grid grid-cols-1 tab:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.14em] text-piedra">Creado</dt>
                    <dd>{fechaHora(s.creado_en)}</dd>
                  </div>
                  {s.completado_en && (
                    <div>
                      <dt className="text-[11px] uppercase tracking-[0.14em] text-piedra">Firmado por todos</dt>
                      <dd>{fechaHora(s.completado_en)}</dd>
                    </div>
                  )}
                  {!s.completado_en && s.cerrado_en && (
                    <div>
                      <dt className="text-[11px] uppercase tracking-[0.14em] text-piedra">Cerrado</dt>
                      <dd>{fechaHora(s.cerrado_en)}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.14em] text-piedra">Registro de eventos</dt>
                    <dd className="inline-flex items-center gap-1.5">
                      {resultado?.cadena_integra ? (
                        <>
                          <Check size={14} aria-hidden="true" className="text-bosque" /> Íntegro
                        </>
                      ) : (
                        'Con diferencias'
                      )}
                    </dd>
                  </div>
                </dl>

                <ul className="flex flex-col">
                  {(resultado?.firmantes ?? []).map((f) => {
                    const e = ESTADO_FIRMANTE[f.estado] ?? ESTADO_FIRMANTE.pendiente;
                    return (
                      <li key={f.email + f.nombre} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm" style={{ borderTop: '1px solid rgba(27,31,27,0.1)' }}>
                        <span className="flex flex-col">
                          <span className="font-medium">{f.nombre}</span>
                          <span className="text-xs text-piedra">
                            {f.email}
                            {f.firmado_en ? ` · ${fechaHora(f.firmado_en)}` : f.rechazado_en ? ` · ${fechaHora(f.rechazado_en)}` : ''}
                          </span>
                        </span>
                        <Etiqueta tono={e.tono}>{e.texto}</Etiqueta>
                      </li>
                    );
                  })}
                </ul>

                {resultado?.bfa && (
                  <div className="flex flex-col gap-1.5 p-4 text-sm bg-marfil-oscuro">
                    <span className="text-[11px] uppercase tracking-[0.14em] text-piedra">Blockchain Federal Argentina</span>
                    {resultado.bfa.bloque ? (
                      <span className="inline-flex items-start gap-1.5">
                        <Check size={14} aria-hidden="true" className="text-bosque shrink-0 mt-1" />
                        <span>
                          El hash del PDF firmado quedó registrado en el bloque {resultado.bfa.bloque}
                          {resultado.bfa.registrado_en ? ` el ${fechaHora(resultado.bfa.registrado_en)}` : ''}.
                        </span>
                      </span>
                    ) : (
                      <span>El hash del PDF firmado se envió a la blockchain y está esperando entrar en un bloque.</span>
                    )}
                    <span className="text-xs text-piedra leading-[1.55]">
                      Solo se registró la huella, no el documento ni datos personales. Con el SHA-256 firmado y el recibo de abajo cualquiera puede comprobarlo en el sello de tiempo de BFA, sin pasar por FIRMA.
                    </span>
                  </div>
                )}

                <div className="flex flex-col gap-1 text-xs text-piedra break-all">
                  {s.final_sha256 && <span>SHA-256 firmado {s.final_sha256}</span>}
                  <span>SHA-256 original {s.original_sha256}</span>
                  {resultado?.bfa && <span>Recibo de BFA {resultado.bfa.recibo}</span>}
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </MarcoPublico>
  );
};

export default Verificar;
