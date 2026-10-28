import React, { useEffect, useState } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { Button } from '../../Button';
import { supabase } from '../supabase';
import { Aviso, Campo, Encabezado, Enlace, Etiqueta, claseInput } from '../ui';
import { useVistaPrevia } from '../vistaPrevia';
import { BotonCopiar } from './firma';
import { VARIABLES } from '../../../api/_lib/variables';
import { dinero, type Servicio } from './tipos';

/**
 * Servicios que vende cada empresa. Los carga el titular (o FIRMA) y el
 * ticket es opcional, porque no todos tienen precio fijo y a veces hay
 * descuentos: en cada venta el monto se puede cambiar.
 * El contrato modelo de cada servicio se elige entre los Word de la
 * biblioteca (Documentos › Contratos de servicio). Sus variables {{...}} se
 * completan con la ficha de cada venta y el contrato sale a firmar desde ahí.
 *   /portal/crm/servicios
 */

interface Fila extends Servicio {
  documento_id?: string | null;
  documento_pif_id?: string | null;
}

interface Modelo {
  id: string;
  titulo: string;
  archivo_nombre: string | null;
  organizacion_id: string | null;
}

interface Borrador {
  id?: string;
  clave: string;
  nombre: string;
  precio: string;
  activo: boolean;
  documento_id: string;
  documento_pif_id: string;
}

const VACIO: Borrador = { clave: '', nombre: '', precio: '', activo: true, documento_id: '', documento_pif_id: '' };

/** Código corto a partir del nombre: "Mentoría 3 meses" pasa a MENTORIA-3-MESES. */
function codigoDe(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
}

