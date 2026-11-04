import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Ban, Copy, Download, Plus, Settings } from 'lucide-react';
import { Button } from '../../Button';
import { supabase } from '../supabase';
import { navegar } from '../navegacion';
import { useVistaPrevia } from '../vistaPrevia';
import { useLogoOrg } from '../logos';
import { Aviso, Campo, Encabezado, Enlace, Etiqueta, Pestanas, TituloSeccion, claseInput } from '../ui';
import { Editor } from '../../comprobantes/Editor';
import { MONEDAS, TITULO_TIPO, datosNuevos, faltantes, formatoMonto, leerDatos, numeroVisible, parteVacia, totales, type DatosComprobante, type Parte, type TipoComprobante } from '../../comprobantes/modelo';
import { descargar, generarPdf, logoParaPdf, nombreArchivo, type Logo } from '../../comprobantes/pdf';

const Visor = React.lazy(() => import('../../firma/Visor').then((m) => ({ default: m.Visor })));

/**
 * Invoices y recibos que el negocio emite a sus clientes (migración 0053).
 *   /portal/crm/comprobantes                                 lista, datos del emisor y numeración
 *   /portal/crm/comprobantes/nuevo?tipo=invoice&cliente=<id> emitir; desde=<id> copia otro
 *   /portal/crm/comprobantes/<id>                            ver, descargar y anular
 * La numeración la pone la base, correlativa por negocio y por tipo.
 */
export interface Comprobante {
  id: string;
  organizacion_id: string;
  tipo: TipoComprobante;
  numero: number;
  cliente_id: string | null;
  fecha: string;
  moneda: string;
  total: number;
  receptor: string;
  datos: unknown;
  anulado_en: string | null;
  motivo_anulacion: string | null;
  creado_en: string;
}

interface Emisor {
  nombre: string;
  id_fiscal: string;
  domicilio: string;
  email: string;
  telefono: string;
  pie: string;
}

interface ClienteBasico {
  id: string;
  codigo: string | null;
  nombre: string;
  tipo?: 'persona' | 'empresa' | null;
  id_fiscal?: string | null;
  dni: string | null;
  email: string | null;
  telefono: string | null;
  domicilio?: string | null;
  moneda: string;
}

const emisorVacio: Emisor = { nombre: '', id_fiscal: '', domicilio: '', email: '', telefono: '', pie: '' };

export const parteDeEmisor = (e: Emisor): Parte => ({ nombre: e.nombre, idFiscal: e.id_fiscal, domicilio: e.domicilio, email: e.email, telefono: e.telefono });

export const parteDeCliente = (c: ClienteBasico): Parte => ({
  nombre: c.nombre,
  idFiscal: (c.tipo === 'empresa' ? c.id_fiscal : c.dni) || '',
  domicilio: c.domicilio || '',
  email: c.email || '',
  telefono: c.telefono || '',
});

/** Datos del emisor guardados, o el nombre del negocio si todavía no los cargaron. */
function useEmisor(orgId: string): [Emisor | null, (e: Emisor) => void] {
  const [emisor, setEmisor] = useState<Emisor | null>(null);
  useEffect(() => {
    if (!supabase) return;
    let vigente = true;
    Promise.all([
      supabase.from('comprobantes_emisor').select('nombre, id_fiscal, domicilio, email, telefono, pie').eq('organizacion_id', orgId).maybeSingle(),
      supabase.from('organizaciones').select('nombre, razon_social').eq('id', orgId).maybeSingle(),
    ]).then(([e, o]) => {
      if (!vigente) return;
      const org = o.data as { nombre: string; razon_social: string | null } | null;
      setEmisor((e.data as Emisor | null) ?? { ...emisorVacio, nombre: org?.razon_social || org?.nombre || '' });
    });
    return () => {
      vigente = false;
    };
  }, [orgId]);
  return [emisor, setEmisor];
}

function useLogoPdf(orgId: string): Logo | null {
  const url = useLogoOrg(orgId);
  const [logo, setLogo] = useState<Logo | null>(null);
  useEffect(() => {
    let vigente = true;
    if (!url) return setLogo(null);
    logoParaPdf(url).then((l) => vigente && setLogo(l));
    return () => {
      vigente = false;
    };
  }, [url]);
  return logo;
}

