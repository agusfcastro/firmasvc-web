import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, Check, Eraser, PenLine, Type, X } from 'lucide-react';
import { Button } from '../Button';
import { Aviso, Campo, Etiqueta, claseInput } from '../portal/ui';
import { ESTADO_FIRMANTE, MarcoPublico, fechaHora, llamarFirma, usePaginaPrivada } from './comun';
import { Visor } from './Visor';

/**
 * Página pública donde cada firmante lee y firma. /firmar/<enlace personal>
 * Todo pasa en la web, como en ZapSign: el PDF se muestra hoja por hoja en
 * la página y nunca se abre ni se descarga mientras está pendiente.
 *   1. Lee el documento
 *   2. Confirma que es él con un código que le llega al mail
 *   3. Firma dibujando o escribiendo su nombre, y acepta
 * También puede rechazarlo con un motivo.
 */

interface Datos {
  bloqueo: string | null;
  sobre: {
    titulo: string;
    mensaje: string | null;
    emisor: string;
    codigo: string;
    estado: string;
    vence_en: string;
    paginas: number;
    nombre_archivo: string;
    sha256: string | null;
    secuencial: boolean;
  };
  firmante: { nombre: string; email: string; estado: string; pedir_documento: boolean; validado: boolean; firmado_en: string | null };
  otros: { nombre: string; estado: string; orden: number }[];
  pdf: string | null;
  consentimiento: string;
  mail: boolean;
}

/* ------------------------------------------------------------------ */
/* Lienzo para dibujar la firma                                        */
/* ------------------------------------------------------------------ */
const ANCHO_LIENZO = 640;
const ALTO_LIENZO = 220;

const Lienzo: React.FC<{ alCambiar: (png: string | null) => void }> = ({ alCambiar }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const dibujando = useRef(false);
  const ultimo = useRef<{ x: number; y: number } | null>(null);
  const trazos = useRef(0);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const escala = 2;
    c.width = ANCHO_LIENZO * escala;
    c.height = ALTO_LIENZO * escala;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.scale(escala, escala);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1B1F1B';
    ctx.lineWidth = 2.4;
  }, []);

  const punto = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * ANCHO_LIENZO, y: ((e.clientY - r.top) / r.height) * ALTO_LIENZO };
  };

  const empezar = (e: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* algunos lápices no lo admiten y se dibuja igual */
    }
    dibujando.current = true;
    ultimo.current = punto(e);
    const ctx = ref.current?.getContext('2d');
    if (ctx && ultimo.current) {
      ctx.beginPath();
      ctx.arc(ultimo.current.x, ultimo.current.y, 1.2, 0, Math.PI * 2);
      ctx.fillStyle = '#1B1F1B';
      ctx.fill();
    }
  };

  const mover = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dibujando.current || !ultimo.current) return;
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const p = punto(e);
    ctx.beginPath();
    ctx.moveTo(ultimo.current.x, ultimo.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ultimo.current = p;
  };

  const terminar = () => {
    if (!dibujando.current) return;
    dibujando.current = false;
    trazos.current++;
    alCambiar(ref.current ? recortar(ref.current) : null);
  };

  const borrar = () => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, ANCHO_LIENZO, ALTO_LIENZO);
    trazos.current = 0;
    alCambiar(null);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="relative bg-white border border-[rgba(27,31,27,0.22)]">
        <canvas
          ref={ref}
          aria-label="Espacio para dibujar tu firma"
          className="block w-full touch-none cursor-crosshair"
          style={{ aspectRatio: `${ANCHO_LIENZO} / ${ALTO_LIENZO}` }}
          onPointerDown={empezar}
          onPointerMove={mover}
          onPointerUp={terminar}
          onPointerLeave={terminar}
          onPointerCancel={terminar}
        />
        <span aria-hidden="true" className="absolute left-6 right-6 bottom-[22%] border-b border-dashed border-[rgba(27,31,27,0.25)] pointer-events-none" />
      </div>
      <div className="flex items-center justify-between text-xs text-piedra">
        <span>Dibujá con el dedo o el mouse.</span>
        <button type="button" onClick={borrar} className="inline-flex items-center gap-1.5 font-medium text-tinta hover:text-bosque">
          <Eraser size={14} aria-hidden="true" /> Borrar
        </button>
      </div>
    </div>
  );
};

