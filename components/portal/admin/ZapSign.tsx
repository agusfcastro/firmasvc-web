import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../../Button';
import { supabase } from '../supabase';
import { Aviso, Campo, Etiqueta, Interruptor, TituloSeccion, claseInput } from '../ui';
import { BotonCopiar } from '../crm/firma';
import type { Organizacion } from '../tipos';
import type { Servicio } from '../crm/tipos';

/**
 * Conexión de cada empresa con su organización de ZapSign, modelos de
 * contrato por servicio y variables para armar los DOCX.
 * El token se manda al servidor y no vuelve nunca al navegador.
 */

interface Modelo {
  token: string;
  nombre: string;
  activo: boolean;
}

interface Estado {
  conectado: boolean;
  sandbox: boolean;
  webhook: boolean;
}

/** Misma lista que arma api/crm/contrato.ts. */
const VARIABLES: [string, string][] = [
  ['NOMBRE', 'Nombre completo del cliente'],
  ['DNI', 'DNI o documento'],
  ['EMAIL', 'Mail'],
  ['TELEFONO', 'Teléfono'],
  ['DOMICILIO', 'Domicilio del cliente'],
  ['CODIGO', 'Código del CRM, por ejemplo AT-001'],
  ['SERVICIO', 'Nombre del servicio contratado'],
  ['EMPRESA', 'Razón social de la empresa, o su nombre'],
  ['RESPONSABLE', 'CSM o AM a cargo'],
  ['MONEDA', 'Moneda, por ejemplo USD'],
  ['MONTO_TOTAL', 'Monto total en números, por ejemplo 3.000'],
  ['MONTO_TOTAL_LETRAS', 'Monto total en letras, por ejemplo TRES MIL'],
  ['ANTICIPO', 'Anticipo en números'],
  ['ANTICIPO_LETRAS', 'Anticipo en letras'],
  ['SALDO', 'Suma de las cuotas en números'],
  ['SALDO_LETRAS', 'Suma de las cuotas en letras'],
  ['CANTIDAD_CUOTAS', 'Cantidad de cuotas, por ejemplo 3 (TRES)'],
  ['DETALLE_CUOTAS', 'Cada cuota con su monto y su vencimiento'],
  ['FECHA_ONBOARDING', 'Fecha del onboarding, por ejemplo 20 de octubre de 2026'],
  ['FECHA', 'Fecha en que se genera el contrato'],
];

async function llamar<T>(cuerpo: Record<string, unknown>): Promise<{ ok: boolean; datos?: T; error?: string }> {
  if (!supabase) return { ok: false, error: 'Portal sin configurar.' };
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, error: 'Tu sesión venció. Volvé a ingresar.' };
  try {
    const r = await fetch('/api/admin/zapsign', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(cuerpo),
    });
    const j = (await r.json().catch(() => ({}))) as T & { error?: string };
    if (!r.ok) return { ok: false, error: j.error || `Error ${r.status}` };
    return { ok: true, datos: j };
  } catch {
    return { ok: false, error: 'No hay conexión con el servidor.' };
  }
}

/** Opciones de modelo. Si el guardado ya no existe en ZapSign, se muestra igual para no perderlo. */
const OpcionesModelo: React.FC<{ modelos: Modelo[] | null; actual: string | null | undefined }> = ({ modelos, actual }) => (
  <>
    {(modelos ?? [])
      .filter((m) => m.activo || m.token === actual)
      .map((m) => (
        <option key={m.token} value={m.token}>
          {m.nombre}
          {m.activo ? '' : ' (inactivo)'}
        </option>
      ))}
    {actual && !(modelos ?? []).some((m) => m.token === actual) && <option value={actual}>Modelo {actual.slice(0, 8)}…</option>}
  </>
);