export const Comprobantes: React.FC<{ orgId: string; orgNombre: string; ruta: string; puedeGestionar: boolean; selector?: React.ReactNode }> = ({ orgId, orgNombre, ruta, puedeGestionar, selector }) => {
  const sub = ruta.replace(/^\/portal\/crm\/comprobantes\/?/, '');
  if (sub === 'nuevo') return <Nuevo orgId={orgId} orgNombre={orgNombre} />;
  if (sub) return <Detalle id={sub} orgId={orgId} puedeGestionar={puedeGestionar} />;
  return <Lista orgId={orgId} orgNombre={orgNombre} puedeGestionar={puedeGestionar} selector={selector} />;
};

/* ------------------------------------------------------------------ */
/* Lista                                                               */
/* ------------------------------------------------------------------ */
const Lista: React.FC<{ orgId: string; orgNombre: string; puedeGestionar: boolean; selector?: React.ReactNode }> = ({ orgId, orgNombre, puedeGestionar, selector }) => {
  const soloLectura = Boolean(useVistaPrevia());
  const [tipo, setTipo] = useState<TipoComprobante>(() => (new URLSearchParams(window.location.search).get('tipo') === 'recibo' ? 'recibo' : 'invoice'));
  const [lista, setLista] = useState<Comprobante[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [ajustes, setAjustes] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let vigente = true;
    setLista(null);
    supabase
      .from('comprobantes')
      .select('id, organizacion_id, tipo, numero, cliente_id, fecha, moneda, total, receptor, anulado_en, motivo_anulacion, creado_en')
      .eq('organizacion_id', orgId)
      .order('numero', { ascending: false })
      .limit(1000)
      .then(({ data, error: e }) => {
        if (!vigente) return;
        setError(e ? 'No pudimos cargar los comprobantes.' : null);
        setLista(((data as Comprobante[] | null) ?? []).map((c) => ({ ...c, total: Number(c.total) })));
      });
    return () => {
      vigente = false;
    };
  }, [orgId]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (lista ?? []).filter((c) => c.tipo === tipo && (!q || c.receptor.toLowerCase().includes(q) || numeroVisible(c.numero).includes(q)));
  }, [lista, tipo, busqueda]);
  const cuenta = (t: TipoComprobante) => (lista ?? []).filter((c) => c.tipo === t).length;

  return (
    <>
      <Encabezado
        eyebrow={
          <Enlace a="/portal/crm" className="inline-flex items-center gap-1.5 hover:text-bosque">
            <ArrowLeft size={13} aria-hidden="true" /> {orgNombre || 'CRM'}
          </Enlace>
        }
        titulo="Invoices y recibos"
        bajada="Emitilos a tus clientes con numeración correlativa. Lo emitido no se edita: si hay un error, se anula y se emite otro."
        acciones={
          <>
            {selector}
            {puedeGestionar && (
              <Button variant="ghost" size="lg" onClick={() => setAjustes((a) => !a)} aria-expanded={ajustes} className="self-end">
                <Settings size={18} /> Emisor y numeración
              </Button>
            )}
            {!soloLectura && (
              <>
                <Button variant="ghost" size="lg" onClick={() => navegar('/portal/crm/comprobantes/nuevo?tipo=recibo')} className="self-end">
                  <Plus size={18} /> Nuevo recibo
                </Button>
                <Button size="lg" onClick={() => navegar('/portal/crm/comprobantes/nuevo?tipo=invoice')} className="self-end">
                  <Plus size={18} /> Nuevo invoice
                </Button>
              </>
            )}
          </>
        }
      />
      <div className="wrap py-10 desk:py-14 flex flex-col gap-8">
        {ajustes && puedeGestionar && <Ajustes orgId={orgId} soloLectura={soloLectura} />}
        {error && <Aviso tipo="error">{error}</Aviso>}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <Pestanas<TipoComprobante>
            items={[
              { clave: 'invoice', titulo: 'Invoices', cuenta: cuenta('invoice') },
              { clave: 'recibo', titulo: 'Recibos', cuenta: cuenta('recibo') },
            ]}
            activa={tipo}
            alCambiar={setTipo}
          />
          <input type="search" className={`${claseInput} max-w-[280px]`} placeholder="Buscar por cliente o número" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
        {lista === null ? (
          <p className="eyebrow text-piedra">Cargando</p>
        ) : visibles.length === 0 ? (
          <p className="text-sm text-piedra max-w-[64ch]">{busqueda ? 'Nada coincide con la búsqueda.' : tipo === 'invoice' ? 'Todavía no se emitió ningún invoice.' : 'Todavía no se emitió ningún recibo.'}</p>
        ) : (
          <ListaComprobantes items={visibles} />
        )}
      </div>
    </>
  );
};

