import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../Button';
import { Campo, claseInput } from '../portal/ui';
import { MONEDAS, faltantes, formatoMonto, montoLetras, totales, type DatosComprobante, type Parte, type Renglon } from './modelo';
import { generarPdf, type Logo } from './pdf';

const Visor = lazy(() => import('../firma/Visor').then((m) => ({ default: m.Visor })));

/**
 * Formulario de un invoice o de un recibo con la vista previa del PDF
 * real al lado. Lo usan la herramienta pública y el portal; cada uno pone
 * su número, su emisor y sus botones.
 */
export const Editor: React.FC<{
  datos: DatosComprobante;
  alCambiar: (d: DatosComprobante) => void;
  /** Número a la vista. */
  numero: string;
  /** Si viene, el número se escribe a mano (herramienta pública). */
  alCambiarNumero?: (n: string) => void;
  ayudaNumero?: string;
  emisorEditable: boolean;
  ayudaEmisor?: React.ReactNode;
  /** Arriba de los datos de quien recibe, por ejemplo el selector de clientes del CRM. */
  antesReceptor?: React.ReactNode;
  /** Debajo de los datos del emisor, por ejemplo para subir el logo. */
  despuesEmisor?: React.ReactNode;
  logo: Logo | null;
  marca?: boolean;
  acciones: React.ReactNode;
}> = ({ datos: d, alCambiar, numero, alCambiarNumero, ayudaNumero, emisorEditable, ayudaEmisor, antesReceptor, despuesEmisor, logo, marca, acciones }) => {
  const set = <K extends keyof DatosComprobante>(k: K, v: DatosComprobante[K]) => alCambiar({ ...d, [k]: v });
  const setParte = (k: 'emisor' | 'receptor', campo: keyof Parte, v: string) => alCambiar({ ...d, [k]: { ...d[k], [campo]: v } });
  const setRenglon = (i: number, r: Partial<Renglon>) => set('renglones', d.renglones.map((x, j) => (j === i ? { ...x, ...r } : x)));
  const tot = totales(d);
  const pendientes = faltantes(d);
  const url = useVistaPrevia(d, numero, logo, marca);

  const parte = (k: 'emisor' | 'receptor', habilitada: boolean) => (
    <fieldset disabled={!habilitada} className="grid gap-4 tab:grid-cols-2 min-w-0">
      <div className="tab:col-span-2">
        <Campo etiqueta={k === 'emisor' ? 'Nombre o razón social' : d.tipo === 'invoice' ? 'Nombre o razón social del cliente' : 'Nombre de quien paga'}>
          <input className={claseInput} value={d[k].nombre} maxLength={200} onChange={(e) => setParte(k, 'nombre', e.target.value)} />
        </Campo>
      </div>
      <Campo etiqueta="ID fiscal" ayuda={k === 'emisor' ? 'CUIT, EIN, NIF o el que corresponda. Opcional.' : 'Opcional.'}>
        <input className={claseInput} value={d[k].idFiscal} maxLength={80} onChange={(e) => setParte(k, 'idFiscal', e.target.value)} />
      </Campo>
      <Campo etiqueta="Email">
        <input type="email" className={claseInput} value={d[k].email} maxLength={200} onChange={(e) => setParte(k, 'email', e.target.value)} />
      </Campo>
      <Campo etiqueta="Domicilio">
        <input className={claseInput} value={d[k].domicilio} maxLength={300} onChange={(e) => setParte(k, 'domicilio', e.target.value)} />
      </Campo>
      <Campo etiqueta="Teléfono">
        <input className={claseInput} value={d[k].telefono} maxLength={80} onChange={(e) => setParte(k, 'telefono', e.target.value)} />
      </Campo>
    </fieldset>
  );

  return (
    <div className="grid gap-10 desk:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] desk:gap-12 items-start">
      <div className="flex flex-col gap-10 min-w-0">
        <Bloque titulo="Datos del comprobante">
          <div className="grid gap-4 tab:grid-cols-2">
            <Campo etiqueta="Número" ayuda={ayudaNumero}>
              <input className={claseInput} value={numero} readOnly={!alCambiarNumero} disabled={!alCambiarNumero} maxLength={30} onChange={(e) => alCambiarNumero?.(e.target.value)} />
            </Campo>
            <Campo etiqueta="Idioma del PDF">
              <select className={claseInput} value={d.idioma} onChange={(e) => set('idioma', e.target.value as DatosComprobante['idioma'])}>
                <option value="es">Español</option>
                <option value="en">Inglés</option>
              </select>
            </Campo>
            <Campo etiqueta="Fecha">
              <input type="date" required className={claseInput} value={d.fecha} onChange={(e) => set('fecha', e.target.value)} />
            </Campo>
            {d.tipo === 'invoice' ? (
              <Campo etiqueta="Vencimiento" ayuda="Opcional.">
                <input type="date" className={claseInput} value={d.vencimiento} min={d.fecha} onChange={(e) => set('vencimiento', e.target.value)} />
              </Campo>
            ) : (
              <span className="hidden tab:block" />
            )}
            <Campo etiqueta="Moneda">
              <select className={claseInput} value={d.moneda} onChange={(e) => set('moneda', e.target.value)}>
                {MONEDAS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
        </Bloque>

        <Bloque titulo={d.tipo === 'invoice' ? 'Quién factura' : 'Quién recibe el dinero'} ayuda={ayudaEmisor}>
          {parte('emisor', emisorEditable)}
          {despuesEmisor}
        </Bloque>

        <Bloque titulo={d.tipo === 'invoice' ? 'A quién se factura' : 'Quién paga'}>
          {antesReceptor}
          {parte('receptor', true)}
        </Bloque>

        {d.tipo === 'invoice' ? (
          <Bloque titulo="Conceptos">
            <div className="flex flex-col gap-3">
              {d.renglones.map((r, i) => (
                <div key={i} className="grid gap-3 grid-cols-[1fr_1fr_auto] tab:grid-cols-[minmax(0,1fr)_88px_132px_auto] items-end bg-papel border border-borde-suave rounded-control p-3">
                  <div className="col-span-3 tab:col-span-1">
                    <Campo etiqueta={`Concepto ${i + 1}`}>
                      <textarea rows={1} className={`${claseInput} h-auto min-h-11 py-2.5 resize-y`} value={r.descripcion} maxLength={600} onChange={(e) => setRenglon(i, { descripcion: e.target.value })} />
                    </Campo>
                  </div>
                  <Campo etiqueta="Cantidad">
                    <Numero valor={r.cantidad} alCambiar={(n) => setRenglon(i, { cantidad: n })} />
                  </Campo>
                  <Campo etiqueta="Precio unitario">
                    <Numero valor={r.precio} alCambiar={(n) => setRenglon(i, { precio: n })} />
                  </Campo>
                  <button
                    type="button"
                    aria-label={`Quitar el concepto ${i + 1}`}
                    disabled={d.renglones.length === 1}
                    onClick={() => set('renglones', d.renglones.filter((_, j) => j !== i))}
                    className="h-11 w-11 grid place-items-center rounded-control text-piedra hover:text-peligro hover:bg-peligro-suave disabled:opacity-30 disabled:pointer-events-none"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              ))}
              <div>
                <Button type="button" variant="ghost" size="sm" disabled={d.renglones.length >= 60} onClick={() => set('renglones', [...d.renglones, { descripcion: '', cantidad: 1, precio: 0 }])}>
                  <Plus size={16} /> Agregar concepto
                </Button>
              </div>
            </div>
            <div className="grid gap-4 tab:grid-cols-3 mt-6">
              <Campo etiqueta={`Descuento (${d.moneda})`} ayuda="Opcional.">
                <Numero valor={d.descuento} alCambiar={(n) => set('descuento', n)} />
              </Campo>
              <Campo etiqueta="Impuesto" ayuda="Nombre, por ejemplo IVA o Sales tax.">
                <input className={claseInput} value={d.impuestoNombre} maxLength={40} onChange={(e) => set('impuestoNombre', e.target.value)} />
              </Campo>
              <Campo etiqueta="Impuesto (%)">
                <Numero valor={d.impuestoPorcentaje} alCambiar={(n) => set('impuestoPorcentaje', Math.min(100, n))} />
              </Campo>
            </div>
            <dl className="mt-6 ml-auto w-full max-w-[320px] text-[14px] grid grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 tabular-nums">
              <dt className="text-piedra">Subtotal</dt>
              <dd className="text-right">{formatoMonto(tot.subtotal, d.moneda, 'es')}</dd>
              {tot.descuento > 0 && (
                <>
                  <dt className="text-piedra">Descuento</dt>
                  <dd className="text-right">−{formatoMonto(tot.descuento, d.moneda, 'es')}</dd>
                </>
              )}
              {tot.impuesto > 0 && (
                <>
                  <dt className="text-piedra">{d.impuestoNombre || 'Impuesto'}</dt>
                  <dd className="text-right">{formatoMonto(tot.impuesto, d.moneda, 'es')}</dd>
                </>
              )}
              <dt className="font-semibold pt-1.5 border-t border-borde-suave">Total</dt>
              <dd className="text-right font-semibold pt-1.5 border-t border-borde-suave">{formatoMonto(tot.total, d.moneda, 'es')}</dd>
            </dl>
          </Bloque>
        ) : (
          <Bloque titulo="Pago recibido">
            <div className="grid gap-4 tab:grid-cols-2">
              <Campo etiqueta={`Monto (${d.moneda})`} ayuda={d.monto > 0 && d.idioma === 'es' ? montoLetras(d.monto, d.moneda) : undefined}>
                <Numero valor={d.monto} alCambiar={(n) => set('monto', n)} />
              </Campo>
              <Campo etiqueta="Medio de pago" ayuda="Opcional. Por ejemplo transferencia o efectivo.">
                <input className={claseInput} value={d.medioPago} maxLength={120} onChange={(e) => set('medioPago', e.target.value)} />
              </Campo>
              <div className="tab:col-span-2">
                <Campo etiqueta="En concepto de" ayuda="Por ejemplo, la segunda cuota del programa de mentoría.">
                  <input className={claseInput} value={d.concepto} maxLength={300} onChange={(e) => set('concepto', e.target.value)} />
                </Campo>
              </div>
            </div>
          </Bloque>
        )}

        <Bloque titulo="Notas y pie">
          <div className="grid gap-4">
            <Campo etiqueta="Notas" ayuda="Opcional. Van debajo del detalle.">
              <textarea rows={3} className={`${claseInput} h-auto py-2.5`} value={d.notas} maxLength={1500} onChange={(e) => set('notas', e.target.value)} />
            </Campo>
            <Campo etiqueta="Pie" ayuda="Opcional. Datos bancarios, condiciones o leyendas al final de la hoja.">
              <textarea rows={3} className={`${claseInput} h-auto py-2.5`} value={d.pie} maxLength={1000} onChange={(e) => set('pie', e.target.value)} />
            </Campo>
          </div>
        </Bloque>

        <div className="flex flex-col gap-3">
          {pendientes.length > 0 && <p className="text-[13.5px] text-piedra">Falta {pendientes.join(', ')}.</p>}
          <div className="flex flex-wrap gap-3">{acciones}</div>
        </div>
      </div>

      <div className="desk:sticky desk:top-6 min-w-0">
        <p className="text-[12.5px] font-medium text-piedra mb-2">Vista previa</p>
        <div className="border border-borde-suave rounded-control overflow-hidden">
          {url ? (
            <Suspense fallback={<HojaVacia />}>
              <Visor url={url} titulo="Vista previa" />
            </Suspense>
          ) : (
            <HojaVacia />
          )}
        </div>
      </div>
    </div>
  );
};

const Bloque: React.FC<{ titulo: string; ayuda?: React.ReactNode; children: React.ReactNode }> = ({ titulo, ayuda, children }) => (
  <section className="flex flex-col gap-4 min-w-0">
    <div className="flex flex-col gap-1 pb-2 border-b border-borde-suave">
      <h2 className="text-[17px] font-semibold">{titulo}</h2>
      {ayuda && <p className="text-[13px] text-piedra leading-[1.45]">{ayuda}</p>}
    </div>
    {children}
  </section>
);

const HojaVacia = () => (
  <div className="bg-linea-suave p-6">
    <div className="w-full bg-white" style={{ aspectRatio: '1 / 1.414' }} />
  </div>
);

/** Número con coma o punto, sin pelearse con lo que se está escribiendo. */
const Numero: React.FC<{ valor: number; alCambiar: (n: number) => void }> = ({ valor, alCambiar }) => {
  const [texto, setTexto] = useState(valor ? String(valor).replace('.', ',') : '');
  const emitido = useRef(valor);
  // Solo se reescribe si el valor cambió desde afuera, por ejemplo al elegir un cliente.
  useEffect(() => {
    if (valor !== emitido.current) {
      emitido.current = valor;
      setTexto(valor ? String(valor).replace('.', ',') : '');
    }
  }, [valor]);
  return (
    <input
      inputMode="decimal"
      className={`${claseInput} tabular-nums`}
      value={texto}
      placeholder="0"
      onChange={(e) => {
        const t = e.target.value.replace(/[^\d.,]/g, '');
        setTexto(t);
        // 1.500,50 o 1500.50: la última coma o punto con uno o dos decimales es el separador decimal.
        const normal = /[.,]\d{1,2}$/.test(t) ? t.slice(0, t.search(/[.,]\d{1,2}$/)).replace(/[.,]/g, '') + '.' + t.split(/[.,]/).pop() : t.replace(/[.,]/g, '');
        const n = Number(normal);
        emitido.current = Number.isFinite(n) ? Math.min(n, 999_999_999) : 0;
        alCambiar(emitido.current);
      }}
    />
  );
};

/** Arma el PDF un rato después de la última tecla y devuelve su URL. */
function useVistaPrevia(d: DatosComprobante, numero: string, logo: Logo | null, marca?: boolean): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let vigente = true;
    let creada: string | null = null;
    const t = setTimeout(() => {
      generarPdf(d, { numero, logo, marca }).then(
        (bytes) => {
          if (!vigente) return;
          creada = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
          setUrl(creada);
        },
        () => undefined,
      );
    }, 400);
    return () => {
      vigente = false;
      clearTimeout(t);
      // La anterior se libera cuando ya se muestra la nueva.
      if (creada) setTimeout(() => URL.revokeObjectURL(creada!), 2000);
    };
  }, [d, numero, logo, marca]);
  return url;
}
