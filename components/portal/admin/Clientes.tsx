import React, { useEffect, useState } from 'react';
import { Plus, RotateCcw } from 'lucide-react';
import { Button } from '../../Button';
import { supabase } from '../supabase';
import { Aviso, Campo, Etiqueta, Interruptor, claseInput } from '../ui';
import { iniciarVistaPrevia } from '../vistaPrevia';
import { llamarApiAdmin, type RespuestaAdmin } from '../useSesion';
import { BotonCopiar } from '../crm/firma';
import { PAISES, ROLES_CLIENTE, ROTULO_ROL, type Organizacion, type RolCliente } from '../tipos';
import { TIPOS_LOGO, borrarArchivoLogo, fijarLogo, subirLogo } from '../logos';
import { INCLUYE_PLAN, ROTULO_PLAN, type Plan } from '../planes';

type Borrador = Pick<Organizacion, 'nombre' | 'razon_social' | 'pais' | 'activa' | 'notas'> & {
  id?: string;
  prefijo_crm?: string | null;
  seguimiento_cobranza?: boolean;
  logo_url?: string | null;
  drive_carpeta_revision?: string | null;
  plan?: Plan | null;
  /** Logo elegido y todavía sin subir. null quita el actual. */
  logoNuevo?: File | null;
};
const VACIO: Borrador = { nombre: '', razon_social: '', pais: 'AR', activa: true, notas: '', prefijo_crm: '', seguimiento_cobranza: false, logo_url: null };