export const ListaComprobantes: React.FC<{ items: Comprobante[] }> = ({ items }) => (
  <ul className="grid gap-2.5">
    {items.map((c) => (
      <li key={c.id}>
        <Enlace
          a={`/portal/crm/comprobantes/${c.id}`}
          className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 bg-white border border-tinta/15 px-4 py-3.5 transition-colors duration-150 hover:border-bosque"
        >
          <span className="font-mono text-[12.5px] font-medium text-bosque bg-bosque-suave px-2 py-0.5 tabular-nums">
            {c.tipo === 'invoice' ? 'INV' : 'REC'} {numeroVisible(c.numero)}
          </span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
            <span className="font-medium truncate">{c.receptor}</span>
            <span className="text-[13px] text-piedra">{new Date(`${c.fecha}T12:00:00`).toLocaleDateString('es-AR')}</span>
            {c.anulado_en && <Etiqueta tono="alerta">Anulado</Etiqueta>}
          </span>
          <span className={`flex items-center gap-2 tabular-nums font-medium ${c.anulado_en ? 'line-through text-piedra' : ''}`}>
            {formatoMonto(Number(c.total), c.moneda, 'es')} <ArrowRight size={14} aria-hidden="true" className="text-bosque" />
          </span>
        </Enlace>
      </li>
    ))}
  </ul>
);

/* ------------------------------------------------------------------ */
/* Emisor y numeración                                                 */
/* ------------------------------------------------------------------ */
const Ajustes: React.FC<{ orgId: string; soloLectura: boolean }> = ({ orgId, soloLectura }) => {
  const [emisor, setEmisor] = useEmisor(orgId);
  const [ultimos, setUltimos] = useState<Record<TipoComprobante, number>>({ invoice: 0, recibo: 0 });
  const [proximo, setProximo] = useState<Record<TipoComprobante, string>>({ invoice: '', recibo: '' });
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from('comprobantes_numeracion')
      .select('tipo, ultimo')
      .eq('organizacion_id', orgId)
      .then(({ data }) => {
        const u = { invoice: 0, recibo: 0 };
        for (const f of (data as { tipo: TipoComprobante; ultimo: number }[] | null) ?? []) u[f.tipo] = f.ultimo;
        setUltimos(u);
      });
  }, [orgId]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !emisor) return;
    setGuardando(true);
    setMensaje(null);
    const { error } = await supabase.from('comprobantes_emisor').upsert({ organizacion_id: orgId, ...emisor });
    let errorNumero: string | null = null;
    for (const t of ['invoice', 'recibo'] as const) {
      if (!proximo[t]) continue;
      const n = Number(proximo[t]);
      const r = await supabase.rpc('comprobantes_fijar_proximo', { org: orgId, p_tipo: t, proximo: n });
      if (r.error) errorNumero = `${TITULO_TIPO[t]}: el próximo número tiene que ser mayor que ${numeroVisible(ultimos[t])}.`;
      else setUltimos((u) => ({ ...u, [t]: n - 1 }));
    }
    setGuardando(false);
    setProximo({ invoice: '', recibo: '' });
    setMensaje(error ? { tipo: 'error', texto: 'No pudimos guardar los datos del emisor.' } : errorNumero ? { tipo: 'error', texto: errorNumero } : { tipo: 'ok', texto: 'Guardado. Se usa en los próximos comprobantes.' });
  }

  if (!emisor) return <p className="eyebrow text-piedra">Cargando</p>;
  const campo = (k: keyof Emisor, etiqueta: string, ayuda?: string) => (
    <Campo etiqueta={etiqueta} ayuda={ayuda}>
      <input className={claseInput} value={emisor[k]} onChange={(e) => setEmisor({ ...emisor, [k]: e.target.value })} />
    </Campo>
  );

  return (
    <form onSubmit={guardar} className="bg-papel border border-borde-suave rounded-control p-5 tab:p-6">
      <TituloSeccion eyebrow="Ajustes" titulo="Emisor y numeración" />
      <fieldset disabled={soloLectura || guardando} className="grid gap-4 tab:grid-cols-2 min-w-0">
        {campo('nombre', 'Nombre o razón social')}
        {campo('id_fiscal', 'ID fiscal', 'CUIT, EIN, NIF o el que corresponda.')}
        {campo('domicilio', 'Domicilio')}
        {campo('email', 'Email')}
        {campo('telefono', 'Teléfono')}
        <span className="hidden tab:block" />
        <div className="tab:col-span-2">
          <Campo etiqueta="Pie de los comprobantes" ayuda="Datos bancarios, condiciones o leyendas. Se puede cambiar en cada uno.">
            <textarea rows={3} className={`${claseInput} h-auto py-2.5`} value={emisor.pie} maxLength={1000} onChange={(e) => setEmisor({ ...emisor, pie: e.target.value })} />
          </Campo>
        </div>
        {(['invoice', 'recibo'] as const).map((t) => (
          <Campo key={t} etiqueta={`Próximo ${t === 'invoice' ? 'invoice' : 'recibo'}`} ayuda={`Va por el ${numeroVisible(ultimos[t] + 1)}. Si ya numerabas en otro lado, poné desde cuál seguir. Solo hacia adelante.`}>
            <input inputMode="numeric" className={claseInput} placeholder={numeroVisible(ultimos[t] + 1)} value={proximo[t]} onChange={(e) => setProximo({ ...proximo, [t]: e.target.value.replace(/\D/g, '').slice(0, 8) })} />
          </Campo>
        ))}
        <div className="tab:col-span-2 flex flex-wrap items-center gap-4">
          <Button type="submit">{guardando ? 'Guardando' : 'Guardar'}</Button>
          {mensaje && <span className={`text-sm ${mensaje.tipo === 'error' ? 'text-peligro' : 'text-piedra'}`}>{mensaje.texto}</span>}
        </div>
      </fieldset>
    </form>
  );
};