/** PNG recortado a lo dibujado, con un margen. Vacío devuelve null. */
function recortar(c: HTMLCanvasElement): string | null {
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  const { width, height } = c;
  const datos = ctx.getImageData(0, 0, width, height).data;
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (datos[(y * width + x) * 4 + 3] > 10) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  // Un punto suelto no es una firma.
  if (x1 < 0 || x1 - x0 < 40 || (x1 - x0) * (y1 - y0) < 2000) return null;
  const m = 16;
  x0 = Math.max(0, x0 - m);
  y0 = Math.max(0, y0 - m);
  x1 = Math.min(width, x1 + m);
  y1 = Math.min(height, y1 + m);
  const salida = document.createElement('canvas');
  salida.width = x1 - x0;
  salida.height = y1 - y0;
  salida.getContext('2d')?.drawImage(c, x0, y0, x1 - x0, y1 - y0, 0, 0, x1 - x0, y1 - y0);
  return salida.toDataURL('image/png');
}

/** El nombre escrito se pasa a imagen para que la constancia lo muestre igual que se vio. */
function nombreComoImagen(nombre: string): string | null {
  const limpio = nombre.trim();
  if (limpio.length < 2) return null;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  const fuente = 'italic 400 88px "Snell Roundhand", "Segoe Script", "Brush Script MT", "Apple Chancery", Georgia, serif';
  ctx.font = fuente;
  const ancho = Math.ceil(ctx.measureText(limpio).width);
  c.width = Math.min(2400, ancho + 64);
  c.height = 150;
  ctx.font = fuente;
  ctx.fillStyle = '#1B1F1B';
  ctx.textBaseline = 'middle';
  ctx.fillText(limpio, 32, 78, c.width - 64);
  return c.toDataURL('image/png');
}

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */
export const FirmarApp: React.FC<{ token: string }> = ({ token }) => {
  usePaginaPrivada('Firmar documento · FIRMA');
  const [datos, setDatos] = useState<Datos | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const [codigoEnviado, setCodigoEnviado] = useState<string | null>(null);
  const [codigo, setCodigo] = useState('');
  const [validado, setValidado] = useState(false);

  const [modo, setModo] = useState<'dibujada' | 'escrita'>('dibujada');
  const [dibujo, setDibujo] = useState<string | null>(null);
  const [escrito, setEscrito] = useState('');
  const [documento, setDocumento] = useState('');
  const [acepto, setAcepto] = useState(false);

  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [listo, setListo] = useState<'firmado' | 'rechazado' | null>(null);
  const [panel, setPanel] = useState(false);

  // Con la ventana abierta, la página de atrás no se mueve y Escape vuelve al documento.
  useEffect(() => {
    if (!panel) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && setPanel(false);
    document.addEventListener('keydown', tecla);
    return () => {
      document.body.style.overflow = previo;
      document.removeEventListener('keydown', tecla);
    };
  }, [panel]);

  const cargar = useCallback(async () => {
    const r = await llamarFirma<Datos>({ accion: 'ver', token });
    if (!r.ok) return setErrorCarga(r.error);
    setDatos(r.datos);
    setValidado(r.datos.firmante.validado);
    setEscrito((v) => v || r.datos.firmante.nombre);
  }, [token]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function pedirCodigo() {
    setOcupado(true);
    setError(null);
    const r = await llamarFirma<{ email: string }>({ accion: 'codigo', token });
    setOcupado(false);
    if (!r.ok) return setError(r.error);
    setCodigoEnviado(r.datos.email);
    setCodigo('');
  }

  async function validar(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true);
    setError(null);
    const r = await llamarFirma({ accion: 'validar', token, codigo });
    setOcupado(false);
    if (!r.ok) return setError(r.error);
    setValidado(true);
  }

  async function firmar(e: React.FormEvent) {
    e.preventDefault();
    if (!datos) return;
    const imagen = modo === 'dibujada' ? dibujo : nombreComoImagen(escrito);
    if (!imagen) return setError(modo === 'dibujada' ? 'Dibujá tu firma en el recuadro.' : 'Escribí tu nombre completo.');
    if (datos.firmante.pedir_documento && documento.replace(/\D/g, '').length < 6) return setError('Completá tu número de documento.');
    if (!acepto) return setError('Marcá que estás de acuerdo para poder firmar.');
    setOcupado(true);
    setError(null);
    const r = await llamarFirma({ accion: 'firmar', token, tipo: modo, imagen, documento, acepto });
    setOcupado(false);
    if (!r.ok) {
      if (r.status === 403) setValidado(false);
      return setError(r.error);
    }
    setListo('firmado');
    setPanel(false);
    window.scrollTo(0, 0);
    void cargar();
  }

  async function rechazar(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true);
    setError(null);
    const r = await llamarFirma({ accion: 'rechazar', token, motivo });
    setOcupado(false);
    if (!r.ok) return setError(r.error);
    setListo('rechazado');
    setPanel(false);
    window.scrollTo(0, 0);
    void cargar();
  }

  if (errorCarga) {
    return (
      <MarcoPublico>
        <div className="wrap max-w-[640px] py-20 flex flex-col gap-6">
          <h1 className="h2">No pudimos abrir el documento</h1>
          <Aviso tipo="error">{errorCarga}</Aviso>
          <p className="text-piedra">Revisá que el enlace esté completo. Si lo copiaste del mail, abrilo directo desde el botón.</p>
        </div>
      </MarcoPublico>
    );
  }

  if (!datos) {
    return (
      <MarcoPublico>
        <div className="wrap py-24">
          <p className="eyebrow text-piedra animate-pulse">Cargando el documento</p>
        </div>
      </MarcoPublico>
    );
  }

  const { sobre, firmante } = datos;
  const puedeFirmar = !datos.bloqueo && !listo;
  const yaFirmo = listo === 'firmado' || (firmante.estado === 'firmado' && !listo);

  function abrir(rechazo: boolean) {
    setRechazando(rechazo);
    setError(null);
    setPanel(true);
  }

  return (
    <MarcoPublico conBarra={puedeFirmar}>
      <section style={{ borderBottom: '1px solid rgba(27,31,27,0.12)' }}>
        <div className="wrap pt-8 pb-7 desk:pt-12 desk:pb-9 flex flex-col gap-3 max-w-[900px] mx-auto">
          <p className="eyebrow text-piedra">{sobre.emisor} te envió para firmar</p>
          <h1 className="h2">{sobre.titulo}</h1>
          {sobre.mensaje && <p className="text-[17px] leading-[1.6] text-piedra max-w-[60ch] whitespace-pre-line">{sobre.mensaje}</p>}
          <p className="text-sm text-piedra">
            Hola {firmante.nombre}. {puedeFirmar ? `Leé el documento acá abajo y firmalo cuando estés listo. Tenés tiempo hasta el ${fechaHora(sobre.vence_en)}.` : ''}
          </p>
        </div>
      </section>

      <div className={`wrap max-w-[900px] mx-auto py-6 desk:py-10 flex flex-col gap-6`}>
        {yaFirmo ? (
          <div className="bg-[#E4E9E3] p-6 flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center justify-center w-11 h-11 bg-bosque text-marfil shrink-0">
              <Check size={22} aria-hidden="true" />
            </span>
            <div className="flex-1 min-w-[220px] flex flex-col gap-1">
              <p className="font-semibold">Listo, firmaste{firmante.firmado_en ? ` el ${fechaHora(firmante.firmado_en)}` : ''}</p>
              <p className="text-[15px] leading-[1.55]">
                {sobre.estado === 'completado'
                  ? 'Firmaron todos. Abajo ves el documento firmado, con la constancia al final, y también te llegó por mail.'
                  : 'Cuando firmen todos te mandamos por mail el documento firmado, con la constancia al final.'}
              </p>
            </div>
            {sobre.estado === 'completado' && datos.pdf && (
              <a
                href={`${datos.pdf}&download=${encodeURIComponent(sobre.nombre_archivo)}`}
                className="inline-flex items-center gap-2 h-11 px-5 bg-bosque text-marfil text-sm font-medium hover:bg-bosque-dark"
              >
                <ArrowDown size={16} aria-hidden="true" /> Guardar una copia
              </a>
            )}
          </div>
        ) : listo === 'rechazado' ? (
          <Aviso>Rechazaste el documento. Le avisamos a {sobre.emisor} y el envío quedó cerrado.</Aviso>
        ) : datos.bloqueo ? (
          <Aviso>{datos.bloqueo}</Aviso>
        ) : null}

        {datos.pdf ? <Visor url={datos.pdf} titulo={sobre.titulo} /> : !yaFirmo && <div className="bg-marfil-oscuro p-8 text-sm text-piedra">El documento ya no está disponible desde este enlace.</div>}

        <div className="flex flex-col gap-5">
          {datos.otros.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="eyebrow text-[11px] text-piedra">{sobre.secuencial ? 'Firman en orden' : 'También firman'}</p>
              <ul className="flex flex-col">
                {datos.otros.map((o) => {
                  const e = ESTADO_FIRMANTE[o.estado] ?? ESTADO_FIRMANTE.pendiente;
                  return (
                    <li key={`${o.orden}-${o.nombre}`} className="flex items-center justify-between gap-3 py-2.5 text-sm" style={{ borderBottom: '1px solid rgba(27,31,27,0.1)' }}>
                      <span>
                        {sobre.secuencial && <span className="tabular-nums text-piedra mr-2">{o.orden}.</span>}
                        {o.nombre}
                      </span>
                      <Etiqueta tono={e.tono}>{e.texto}</Etiqueta>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          <p className="text-xs text-piedra break-all">
            {sobre.nombre_archivo} · {sobre.paginas} {sobre.paginas === 1 ? 'hoja' : 'hojas'} · Código {sobre.codigo}
            {sobre.sha256 ? ` · SHA-256 ${sobre.sha256}` : ''}
          </p>
        </div>
      </div>

      {/* Barra fija para firmar, siempre a mano mientras se lee */}
      {puedeFirmar && !panel && (
        <div className="fixed inset-x-0 bottom-0 z-40 bg-marfil" style={{ borderTop: '1px solid rgba(27,31,27,0.15)', boxShadow: '0 -8px 24px rgba(27,31,27,0.08)' }}>
          <div className="wrap max-w-[900px] mx-auto py-3 tab:py-4 flex items-center gap-4">
            <p className="hidden tab:block flex-1 text-sm text-piedra">Cuando termines de leer, firmá desde acá.</p>
            <button type="button" onClick={() => abrir(true)} className="text-sm text-piedra underline underline-offset-4 hover:text-tinta whitespace-nowrap">
              No lo voy a firmar
            </button>
            <Button onClick={() => abrir(false)} className="flex-1 tab:flex-none">
              <PenLine size={18} aria-hidden="true" /> Firmar
            </Button>
          </div>
        </div>
      )}

      {/* Ventana para firmar o rechazar. En el celular ocupa toda la pantalla. */}
      {puedeFirmar && panel && (
        <div className="fixed inset-0 z-50 flex tab:items-center tab:justify-center bg-[rgba(27,31,27,0.55)] tab:p-6" role="dialog" aria-modal="true" aria-label={rechazando ? 'Rechazar el documento' : 'Firmar el documento'} onMouseDown={(e) => e.target === e.currentTarget && setPanel(false)}>
          <div className="relative w-full tab:max-w-[520px] h-full tab:h-auto tab:max-h-[92vh] overflow-y-auto bg-marfil flex flex-col">
            <div className="sticky top-0 z-10 bg-marfil flex items-center justify-between gap-4 px-6 py-4" style={{ borderBottom: '1px solid rgba(27,31,27,0.12)' }}>
              <span className="eyebrow text-[11px] text-piedra">{rechazando ? 'Rechazar' : 'Firmar'} · {sobre.titulo}</span>
              <button type="button" onClick={() => setPanel(false)} aria-label="Volver al documento" className="w-9 h-9 inline-flex items-center justify-center hover:bg-marfil-oscuro shrink-0">
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            {!rechazando ? (
              <div className="p-6 flex flex-col gap-7">
                {/* Paso 1 */}
                <div className="flex flex-col gap-3">
                  <p className="eyebrow text-[11px] text-piedra">Paso 1 · Confirmá que sos vos</p>
                  {validado ? (
                    <p className="inline-flex items-center gap-2 text-sm font-medium text-bosque">
                      <Check size={16} aria-hidden="true" /> Mail confirmado
                    </p>
                  ) : !codigoEnviado ? (
                    <>
                      <p className="text-[15px] leading-[1.6]">Te mandamos un código de 6 números a {firmante.email}.</p>
                      <Button onClick={pedirCodigo} disabled={ocupado || !datos.mail} fullWidth>
                        {ocupado ? 'Enviando' : 'Mandarme el código'}
                      </Button>
                      {!datos.mail && <Aviso tipo="error">El envío de mails no está configurado. Avisale a {sobre.emisor}.</Aviso>}
                    </>
                  ) : (
                    <form onSubmit={validar} className="flex flex-col gap-3">
                      <p className="text-[15px] leading-[1.6]">Escribí el código que te llegó a {codigoEnviado}. Si no lo ves, revisá spam.</p>
                      <input
                        value={codigo}
                        onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        aria-label="Código de 6 números"
                        placeholder="000000"
                        className={`${claseInput} text-center text-2xl tracking-[0.4em] tabular-nums`}
                        autoFocus
                      />
                      <Button type="submit" disabled={ocupado || codigo.length !== 6} fullWidth>
                        {ocupado ? 'Revisando' : 'Confirmar'}
                      </Button>
                      <button type="button" onClick={pedirCodigo} disabled={ocupado} className="text-sm text-piedra underline underline-offset-4 self-start hover:text-tinta">
                        Mandarme otro código
                      </button>
                    </form>
                  )}
                  {error && !validado && <Aviso tipo="error">{error}</Aviso>}
                </div>

                {/* Paso 2 */}
                <form onSubmit={firmar} className={`flex flex-col gap-5 ${validado ? '' : 'opacity-40 pointer-events-none select-none'}`} aria-disabled={!validado}>
                  <p className="eyebrow text-[11px] text-piedra">Paso 2 · Firmá</p>
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
                      <div className="bg-white border border-[rgba(27,31,27,0.22)] h-24 flex items-center px-6 overflow-hidden">
                        <span className="text-[40px] leading-none truncate" style={{ fontFamily: '"Snell Roundhand", "Segoe Script", "Brush Script MT", "Apple Chancery", Georgia, serif', fontStyle: 'italic' }}>
                          {escrito || ' '}
                        </span>
                      </div>
                    </div>
                  )}

                  {firmante.pedir_documento && (
                    <Campo etiqueta="Número de documento" ayuda="DNI, pasaporte o el documento de tu país.">
                      <input value={documento} onChange={(e) => setDocumento(e.target.value.slice(0, 40))} className={claseInput} inputMode="text" />
                    </Campo>
                  )}

                  <label className="flex items-start gap-3 text-sm leading-[1.55] cursor-pointer">
                    <input type="checkbox" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} className="mt-1 w-4 h-4 accent-[#173A2F] shrink-0" />
                    <span>{datos.consentimiento}</span>
                  </label>

                  {error && validado && <Aviso tipo="error">{error}</Aviso>}

                  <Button type="submit" disabled={ocupado || !validado} fullWidth size="lg">
                    {ocupado ? 'Firmando' : 'Firmar el documento'}
                  </Button>
                  <p className="text-xs text-piedra leading-[1.5]">Guardamos tu firma, la fecha y hora, tu IP y tu dispositivo, y los sumamos a una constancia al final del documento.</p>
                </form>
              </div>
            ) : (
              <form onSubmit={rechazar} className="p-6 flex flex-col gap-4">
                <h2 className="h3">Rechazar el documento</h2>
                <p className="text-[15px] leading-[1.6] text-piedra">Se cierra el envío para todos y le avisamos a {sobre.emisor}. No se puede deshacer.</p>
                <Campo etiqueta="Motivo">
                  <textarea value={motivo} onChange={(e) => setMotivo(e.target.value.slice(0, 1000))} rows={4} className={`${claseInput} h-auto py-3`} />
                </Campo>
                {error && <Aviso tipo="error">{error}</Aviso>}
                <div className="flex flex-wrap gap-3">
                  <Button type="submit" variant="dark" disabled={ocupado || motivo.trim().length < 3}>
                    {ocupado ? 'Enviando' : 'Rechazar'}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setPanel(false)}>
                    Volver al documento
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </MarcoPublico>
  );
};

export default FirmarApp;
