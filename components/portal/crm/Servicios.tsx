import React, { useEffect, useState } from 'react';
import { ArrowLeft, Plus, Upload } from 'lucide-react';
import { Button } from '../../Button';
import { supabase } from '../supabase';
import { Aviso, Campo, Encabezado, Enlace, Etiqueta, claseInput } from '../ui';
import { useVistaPrevia } from '../vistaPrevia';
import { dinero, type Servicio } from './tipos';

/**
 * Servicios que vende cada empresa. Los carga el titular (o FIRMA) y el
 * ticket es opcional, porque no todos tienen precio fijo y a veces hay
 * descuentos: en cada venta el monto se puede cambiar.
 * El modelo de contrato de cada servicio lo sube FIRMA. Con él se arman los
 * borradores que caen en Drive.
 *   /portal/crm/servicios
 */

const BUCKET_MODELOS = 'modelos';
const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

interface Fila extends Servicio {
  modelo_ruta?: string | null;
  modelo_nombre?: string | null;
  modelo_pif_ruta?: string | null;
  modelo_pif_nombre?: string | null;
}

interface Borrador {
  id?: string;
  clave: string;
  nombre: string;
  precio: string;
  activo: boolean;
  modelo?: File | null;
  modeloPif?: File | null;
  quitarPif?: boolean;
}

const VACIO: Borrador = { clave: '', nombre: '', precio: '', activo: true };

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

  async function cargar() {
    if (!supabase) return;
    const { data, error: e } = await supabase.from('crm_servicios').select('*').eq('organizacion_id', orgId).order('activo', { ascending: false }).order('nombre');
    if (e) setError(e.message);
    setLista((data as Fila[]) ?? []);
  }

  useEffect(() => {
    void cargar();
  }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function subirModelo(archivo: File, sufijo: string): Promise<string> {
    if (!supabase) throw new Error('Portal sin configurar.');
    if (archivo.type !== MIME_DOCX && !archivo.name.toLowerCase().endsWith('.docx')) throw new Error('El modelo tiene que ser un Word (.docx).');
    // La ruta empieza con la empresa: el servidor solo usa modelos de la misma empresa del cliente.
    const ruta = `${orgId}/${crypto.randomUUID()}-${sufijo}.docx`;
    const { error: e } = await supabase.storage.from(BUCKET_MODELOS).upload(ruta, archivo, { contentType: MIME_DOCX, upsert: false });
    if (e) throw new Error(`No se pudo subir el modelo. ${e.message}`);
    return ruta;
  }

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
    const original = lista.find((s) => s.id === borrador.id);
    const datos: Record<string, unknown> = { nombre, precio, activo: borrador.activo };
    const viejos: string[] = [];
    try {
      if (esAdmin && borrador.modelo) {
        datos.modelo_ruta = await subirModelo(borrador.modelo, 'modelo');
        datos.modelo_nombre = borrador.modelo.name;
        if (original?.modelo_ruta) viejos.push(original.modelo_ruta);
      }
      if (esAdmin && borrador.modeloPif) {
        datos.modelo_pif_ruta = await subirModelo(borrador.modeloPif, 'pif');
        datos.modelo_pif_nombre = borrador.modeloPif.name;
        if (original?.modelo_pif_ruta) viejos.push(original.modelo_pif_ruta);
      } else if (esAdmin && borrador.quitarPif && original?.modelo_pif_ruta) {
        datos.modelo_pif_ruta = null;
        datos.modelo_pif_nombre = null;
        viejos.push(original.modelo_pif_ruta);
      }
    } catch (err) {
      setGuardando(false);
      return setError(err instanceof Error ? err.message : 'No se pudo subir el modelo.');
    }

    // El código no se cambia después del alta, porque las ventas ya cargadas lo usan.
    const { error: err } = borrador.id
      ? await supabase.from('crm_servicios').update(datos).eq('id', borrador.id)
      : await supabase.from('crm_servicios').insert({ ...datos, organizacion_id: orgId, clave });
    setGuardando(false);
    if (err) return setError(/duplicate|unique/i.test(err.message) ? `Ya hay un servicio con el código ${clave}.` : err.message);
    if (viejos.length) await supabase.storage.from(BUCKET_MODELOS).remove(viejos);
    setOk(borrador.id ? 'Servicio actualizado.' : 'Servicio agregado. Ya aparece al cargar una venta.');
    setBorrador(null);
    void cargar();
  }

  const archivo = (etiqueta: string, actual: string | null | undefined, elegido: File | null | undefined, alElegir: (f: File) => void) => (
    <label className="flex flex-wrap items-center gap-3 cursor-pointer">
      <input
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="sr-only peer"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) alElegir(f);
        }}
      />
      <span className="inline-flex items-center gap-2 h-10 px-4 border border-tinta text-sm font-medium transition-colors duration-150 hover:bg-tinta hover:text-marfil peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-bosque">
        <Upload size={15} aria-hidden="true" /> {etiqueta}
      </span>
      <span className="text-sm break-all">{elegido?.name ?? actual ?? 'Sin modelo'}</span>
    </label>
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
            {esAdmin && (
              <fieldset className="space-y-4 pt-5" style={{ borderTop: '1px solid rgba(27,31,27,0.15)' }}>
                <legend className="eyebrow text-piedra pb-2">Solo FIRMA · Modelo de contrato</legend>
                <p className="text-xs text-piedra">Word con los datos a completar marcados, por ejemplo [NOMBRE Y APELLIDO]. Claude lo completa en cada venta y el borrador cae en Drive.</p>
                {archivo(borrador.modelo || lista.find((s) => s.id === borrador.id)?.modelo_ruta ? 'Cambiar modelo' : 'Elegir modelo', lista.find((s) => s.id === borrador.id)?.modelo_nombre, borrador.modelo, (f) => setBorrador({ ...borrador, modelo: f }))}
                <div className="space-y-2">
                  <p className="text-sm font-medium">Modelo para pago total (opcional)</p>
                  <p className="text-xs text-piedra">Solo si el contrato de pago total es distinto. Si no, Claude adapta el modelo general.</p>
                  {archivo('Elegir modelo de pago total', borrador.quitarPif ? null : lista.find((s) => s.id === borrador.id)?.modelo_pif_nombre, borrador.modeloPif, (f) => setBorrador({ ...borrador, modeloPif: f, quitarPif: false }))}
                  {!borrador.quitarPif && (borrador.modeloPif || lista.find((s) => s.id === borrador.id)?.modelo_pif_ruta) && (
                    <button type="button" className="text-sm underline underline-offset-4 hover:text-bosque" onClick={() => setBorrador({ ...borrador, modeloPif: null, quitarPif: true })}>
                      Quitar modelo de pago total
                    </button>
                  )}
                </div>
              </fieldset>
            )}
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
                  <td>{s.modelo_ruta ? <Etiqueta tono="bosque">{s.modelo_pif_ruta ? 'Cuotas y pago total' : 'Cargado'}</Etiqueta> : <Etiqueta tono="alerta">Falta</Etiqueta>}</td>
                  <td>{s.activo !== false ? <Etiqueta tono="bosque">Activo</Etiqueta> : <Etiqueta>Inactivo</Etiqueta>}</td>
                  <td className="text-right">
                    {!soloLectura && (
                      <button
                        type="button"
                        className="underline underline-offset-4 hover:text-bosque"
                        onClick={() => setBorrador({ id: s.id, clave: s.clave, nombre: s.nombre ?? '', precio: s.precio === null ? '' : String(s.precio), activo: s.activo !== false })}
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
      </div>
    </>
  );
};