/* ------------------------------------------------------------------ */
/* Emitir                                                              */
/* ------------------------------------------------------------------ */
const Nuevo: React.FC<{ orgId: string; orgNombre: string }> = ({ orgId, orgNombre }) => {
  const q = new URLSearchParams(window.location.search);
  const tipo: TipoComprobante = q.get('tipo') === 'recibo' ? 'recibo' : 'invoice';
  const soloLectura = Boolean(useVistaPrevia());
  const [emisor] = useEmisor(orgId);
  const logo = useLogoPdf(orgId);
  const [clientes, setClientes] = useState<ClienteBasico[]>([]);
  const [clienteId, setClienteId] = useState<string>(q.get('cliente') ?? '');
  const [datos, setDatos] = useState<DatosComprobante>(() => datosNuevos(tipo));
  const [ultimo, setUltimo] = useState(0);
  const [emitiendo, setEmitiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let vigente = true;
    const desde = q.get('desde');
    Promise.all([
      supabase.from('crm_clientes_resumen').select('id, codigo, nombre, tipo, id_fiscal, dni, email, telefono, domicilio, moneda').eq('organizacion_id', orgId).order('nombre'),
      supabase.from('comprobantes_numeracion').select('ultimo').eq('organizacion_id', orgId).eq('tipo', tipo).maybeSingle(),
      desde ? supabase.from('comprobantes').select('datos, cliente_id').eq('id', desde).maybeSingle() : Promise.resolve({ data: null }),
    ]).then(([c, n, d]) => {
      if (!vigente) return;
      setClientes((c.data as ClienteBasico[] | null) ?? []);
      setUltimo((n.data as { ultimo: number } | null)?.ultimo ?? 0);
      const copia = d.data as { datos: unknown; cliente_id: string | null } | null;
      if (copia) {
        setDatos({ ...leerDatos(tipo, copia.datos), fecha: datosNuevos(tipo).fecha });
        setClienteId(copia.cliente_id ?? '');
      }
      setListo(true);
    });
    return () => {
      vigente = false;
    };
  }, [orgId, tipo]); // eslint-disable-line react-hooks/exhaustive-deps

  // El emisor sale siempre de los datos guardados del negocio.
  useEffect(() => {
    if (!emisor || !listo) return;
    setDatos((d) => ({ ...d, emisor: parteDeEmisor(emisor), pie: q.get('desde') ? d.pie : emisor.pie }));
  }, [emisor, listo]); // eslint-disable-line react-hooks/exhaustive-deps

  // Al elegir un cliente se completan sus datos y su moneda.
  useEffect(() => {
    if (!listo || q.get('desde')) return;
    const c = clientes.find((x) => x.id === clienteId);
    setDatos((d) => ({ ...d, receptor: c ? parteDeCliente(c) : parteVacia(), moneda: c && MONEDAS.includes(c.moneda) ? c.moneda : d.moneda }));
  }, [clienteId, clientes, listo]); // eslint-disable-line react-hooks/exhaustive-deps

  async function emitir() {
    if (!supabase || faltantes(datos).length) return;
    setEmitiendo(true);
    setError(null);
    const { data, error: e } = await supabase
      .from('comprobantes')
      .insert({
        organizacion_id: orgId,
        tipo,
        numero: 0,
        cliente_id: clienteId || null,
        fecha: datos.fecha,
        moneda: datos.moneda,
        total: totales(datos).total,
        receptor: datos.receptor.nombre.trim().slice(0, 200),
        datos,
      })
      .select('id, numero')
      .single();
    if (e || !data) {
      setEmitiendo(false);
      return setError('No pudimos emitirlo. Revisá los datos e intentá de nuevo.');
    }
    const numero = numeroVisible((data as { numero: number }).numero);
    try {
      descargar(await generarPdf(datos, { numero, logo }), nombreArchivo(datos, numero));
    } catch {
      /* Se puede descargar desde el detalle */
    }
    navegar(`/portal/crm/comprobantes/${(data as { id: string }).id}`);
  }

  return (
    <>
      <Encabezado
        eyebrow={
          <Enlace a={`/portal/crm/comprobantes?tipo=${tipo}`} className="inline-flex items-center gap-1.5 hover:text-bosque">
            <ArrowLeft size={13} aria-hidden="true" /> Invoices y recibos de {orgNombre}
          </Enlace>
        }
        titulo={tipo === 'invoice' ? 'Nuevo invoice' : 'Nuevo recibo'}
      />
      <div className="wrap py-10 desk:py-14 flex flex-col gap-6">
        {error && <Aviso tipo="error">{error}</Aviso>}
        {!listo || !emisor ? (
          <p className="eyebrow text-piedra">Cargando</p>
        ) : (
          <Editor
            datos={datos}
            alCambiar={setDatos}
            numero={numeroVisible(ultimo + 1)}
            ayudaNumero="Correlativo. Se confirma al emitir."
            emisorEditable={false}
            ayudaEmisor={
              <>
                Los datos del negocio. Los cambia el titular en <Enlace a="/portal/crm/comprobantes" className="underline underline-offset-2">Emisor y numeración</Enlace>.
              </>
            }
            antesReceptor={
              <Campo etiqueta="Cliente del CRM" ayuda="Completa sus datos. También podés escribirlos a mano para alguien que no está en el CRM.">
                <select className={claseInput} value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
                  <option value="">Sin vincular</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                      {c.codigo ? ` · ${c.codigo}` : ''}
                    </option>
                  ))}
                </select>
              </Campo>
            }
            logo={logo}
            acciones={
              <Button type="button" onClick={() => void emitir()} disabled={soloLectura || emitiendo || faltantes(datos).length > 0}>
                <Download size={17} /> {emitiendo ? 'Emitiendo' : `Emitir y descargar`}
              </Button>
            }
          />
        )}
      </div>
    </>
  );
};