const FilaServicio: React.FC<{ servicio: Servicio; modelos: Modelo[] | null; alGuardar: () => void; alError: (e: string) => void }> = ({ servicio, modelos, alGuardar, alError }) => {
  const [b, setB] = useState({ clave: servicio.clave, nombre: servicio.nombre ?? '', precio: servicio.precio === null ? '' : String(servicio.precio), modelo: servicio.zapsign_modelo ?? '', activo: servicio.activo !== false });
  const [guardando, setGuardando] = useState(false);
  const cambio =
    b.clave !== servicio.clave ||
    b.nombre !== (servicio.nombre ?? '') ||
    b.precio !== (servicio.precio === null ? '' : String(servicio.precio)) ||
    b.modelo !== (servicio.zapsign_modelo ?? '') ||
    b.activo !== (servicio.activo !== false);

  async function guardar() {
    if (!supabase || !b.clave.trim()) return;
    setGuardando(true);
    const { error } = await supabase
      .from('crm_servicios')
      .update({ clave: b.clave.trim(), nombre: b.nombre.trim() || null, precio: b.precio === '' ? null : Number(b.precio), zapsign_modelo: b.modelo || null, activo: b.activo })
      .eq('id', servicio.id);
    setGuardando(false);
    if (error) return alError(error.message);
    alGuardar();
  }

  return (
    <tr>
      <td>
        <input aria-label="Clave del servicio" className={`${claseInput} h-10 uppercase`} value={b.clave} onChange={(e) => setB({ ...b, clave: e.target.value })} />
      </td>
      <td>
        <input aria-label="Nombre del servicio" className={`${claseInput} h-10`} value={b.nombre} onChange={(e) => setB({ ...b, nombre: e.target.value })} />
      </td>
      <td>
        <input aria-label="Precio del servicio" type="number" step="0.01" min="0" className={`${claseInput} h-10`} value={b.precio} onChange={(e) => setB({ ...b, precio: e.target.value })} />
      </td>
      <td>
        <select aria-label="Modelo de contrato del servicio" className={`${claseInput} h-10`} value={b.modelo} onChange={(e) => setB({ ...b, modelo: e.target.value })}>
          <option value="">Modelo por defecto</option>
          <OpcionesModelo modelos={modelos} actual={b.modelo} />
        </select>
      </td>
      <td className="text-center">
        <input type="checkbox" aria-label="Servicio activo" className="w-4 h-4 accent-[#173A2F] mt-3" checked={b.activo} onChange={(e) => setB({ ...b, activo: e.target.checked })} />
      </td>
      <td className="text-right whitespace-nowrap">
        <Button type="button" size="sm" variant={cambio ? 'primary' : 'ghost'} disabled={!cambio || guardando} onClick={guardar}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </Button>
      </td>
    </tr>
  );
};