export const Servicios: React.FC<{ orgId: string; orgNombre: string; esAdmin: boolean; puedeGestionar: boolean }> = ({ orgId, orgNombre, esAdmin, puedeGestionar }) => {
  const [lista, setLista] = useState<Fila[]>([]);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const soloLectura = Boolean(useVistaPrevia()) || !puedeGestionar;
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [firmante, setFirmante] = useState({ nombre: '', email: '' });
  const [guardandoFirmante, setGuardandoFirmante] = useState(false);

  async function cargar() {
    if (!supabase) return;
    const [{ data, error: e }, { data: docs }, { data: org }] = await Promise.all([
      supabase.from('crm_servicios').select('*').eq('organizacion_id', orgId).order('activo', { ascending: false }).order('nombre'),
      supabase.from('documentos').select('id, titulo, archivo_nombre, organizacion_id').eq('seccion', 'servicio').eq('activo', true).not('archivo_ruta', 'is', null).order('orden').order('titulo'),
      supabase.from('organizaciones').select('firmante_nombre, firmante_email').eq('id', orgId).maybeSingle(),
    ]);
    if (e) setError(e.message);
    setLista((data as Fila[]) ?? []);
    // Solo Word, y de la biblioteca común o de esta empresa.
    setModelos(((docs ?? []) as Modelo[]).filter((d) => /\.docx$/i.test(d.archivo_nombre ?? '') && (!d.organizacion_id || d.organizacion_id === orgId)));
    setFirmante({ nombre: (org?.firmante_nombre as string | null) ?? '', email: (org?.firmante_email as string | null) ?? '' });
  }

  async function guardarFirmante(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    const email = firmante.email.trim();
    if ((firmante.nombre.trim() === '') !== (email === '')) return setError('Completá el nombre y el mail de quien firma, o dejá los dos vacíos para que firme el titular.');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError('El mail de quien firma no es válido.');
    setGuardandoFirmante(true);
    setError(null);
    setOk(null);
    const { error: err } = await supabase.rpc('organizacion_firmante', { p_org: orgId, p_nombre: firmante.nombre, p_email: email });
    setGuardandoFirmante(false);
    if (err) return setError(err.message);
    setOk('Listo. Esa persona firma los contratos por la empresa.');
  }

  const nombreModelo = (id: string | null | undefined) => modelos.find((m) => m.id === id)?.titulo ?? null;

  useEffect(() => {
    void cargar();
  }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !borrador) return;
    const nombre = borrador.nombre.trim();
    const clave = (borrador.clave.trim() || codigoDe(nombre)).toUpperCase();
    if (!nombre) return setError('Poné el nombre del servicio.');
    if (!clave) return setError('Poné un código para el servicio.');
    const precio = borrador.precio.trim() === '' ? null : Number(borrador.precio);
    if (precio !== null && (!Number.isFinite(precio) || precio <= 0)) return setError('El ticket tiene que ser un monto mayor a cero, o quedar vacío.');

    setGuardando(true);
    setError(null);
    setOk(null);
    const datos: Record<string, unknown> = {
      nombre,
      precio,
      activo: borrador.activo,
      documento_id: borrador.documento_id || null,
      documento_pif_id: borrador.documento_pif_id || null,
    };

    // El código no se cambia después del alta, porque las ventas ya cargadas lo usan.
    const { error: err } = borrador.id
      ? await supabase.from('crm_servicios').update(datos).eq('id', borrador.id)
      : await supabase.from('crm_servicios').insert({ ...datos, organizacion_id: orgId, clave });
    setGuardando(false);
    if (err) return setError(/duplicate|unique/i.test(err.message) ? `Ya hay un servicio con el código ${clave}.` : err.message);
    setOk(borrador.id ? 'Servicio actualizado.' : 'Servicio agregado. Ya aparece al cargar una venta.');
    setBorrador(null);
    void cargar();
  }

  const selectorModelo = (valor: string, alCambiar: (id: string) => void, vacio: string) => (
    <select className={claseInput} value={valor} onChange={(e) => alCambiar(e.target.value)}>
      <option value="">{vacio}</option>
      {modelos.map((m) => (
        <option key={m.id} value={m.id}>
          {m.titulo}
          {m.organizacion_id ? ' · exclusivo de la empresa' : ''}
        </option>
      ))}
    </select>
  );

  return (
    <>
      <Encabezado
        eyebrow={
          <Enlace a="/portal/crm" className="inline-flex items-center gap-1.5 hover:text-bosque">
            <ArrowLeft size={13} aria-hidden="true" /> {orgNombre || 'CRM'}
          </Enlace>
        }
        titulo={
          <>
            Servicios de <span className="text-bosque">{orgNombre}</span>
          </>
        }
        bajada="Lo que vende la empresa. El ticket es opcional: si no hay precio fijo o hubo descuento, el monto se carga en cada venta."
        acciones={
          !soloLectura && !borrador ? (
            <Button size="lg" onClick={() => setBorrador({ ...VACIO })} className="self-end">
              <Plus size={18} /> Nuevo servicio
            </Button>
          ) : null
        }
      />
      <div className="wrap py-10 desk:py-12 flex flex-col gap-8">
        {error && <Aviso tipo="error">{error}</Aviso>}
        {ok && <Aviso tipo="ok">{ok}</Aviso>}
        {!puedeGestionar && <Aviso tipo="info">Los servicios los carga el titular de la empresa.</Aviso>}

        {borrador && (
          <form onSubmit={guardar} className="bg-marfil-oscuro p-6 desk:p-8 space-y-5 max-w-[680px]">
            <h2 className="h3">{borrador.id ? 'Editar servicio' : 'Nuevo servicio'}</h2>
            <Campo etiqueta="Nombre del servicio">
              <input required className={claseInput} value={borrador.nombre} onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })} placeholder="Mentoría 3 meses" />
            </Campo>
            <Campo etiqueta="Código" ayuda={borrador.id ? 'No se cambia, porque lo usan las ventas ya cargadas.' : 'Corto, para listados y reportes. Si lo dejás vacío se arma con el nombre.'}>
              <input
                className={`${claseInput} uppercase`}
                disabled={Boolean(borrador.id)}
                maxLength={24}
                value={borrador.clave}
                placeholder={codigoDe(borrador.nombre) || '3M'}
                onChange={(e) => setBorrador({ ...borrador, clave: e.target.value })}
              />
            </Campo>
            <Campo etiqueta="Ticket (USD, opcional)" ayuda="Precio de lista. Al cargar una venta aparece como monto sugerido y se puede cambiar.">
              <input type="number" step="0.01" min="0" className={claseInput} value={borrador.precio} onChange={(e) => setBorrador({ ...borrador, precio: e.target.value })} />
            </Campo>
            <fieldset className="space-y-4 pt-5" style={{ borderTop: '1px solid rgba(27,31,27,0.15)' }}>
              <legend className="eyebrow text-piedra pb-2">Contrato modelo</legend>
              <p className="text-xs text-piedra">
                Elegí un Word de la biblioteca de Documentos, sección Contratos de servicio. En cada venta sus variables, como {'{{NOMBRE}}'} o {'{{DETALLE_CUOTAS}}'}, se completan con la ficha.
              </p>
              <Campo etiqueta="Modelo">{selectorModelo(borrador.documento_id, (id) => setBorrador({ ...borrador, documento_id: id }), 'Sin modelo')}</Campo>
              <Campo etiqueta="Modelo para pago total (opcional)" ayuda="Solo si el contrato de pago total es distinto. Si no, se usa el modelo general.">
                {selectorModelo(borrador.documento_pif_id, (id) => setBorrador({ ...borrador, documento_pif_id: id }), 'El mismo modelo')}
              </Campo>
              {modelos.length === 0 && <Aviso>Todavía no hay contratos modelo en Word en la biblioteca. FIRMA los carga en Documentos.</Aviso>}
            </fieldset>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={borrador.activo} onChange={(e) => setBorrador({ ...borrador, activo: e.target.checked })} />
              Activo. Si lo desactivás, deja de aparecer al cargar ventas nuevas.
            </label>
            <div className="flex gap-3">
              <Button type="submit" disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setBorrador(null)}>
                Cancelar
              </Button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="tabla min-w-[640px]">
            <thead>
              <tr>
                <th>Servicio</th>
                <th>Ticket</th>
                <th>Modelo de contrato</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-piedra">
                    Todavía no hay servicios cargados.
                  </td>
                </tr>
              )}
              {lista.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div className="font-heading font-bold text-[16px] leading-tight">{s.nombre || s.clave}</div>
                    <div className="text-xs text-piedra">{s.clave}</div>
                  </td>
                  <td className="tabular-nums">{s.precio ? dinero(Number(s.precio)) : <span className="text-piedra">A definir en cada venta</span>}</td>
                  <td>
                    {nombreModelo(s.documento_id) ? (
                      <div className="flex flex-col gap-1">
                        <span className="text-sm">{nombreModelo(s.documento_id)}</span>
                        {nombreModelo(s.documento_pif_id) && <span className="text-xs text-piedra">Pago total: {nombreModelo(s.documento_pif_id)}</span>}
                      </div>
                    ) : (
                      <Etiqueta tono="alerta">Falta</Etiqueta>
                    )}
                  </td>
                  <td>{s.activo !== false ? <Etiqueta tono="bosque">Activo</Etiqueta> : <Etiqueta>Inactivo</Etiqueta>}</td>
                  <td className="text-right">
                    {!soloLectura && (
                      <button
                        type="button"
                        className="underline underline-offset-4 hover:text-bosque"
                        onClick={() =>
                          setBorrador({
                            id: s.id,
                            clave: s.clave,
                            nombre: s.nombre ?? '',
                            precio: s.precio === null ? '' : String(s.precio),
                            activo: s.activo !== false,
                            documento_id: s.documento_id ?? '',
                            documento_pif_id: s.documento_pif_id ?? '',
                          })
                        }
                      >
                        Editar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-8 desk:grid-cols-2 desk:items-start">
          <form onSubmit={guardarFirmante} className="bg-marfil-oscuro p-6 desk:p-8 space-y-5">
            <div className="space-y-2">
              <h2 className="h3">Quién firma por la empresa</h2>
              <p className="text-sm text-piedra">Firma cada contrato a la vez que el cliente, con su propio enlace. Si lo dejás vacío, firma el titular de la cuenta.</p>
            </div>
            <div className="grid gap-4 tab:grid-cols-2">
              <Campo etiqueta="Nombre y apellido">
                <input className={claseInput} disabled={soloLectura} value={firmante.nombre} maxLength={160} onChange={(e) => setFirmante({ ...firmante, nombre: e.target.value })} />
              </Campo>
              <Campo etiqueta="Mail">
                <input type="email" className={claseInput} disabled={soloLectura} value={firmante.email} onChange={(e) => setFirmante({ ...firmante, email: e.target.value })} />
              </Campo>
            </div>
            {!soloLectura && (
              <Button type="submit" variant="ghost" disabled={guardandoFirmante}>
                {guardandoFirmante ? 'Guardando…' : 'Guardar firmante'}
              </Button>
            )}
          </form>

          <details className="bg-white border border-[rgba(27,31,27,0.14)] p-6 desk:p-8 group">
            <summary className="cursor-pointer list-none flex items-center justify-between gap-4">
              <span className="h3">Variables de los modelos</span>
              <span className="text-sm text-piedra group-open:hidden">Ver lista</span>
            </summary>
            <p className="text-sm text-piedra mt-4 mb-4">Escribilas en el Word tal cual, con llaves dobles. Se reemplazan con los datos de la ficha al generar el contrato.</p>
            <p className="text-sm text-piedra mb-4">
              Si un dato puede faltar, encerrá el texto que depende de él entre {'{{#VARIABLE}}'} y {'{{/VARIABLE}}'}, dentro del mismo párrafo. Por ejemplo{' '}
              <code>{'{{NOMBRE}}{{#DNI}}, DNI {{DNI}}{{/DNI}}{{#DOMICILIO}}, con domicilio en {{DOMICILIO}}{{/DOMICILIO}}'}</code>. Sin el dato, ese texto no sale y el contrato se puede mandar a firmar igual.
            </p>
            <ul className="flex flex-col">
              {VARIABLES.map(([clave, texto]) => (
                <li key={clave} className="flex items-center justify-between gap-4 py-2.5" style={{ borderTop: '1px solid rgba(27,31,27,0.08)' }}>
                  <span className="flex flex-col min-w-0">
                    <code className="text-sm font-medium">{`{{${clave}}}`}</code>
                    <span className="text-xs text-piedra">{texto}</span>
                  </span>
                  <BotonCopiar texto={`{{${clave}}}`} descripcion={`Copiar {{${clave}}}`} />
                </li>
              ))}
            </ul>
          </details>
        </div>
      </div>
    </>
  );
};