export const Clientes: React.FC = () => {
  const [lista, setLista] = useState<Organizacion[]>([]);
  const [conteo, setConteo] = useState<Record<string, number>>({});
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [previa, setPrevia] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [borrando, setBorrando] = useState(false);
  const [reiniciando, setReiniciando] = useState(false);
  const [usuariosDemo, setUsuariosDemo] = useState<RespuestaAdmin['usuarios']>(undefined);

  // Vista previa local del logo elegido antes de guardar.
  useEffect(() => {
    if (!borrador?.logoNuevo) return setPrevia(null);
    const u = URL.createObjectURL(borrador.logoNuevo);
    setPrevia(u);
    return () => URL.revokeObjectURL(u);
  }, [borrador?.logoNuevo]);

  async function cargar() {
    if (!supabase) return;
    const [{ data: orgs, error: e1 }, { data: perfiles }] = await Promise.all([
      supabase.from('organizaciones').select('*').order('nombre'),
      supabase.from('perfiles').select('organizacion_id'),
    ]);
    if (e1) setError(e1.message);
    setLista((orgs as Organizacion[]) ?? []);
    const c: Record<string, number> = {};
    (perfiles ?? []).forEach((p: { organizacion_id: string | null }) => {
      if (p.organizacion_id) c[p.organizacion_id] = (c[p.organizacion_id] ?? 0) + 1;
    });
    setConteo(c);
  }

  useEffect(() => {
    void cargar();
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !borrador) return;
    setGuardando(true);
    setError(null);
    const datos = {
      nombre: borrador.nombre.trim(),
      razon_social: borrador.razon_social?.trim() || null,
      pais: borrador.pais,
      activa: borrador.activa,
      notas: borrador.notas?.trim() || null,
      prefijo_crm: borrador.prefijo_crm?.trim().toUpperCase() || null,
      seguimiento_cobranza: Boolean(borrador.seguimiento_cobranza),
      drive_carpeta_revision: borrador.drive_carpeta_revision?.trim() || null,
      // Solo si hay plan o ya tenía uno: así guarda aunque la migración 0022 no esté corrida.
      ...(borrador.plan || borrador.plan === null ? { plan: borrador.plan || null } : {}),
    };
    const { data: fila, error: err } = borrador.id
      ? await supabase.from('organizaciones').update(datos).eq('id', borrador.id).select('id').single()
      : await supabase.from('organizaciones').insert(datos).select('id').single();
    if (err || !fila) {
      setGuardando(false);
      return setError(err?.message ?? 'No se pudo guardar el cliente.');
    }

    // El logo se sube después, porque la ruta del archivo usa el id del cliente.
    if (borrador.logoNuevo !== undefined) {
      const anterior = borrador.logo_url ?? null;
      let logo_url: string | null = null;
      if (borrador.logoNuevo) {
        const r = await subirLogo(fila.id, borrador.logoNuevo, anterior);
        if (r.error) {
          setGuardando(false);
          void cargar();
          return setError(`El cliente se guardó, pero no se pudo subir el logo. ${r.error}`);
        }
        logo_url = r.url ?? null;
      } else {
        await borrarArchivoLogo(anterior);
      }
      const { error: errLogo } = await supabase.from('organizaciones').update({ logo_url }).eq('id', fila.id);
      if (errLogo) {
        setGuardando(false);
        return setError(errLogo.message);
      }
      fijarLogo(fila.id, logo_url);
    }
    setGuardando(false);
    setBorrador(null);
    void cargar();
  }

  /** Solo para empresas de prueba ya desactivadas. Se confirma escribiendo el nombre. */
  async function borrarEmpresa(o: Organizacion) {
    const escrito = window.prompt(
      `Vas a borrar ${o.nombre} con sus usuarios, CRM, casos, asuntos, documentos, abonos y pagos. No se puede deshacer.\n\nPara confirmar, escribí el nombre exacto de la empresa.`,
    );
    if (escrito === null) return;
    if (escrito.trim() !== o.nombre) return setError('El nombre no coincide. No se borró nada.');
    setBorrando(true);
    setError(null);
    const r = await llamarApiAdmin({ accion: 'borrar_empresa', organizacion_id: o.id, confirmacion: escrito.trim() });
    setBorrando(false);
    if (!r.ok) return setError(r.error ?? 'No se pudo borrar la empresa.');
    setBorrador(null);
    setOk(`${o.nombre} se borró del portal.`);
    void cargar();
  }

  /** Crea la empresa demo si falta y la deja con datos ficticios nuevos. */
  async function reiniciarDemo(existe: boolean) {
    if (existe && !window.confirm('¿Reiniciar la empresa demo? Se borran sus clientes, casos, asuntos y envíos a firma, y se cargan los datos ficticios de nuevo. Los usuarios quedan.')) return;
    setReiniciando(true);
    setError(null);
    setOk(null);
    const r = await llamarApiAdmin({ accion: 'demo' });
    setReiniciando(false);
    if (!r.ok) return setError(r.error ?? 'No se pudo preparar la demo.');
    setUsuariosDemo(r.usuarios);
    setOk(existe ? 'La demo quedó como nueva.' : 'Empresa demo creada, con sus usuarios y datos ficticios.');
    void cargar();
  }

  const guardada = borrador?.id ? lista.find((o) => o.id === borrador.id) : undefined;

  return (
    <div className="space-y-6">
      {error && <Aviso tipo="error">{error}</Aviso>}
      {ok && <Aviso tipo="ok">{ok}</Aviso>}

      {borrador ? (
        <form onSubmit={guardar} className="bg-marfil-oscuro p-6 desk:p-8 space-y-5 max-w-[680px]">
          <h2 className="h3">{borrador.id ? 'Editar cliente' : 'Nuevo cliente'}</h2>
          <Campo etiqueta="Nombre comercial">
            <input required className={claseInput} value={borrador.nombre} onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })} />
          </Campo>
          <Campo etiqueta="Razón social">
            <input className={claseInput} value={borrador.razon_social ?? ''} onChange={(e) => setBorrador({ ...borrador, razon_social: e.target.value })} />
          </Campo>
          <Campo etiqueta="Logo" ayuda="PNG, JPG, WEBP o SVG de hasta 2 MB, mejor con fondo transparente. Se ve en el portal de la empresa, en el CRM y en los casos.">
            <div className="flex flex-wrap items-center gap-4">
              {(previa || (borrador.logoNuevo === undefined && borrador.logo_url)) && (
                <div className="h-16 px-4 flex items-center bg-white border border-[rgba(27,31,27,0.15)]">
                  <img src={previa ?? borrador.logo_url ?? ''} alt={`Logo de ${borrador.nombre || 'el cliente'}`} className="max-h-11 max-w-[180px] object-contain" />
                </div>
              )}
              <label className="inline-flex items-center h-10 px-4 border border-tinta text-sm font-medium cursor-pointer hover:bg-tinta hover:text-marfil transition-colors duration-150">
                {previa || (borrador.logoNuevo === undefined && borrador.logo_url) ? 'Cambiar logo' : 'Elegir logo'}
                <input
                  type="file"
                  accept={TIPOS_LOGO.join(',')}
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) setBorrador({ ...borrador, logoNuevo: f });
                  }}
                />
              </label>
              {(previa || (borrador.logoNuevo === undefined && borrador.logo_url)) && (
                <button type="button" className="text-sm underline underline-offset-4 hover:text-bosque" onClick={() => setBorrador({ ...borrador, logoNuevo: borrador.logo_url ? null : undefined })}>
                  Quitar logo
                </button>
              )}
            </div>
          </Campo>
          <Campo etiqueta="Plan" ayuda={borrador.plan ? INCLUYE_PLAN[borrador.plan] : 'A medida: sin límites de agenda ni de firmas en el portal.'}>
            <select className={claseInput} value={borrador.plan ?? ''} onChange={(e) => setBorrador({ ...borrador, plan: (e.target.value || null) as Plan | null })}>
              <option value="">A medida</option>
              {(Object.keys(ROTULO_PLAN) as Plan[]).map((p) => (
                <option key={p} value={p}>
                  {ROTULO_PLAN[p]}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="País">
            <select className={claseInput} value={borrador.pais} onChange={(e) => setBorrador({ ...borrador, pais: e.target.value })}>
              {Object.entries(PAISES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Prefijo de códigos del CRM" ayuda="Por ejemplo TB para TB-001, TB-002.">
            <input className={`${claseInput} uppercase`} maxLength={6} value={borrador.prefijo_crm ?? ''} onChange={(e) => setBorrador({ ...borrador, prefijo_crm: e.target.value })} />
          </Campo>
          <Interruptor
            activo={Boolean(borrador.seguimiento_cobranza)}
            alCambiar={(v) => setBorrador({ ...borrador, seguimiento_cobranza: v })}
            etiqueta="Seguimiento de cobranza en el portal"
            ayuda="Apagado, el CRM solo guarda el plan pactado para el contrato. Encendido, el equipo marca las cuotas pagadas y ve las vencidas."
          />
          <Campo
            etiqueta="Carpeta de revisión en Drive"
            ayuda="Link de la carpeta donde caen los borradores de contrato. Compartila como Editor con la cuenta de servicio, o que sea de una unidad compartida a la que tenga acceso."
          >
            <input
              className={claseInput}
              placeholder="https://drive.google.com/drive/folders/..."
              value={borrador.drive_carpeta_revision ?? ''}
              onChange={(e) => setBorrador({ ...borrador, drive_carpeta_revision: e.target.value })}
            />
          </Campo>
          <Campo etiqueta="Notas internas" ayuda="Solo las ven los admin de FIRMA.">
            <textarea rows={3} className={`${claseInput} h-auto py-2`} value={borrador.notas ?? ''} onChange={(e) => setBorrador({ ...borrador, notas: e.target.value })} />
          </Campo>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={borrador.activa} onChange={(e) => setBorrador({ ...borrador, activa: e.target.checked })} />
            Cliente activo. Si lo desactivás, nadie de su equipo puede ver sus datos.
          </label>
          <div className="flex gap-3">
            <Button type="submit" disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setBorrador(null)}>
              Cancelar
            </Button>
          </div>
          {guardada && !guardada.activa && (
            <div className="pt-5 flex flex-col gap-3" style={{ borderTop: '1px solid rgba(27,31,27,0.15)' }}>
              <p className="text-sm text-piedra">
                Para empresas de prueba. Borra la empresa con sus usuarios, CRM, casos, asuntos, documentos, abonos y pagos. Si tiene envíos a firma electrónica no se puede borrar: esos registros son
                evidencia y la empresa queda desactivada.
              </p>
              <button
                type="button"
                className="self-start text-sm font-medium underline underline-offset-4 text-[#8a2b20] disabled:opacity-50"
                disabled={borrando}
                onClick={() => borrarEmpresa(guardada)}
              >
                {borrando ? 'Borrando…' : 'Borrar empresa de prueba'}
              </button>
            </div>
          )}
        </form>
      ) : (
        <Button onClick={() => setBorrador({ ...VACIO })}>
          <Plus size={16} /> Nuevo cliente
        </Button>
      )}

      {!borrador && <PanelDemo demo={lista.find((o) => o.demo)} reiniciando={reiniciando} usuarios={usuariosDemo} alReiniciar={reiniciarDemo} />}

      <div className="overflow-x-auto">
        <table className="tabla min-w-[760px]">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Plan</th>
              <th>País</th>
              <th>Usuarios</th>
              <th>Cobranza</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-piedra">
                  Todavía no cargaste clientes.
                </td>
              </tr>
            )}
            {lista.map((o) => (
              <tr key={o.id}>
                <td>
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-10 shrink-0 flex items-center justify-center bg-white border border-[rgba(27,31,27,0.1)]">
                      {o.logo_url ? <img src={o.logo_url} alt="" className="max-h-8 max-w-[48px] object-contain" /> : <span className="text-[10px] text-piedra">Sin logo</span>}
                    </div>
                    <div>
                      <div className="font-heading font-bold text-[16px] leading-tight">
                        {o.nombre} {o.demo && <Etiqueta tono="tinta">Demo</Etiqueta>}
                      </div>
                      {o.razon_social && <div className="text-xs text-piedra">{o.razon_social}</div>}
                    </div>
                  </div>
                </td>
                <td>{o.plan ? ROTULO_PLAN[o.plan] : <span className="text-piedra">A medida</span>}</td>
                <td>{PAISES[o.pais] ?? o.pais}</td>
                <td>{conteo[o.id] ?? 0}</td>
                <td>{o.seguimiento_cobranza ? <Etiqueta tono="bosque">Con seguimiento</Etiqueta> : <Etiqueta>Solo plan</Etiqueta>}</td>
                <td>{o.activa ? <Etiqueta tono="bosque">Activo</Etiqueta> : <Etiqueta tono="alerta">Inactivo</Etiqueta>}</td>
                <td className="text-right whitespace-nowrap">
                  <select
                    aria-label={`Ver el portal de ${o.nombre} como`}
                    className="h-9 px-2 mr-4 bg-white border border-[rgba(27,31,27,0.25)] text-sm"
                    value=""
                    onChange={(e) => e.target.value && iniciarVistaPrevia({ orgId: o.id, orgNombre: o.nombre, rol: e.target.value as RolCliente, areas: [] })}
                  >
                    <option value="">Ver como…</option>
                    {ROLES_CLIENTE.map((r) => (
                      <option key={r} value={r}>
                        {ROTULO_ROL[r]}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="underline underline-offset-4 hover:text-bosque" onClick={() => setBorrador({ ...o })}>
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/** Empresa ficticia para grabar videos de procesos, con un botón para dejarla como nueva. */
const PanelDemo: React.FC<{
  demo: Organizacion | undefined;
  reiniciando: boolean;
  usuarios: RespuestaAdmin['usuarios'];
  alReiniciar: (existe: boolean) => void;
}> = ({ demo, reiniciando, usuarios, alReiniciar }) => (
  <section className="bg-marfil-oscuro p-6 flex flex-col gap-4 max-w-[860px]">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex flex-col gap-1 max-w-[560px]">
        <h2 className="h3">Empresa demo</h2>
        <p className="text-sm text-piedra">
          Para grabar procesos con datos ficticios: clientes con cuotas, casos de conflicto y asuntos con chat. No manda mails de avisos. Reiniciarla borra lo que hayas hecho y vuelve a cargar los datos. Para firmar, mandá los envíos por enlace.
        </p>
      </div>
      <Button size="sm" variant={demo ? 'ghost' : 'primary'} disabled={reiniciando} onClick={() => alReiniciar(Boolean(demo))}>
        {demo ? <RotateCcw size={15} aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />}
        {reiniciando ? 'Preparando…' : demo ? 'Reiniciar demo' : 'Crear empresa demo'}
      </Button>
    </div>
    {usuarios && usuarios.length > 0 && (
      <ul className="flex flex-col gap-2 text-sm">
        {usuarios.map((u) => (
          <li key={u.email} className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-medium">{u.nombre}</span>
            <span className="text-piedra">{ROTULO_ROL[u.rol as RolCliente] ?? u.rol} · {u.email}</span>
            {u.enlace ? <BotonCopiar texto={u.enlace} descripcion={`Copiar el enlace para que ${u.nombre} defina su contraseña`} /> : <span className="text-xs text-piedra">Ya tenía cuenta</span>}
          </li>
        ))}
      </ul>
    )}
  </section>
);