export const ZapSign: React.FC = () => {
  const [orgs, setOrgs] = useState<Organizacion[]>([]);
  const [orgId, setOrgId] = useState('');
  const [estado, setEstado] = useState<Estado | null>(null);
  const [modelos, setModelos] = useState<Modelo[] | null>(null);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [token, setToken] = useState('');
  const [sandbox, setSandbox] = useState(false);
  const [cambiandoToken, setCambiandoToken] = useState(false);
  const [ocupado, setOcupado] = useState<'' | 'conectar' | 'desconectar' | 'modelo'>('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState<{ clave: string; nombre: string; precio: string; modelo: string } | null>(null);
  const org = orgs.find((o) => o.id === orgId) ?? null;

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from('organizaciones')
      .select('*')
      .order('nombre')
      .then(({ data }) => {
        const lista = (data as Organizacion[]) ?? [];
        setOrgs(lista);
        let previa: string | null = null;
        try {
          previa = window.localStorage.getItem('firma-crm-org');
        } catch {
          previa = null;
        }
        setOrgId(lista.some((o) => o.id === previa) ? (previa as string) : (lista[0]?.id ?? ''));
      });
  }, []);

  async function cargarServicios(id: string) {
    if (!supabase) return;
    const { data } = await supabase.from('crm_servicios').select('*').eq('organizacion_id', id).order('clave');
    setServicios((data as Servicio[]) ?? []);
  }

  async function cargarModelos(id: string) {
    const r = await llamar<{ modelos: Modelo[] }>({ accion: 'modelos', organizacion_id: id });
    if (r.ok) setModelos(r.datos?.modelos ?? []);
    else setError(r.error ?? 'No se pudieron traer los modelos.');
  }

  useEffect(() => {
    if (!orgId) return;
    setEstado(null);
    setModelos(null);
    setError(null);
    setOk(null);
    setToken('');
    setCambiandoToken(false);
    setNuevo(null);
    void cargarServicios(orgId);
    void llamar<Estado>({ accion: 'estado', organizacion_id: orgId }).then((r) => {
      if (!r.ok || !r.datos) return setError(r.error ?? 'No se pudo leer el estado de ZapSign.');
      setEstado(r.datos);
      setSandbox(r.datos.sandbox);
      if (r.datos.conectado) void cargarModelos(orgId);
    });
  }, [orgId]);

  async function conectar(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    setOcupado('conectar');
    setError(null);
    setOk(null);
    const r = await llamar<{ webhook: boolean; modelos: Modelo[] }>({ accion: 'conectar', organizacion_id: orgId, api_token: token.trim(), sandbox });
    setOcupado('');
    if (!r.ok || !r.datos) return setError(r.error ?? 'No se pudo conectar.');
    setToken('');
    setCambiandoToken(false);
    setEstado({ conectado: true, sandbox, webhook: r.datos.webhook });
    setModelos(r.datos.modelos);
    setOrgs(orgs.map((o) => (o.id === orgId ? { ...o, zapsign_conectado: true } : o)));
    setOk(r.datos.webhook ? 'ZapSign conectado. El aviso de firma quedó registrado.' : 'ZapSign conectado, pero no se pudo registrar el aviso de firma. Volvé a conectar para reintentarlo.');
  }

  async function desconectar() {
    if (!window.confirm(`¿Desconectar ZapSign de ${org?.nombre ?? 'esta empresa'}? Los clientes nuevos se van a crear sin contrato automático.`)) return;
    setOcupado('desconectar');
    setError(null);
    setOk(null);
    const r = await llamar({ accion: 'desconectar', organizacion_id: orgId });
    setOcupado('');
    if (!r.ok) return setError(r.error ?? 'No se pudo desconectar.');
    setEstado({ conectado: false, sandbox: false, webhook: false });
    setModelos(null);
    setOrgs(orgs.map((o) => (o.id === orgId ? { ...o, zapsign_conectado: false } : o)));
    setOk('ZapSign desconectado.');
  }

  async function guardarModeloPorDefecto(valor: string) {
    if (!supabase) return;
    setOcupado('modelo');
    setError(null);
    const { error: err } = await supabase.from('organizaciones').update({ zapsign_modelo: valor || null }).eq('id', orgId);
    setOcupado('');
    if (err) return setError(err.message);
    setOrgs(orgs.map((o) => (o.id === orgId ? { ...o, zapsign_modelo: valor || null } : o)));
    setOk('Modelo por defecto guardado.');
  }

  async function agregarServicio(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !nuevo || !nuevo.clave.trim()) return;
    setError(null);
    const { error: err } = await supabase.from('crm_servicios').insert({
      organizacion_id: orgId,
      clave: nuevo.clave.trim(),
      nombre: nuevo.nombre.trim() || null,
      precio: nuevo.precio === '' ? null : Number(nuevo.precio),
      zapsign_modelo: nuevo.modelo || null,
    });
    if (err) return setError(err.message);
    setNuevo(null);
    void cargarServicios(orgId);
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <label className="flex flex-col gap-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-piedra">Empresa</span>
          <select
            className="h-12 pl-3.5 pr-10 bg-white border border-tinta font-medium text-[15px] focus:outline-none focus:ring-1 focus:ring-bosque min-w-[260px]"
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
          >
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nombre}
                {o.zapsign_conectado ? ' · ZapSign conectado' : ''}
              </option>
            ))}
          </select>
        </label>
        <p className="text-sm text-piedra max-w-[56ch]">
          Cada empresa usa su organización de ZapSign. Al dar de alta un cliente, el portal genera el contrato con el modelo del servicio y guarda el link de firma. ZapSign no le manda mails al cliente, el link lo envía el equipo.
        </p>
      </div>

      {error && <Aviso tipo="error">{error}</Aviso>}
      {ok && <Aviso tipo="ok">{ok}</Aviso>}

      {!orgId ? (
        <p className="text-piedra">Primero cargá una empresa en Clientes.</p>
      ) : (
        <>
          {/* Conexión */}
          <section className="bg-marfil-oscuro p-6 desk:p-8 max-w-[760px] space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="h3">Conexión</h2>
              {estado === null ? (
                <span className="eyebrow text-[11px] text-piedra">Consultando</span>
              ) : estado.conectado ? (
                <>
                  <Etiqueta tono="bosque">Conectado</Etiqueta>
                  {estado.sandbox && <Etiqueta>Sandbox</Etiqueta>}
                  {estado.webhook ? <Etiqueta tono="bosque">Aviso de firma activo</Etiqueta> : <Etiqueta tono="alerta">Sin aviso de firma</Etiqueta>}
                </>
              ) : (
                <Etiqueta>No conectado</Etiqueta>
              )}
            </div>

            {estado && (!estado.conectado || cambiandoToken) ? (
              <form onSubmit={conectar} className="space-y-5">
                <Campo etiqueta="Token de la API de ZapSign" ayuda="En ZapSign entrá a la organización de este cliente, Configuración › Integración › Token de API. Se guarda en privado y no se vuelve a mostrar.">
                  <input
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    className={claseInput}
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Pegá el token de esta organización"
                  />
                </Campo>
                <Interruptor activo={sandbox} alCambiar={setSandbox} etiqueta="Ambiente de pruebas (sandbox)" ayuda="Solo si el token es de sandbox. Los documentos de prueba no tienen validez." />
                <div className="flex flex-wrap gap-3">
                  <Button type="submit" disabled={!token.trim() || ocupado !== ''}>
                    {ocupado === 'conectar' ? 'Conectando…' : 'Conectar'}
                  </Button>
                  {cambiandoToken && (
                    <Button type="button" variant="ghost" onClick={() => setCambiandoToken(false)}>
                      Cancelar
                    </Button>
                  )}
                </div>
              </form>
            ) : (
              estado?.conectado && (
                <div className="flex flex-wrap gap-3">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setCambiandoToken(true)}>
                    Cambiar token
                  </Button>
                  <Button type="button" variant="ghost" size="sm" disabled={ocupado !== ''} onClick={desconectar}>
                    {ocupado === 'desconectar' ? 'Desconectando…' : 'Desconectar'}
                  </Button>
                </div>
              )
            )}
          </section>

          {/* Modelos */}
          <section className="space-y-6">
            <TituloSeccion eyebrow="Contratos" titulo="Modelos por servicio" />
            {!estado?.conectado && <Aviso tipo="info">Conectá ZapSign para elegir los modelos. Los servicios se pueden cargar igual.</Aviso>}
            <div className="max-w-[520px]">
              <Campo etiqueta="Modelo por defecto de la empresa" ayuda="Se usa para los servicios que no tienen modelo propio.">
                <select className={claseInput} disabled={!estado?.conectado || ocupado !== ''} value={org?.zapsign_modelo ?? ''} onChange={(e) => guardarModeloPorDefecto(e.target.value)}>
                  <option value="">Sin modelo por defecto</option>
                  <OpcionesModelo modelos={modelos} actual={org?.zapsign_modelo} />
                </select>
              </Campo>
            </div>

            <div className="overflow-x-auto">
              <table className="tabla tabla-media min-w-[900px]">
                <thead>
                  <tr>
                    <th>Clave</th>
                    <th>Nombre</th>
                    <th>Precio (USD)</th>
                    <th>Modelo de contrato</th>
                    <th className="text-center">Activo</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {servicios.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-piedra">
                        Esta empresa todavía no tiene servicios.
                      </td>
                    </tr>
                  )}
                  {servicios.map((s) => (
                    <FilaServicio key={`${s.id}-${s.clave}-${s.zapsign_modelo ?? ''}-${s.precio ?? ''}-${s.nombre ?? ''}-${s.activo}`} servicio={s} modelos={modelos} alGuardar={() => cargarServicios(orgId)} alError={setError} />
                  ))}
                </tbody>
              </table>
            </div>

            {nuevo ? (
              <form onSubmit={agregarServicio} className="grid gap-4 tab:grid-cols-[120px_1fr_140px_1fr_auto_auto] items-end bg-marfil-oscuro p-5">
                <Campo etiqueta="Clave">
                  <input required className={`${claseInput} uppercase`} placeholder="3M" value={nuevo.clave} onChange={(e) => setNuevo({ ...nuevo, clave: e.target.value })} />
                </Campo>
                <Campo etiqueta="Nombre">
                  <input className={claseInput} placeholder="Programa 3 meses" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
                </Campo>
                <Campo etiqueta="Precio">
                  <input type="number" step="0.01" min="0" className={claseInput} value={nuevo.precio} onChange={(e) => setNuevo({ ...nuevo, precio: e.target.value })} />
                </Campo>
                <Campo etiqueta="Modelo">
                  <select className={claseInput} value={nuevo.modelo} onChange={(e) => setNuevo({ ...nuevo, modelo: e.target.value })}>
                    <option value="">Modelo por defecto</option>
                    <OpcionesModelo modelos={modelos} actual={nuevo.modelo} />
                  </select>
                </Campo>
                <Button type="submit">Agregar</Button>
                <Button type="button" variant="ghost" onClick={() => setNuevo(null)}>
                  Cancelar
                </Button>
              </form>
            ) : (
              <Button type="button" variant="ghost" size="sm" onClick={() => setNuevo({ clave: '', nombre: '', precio: '', modelo: '' })}>
                <Plus size={16} /> Agregar servicio
              </Button>
            )}
          </section>

          {/* Variables */}
          <section className="space-y-5">
            <TituloSeccion eyebrow="Para armar los DOCX" titulo="Variables de los modelos" />
            <p className="text-sm text-piedra max-w-[72ch]">
              Escribí cada variable en el modelo de ZapSign tal cual aparece acá, con las llaves dobles. El portal las completa con los datos del cliente y su plan de pagos.
            </p>
            <div className="grid gap-px bg-[rgba(27,31,27,0.12)] border border-[rgba(27,31,27,0.12)] tab:grid-cols-2">
              {VARIABLES.map(([clave, texto], i) => (
                <div key={clave} className={`bg-marfil p-4 flex items-center justify-between gap-4 ${i === VARIABLES.length - 1 && VARIABLES.length % 2 ? 'tab:col-span-2' : ''}`}>
                  <div className="min-w-0">
                    <code className="block font-mono text-[13px] font-medium text-bosque break-all">{`{{${clave}}}`}</code>
                    <span className="block text-xs text-piedra mt-1">{texto}</span>
                  </div>
                  <BotonCopiar texto={`{{${clave}}}`} descripcion={`Copiar la variable ${clave}`} />
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
};