/* ------------------------------------------------------------------ */
/* Detalle                                                             */
/* ------------------------------------------------------------------ */
const Detalle: React.FC<{ id: string; orgId: string; puedeGestionar: boolean }> = ({ id, orgId, puedeGestionar }) => {
  const soloLectura = Boolean(useVistaPrevia());
  const logo = useLogoPdf(orgId);
  const [c, setC] = useState<Comprobante | null | undefined>(undefined);
  const [url, setUrl] = useState<string | null>(null);
  const [anulando, setAnulando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    if (!supabase) return;
    const { data } = await supabase.from('comprobantes').select('*').eq('id', id).maybeSingle();
    setC((data as Comprobante | null) ?? null);
  }
  useEffect(() => {
    void cargar();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const datos = useMemo(() => (c ? leerDatos(c.tipo, c.datos) : null), [c]);
  const numero = c ? numeroVisible(c.numero) : '';

  useEffect(() => {
    if (!c || !datos) return;
    let vigente = true;
    let creada: string | null = null;
    generarPdf(datos, { numero, logo, anulado: Boolean(c.anulado_en) }).then((bytes) => {
      if (!vigente) return;
      creada = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
      setUrl(creada);
    });
    return () => {
      vigente = false;
      if (creada) URL.revokeObjectURL(creada);
    };
  }, [c, datos, numero, logo]);

  async function bajar() {
    if (!c || !datos) return;
    descargar(await generarPdf(datos, { numero, logo, anulado: Boolean(c.anulado_en) }), nombreArchivo(datos, numero));
  }

  async function anular(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !c || !anulando || anulando.trim().length < 3) return;
    const { error: err } = await supabase.from('comprobantes').update({ motivo_anulacion: anulando.trim() }).eq('id', c.id);
    if (err) return setError('No pudimos anularlo.');
    setAnulando(null);
    await cargar();
  }

  if (c === undefined) return <p className="wrap py-14 eyebrow text-piedra">Cargando</p>;
  if (c === null || !datos) {
    return <Encabezado eyebrow={<Enlace a="/portal/crm/comprobantes">Invoices y recibos</Enlace>} titulo="No encontramos el comprobante" bajada="Puede que sea de otro negocio o que no tengas acceso." />;
  }

  return (
    <>
      <Encabezado
        eyebrow={
          <Enlace a={`/portal/crm/comprobantes?tipo=${c.tipo}`} className="inline-flex items-center gap-1.5 hover:text-bosque">
            <ArrowLeft size={13} aria-hidden="true" /> Invoices y recibos
          </Enlace>
        }
        titulo={`${TITULO_TIPO[c.tipo]} ${numero}`}
        bajada={`${c.receptor} · ${formatoMonto(Number(c.total), c.moneda, 'es')} · ${new Date(`${c.fecha}T12:00:00`).toLocaleDateString('es-AR', { dateStyle: 'long' })}`}
        acciones={
          <>
            {c.anulado_en && <Etiqueta tono="alerta">Anulado</Etiqueta>}
            {!soloLectura && (
              <Button variant="ghost" size="lg" onClick={() => navegar(`/portal/crm/comprobantes/nuevo?tipo=${c.tipo}&desde=${c.id}`)}>
                <Copy size={17} /> Emitir uno igual
              </Button>
            )}
            <Button size="lg" onClick={() => void bajar()}>
              <Download size={17} /> Descargar PDF
            </Button>
          </>
        }
      />
      <div className="wrap py-10 desk:py-14 grid gap-10 desk:grid-cols-[minmax(0,1fr)_320px] items-start">
        <div className="border border-borde-suave rounded-control overflow-hidden min-w-0">
          {url && (
            <React.Suspense fallback={null}>
              <Visor url={url} titulo={`${TITULO_TIPO[c.tipo]} ${numero}`} />
            </React.Suspense>
          )}
        </div>
        <aside className="flex flex-col gap-6">
          {error && <Aviso tipo="error">{error}</Aviso>}
          {c.cliente_id && (
            <Enlace a={`/portal/crm/${c.cliente_id}`} className="inline-flex items-center gap-1.5 text-[14px] font-medium hover:text-bosque">
              Ver la ficha del cliente <ArrowRight size={14} aria-hidden="true" />
            </Enlace>
          )}
          {c.anulado_en ? (
            <Aviso tipo="error">
              Anulado el {new Date(c.anulado_en).toLocaleDateString('es-AR', { dateStyle: 'long' })}. Motivo: {c.motivo_anulacion}. El número {numero} queda usado.
            </Aviso>
          ) : (
            puedeGestionar &&
            !soloLectura &&
            (anulando === null ? (
              <Button variant="ghost" onClick={() => setAnulando('')}>
                <Ban size={16} /> Anular
              </Button>
            ) : (
              <form onSubmit={anular} className="flex flex-col gap-3 bg-papel border border-borde-suave rounded-control p-4">
                <Campo etiqueta="Motivo de la anulación" ayuda="Queda registrado. El número no se vuelve a usar.">
                  <input autoFocus required minLength={3} maxLength={500} className={claseInput} value={anulando} onChange={(e) => setAnulando(e.target.value)} />
                </Campo>
                <div className="flex gap-2">
                  <Button type="submit" variant="dark" size="sm">
                    Anular {numero}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setAnulando(null)}>
                    Cancelar
                  </Button>
                </div>
              </form>
            ))
          )}
        </aside>
      </div>
    </>
  );
};
