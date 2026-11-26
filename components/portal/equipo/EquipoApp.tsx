import React, { useCallback, useEffect, useState } from 'react';
import { FileSpreadsheet, Plus } from 'lucide-react';
import { Button } from '../../Button';
import { supabase } from '../supabase';
import { navegar } from '../navegacion';
import { Aviso, Encabezado, Marco, Pestanas, claseInput } from '../ui';
import { useVistaPrevia } from '../vistaPrevia';
import { mensajeAmable } from '../errores';
import type { Organizacion, Perfil } from '../tipos';
import type { IntegranteEquipo } from '../crm/tipos';
import { Victorias } from './Victorias';
import { Objetivos } from './Objetivos';
import { Reportes } from './Reportes';
import { armarExcel, descargar, logoFirma, nombreArchivo } from './excel';
import { hoy, lideraEquipo, mesDe, reporteSeguro, type Hito, type Objetivo, type Reporte, type Respuesta, type Victoria } from './tipos';

/**
 * Equipo. Objetivos, victorias y reportes de la gente de cada empresa
 * (migración 0076). Nada de esto usa la IA.
 *   /portal/equipo             victorias, el muro y lo que falta validar
 *   /portal/equipo/objetivos   objetivos con su avance e hitos por rol
 *   /portal/equipo/reportes    el reporte de cada uno y quién lo entregó
 * Lideran el equipo FIRMA, el titular y quien tiene el área Operaciones:
 * validan victorias, ponen objetivos, arman los reportes y bajan el Excel.
 */

type Pestana = 'victorias' | 'objetivos' | 'reportes';

/** Lo que comparten las tres pestañas. */
export interface BaseEquipo {
  orgId: string;
  equipo: IntegranteEquipo[];
  /** El lugar en el equipo de quien usa el portal, si tiene uno. */
  yo: IntegranteEquipo | null;
  lidera: boolean;
  esAdmin: boolean;
  soloLectura: boolean;
  objetivos: Objetivo[];
  hitos: Hito[];
  reportes: Reporte[];
  monedas: string[];
  recargar: () => Promise<void>;
}

const CLAVE_ORG = 'firma-crm-org';

export const EquipoApp: React.FC<{ perfil: Perfil; organizacion: Organizacion | null; ruta: string }> = ({ perfil, organizacion, ruta }) => {
  const esAdmin = perfil.rol === 'admin';
  const vista = useVistaPrevia();
  const soloLectura = Boolean(vista);
  const lidera = lideraEquipo(perfil);
  const pestana: Pestana = ruta.endsWith('/objetivos') ? 'objetivos' : ruta.endsWith('/reportes') ? 'reportes' : 'victorias';

  const [orgs, setOrgs] = useState<Organizacion[]>([]);
  const [orgId, setOrgId] = useState<string | null>(() => {
    if (!esAdmin) return organizacion?.id ?? null;
    try {
      return window.localStorage.getItem(CLAVE_ORG);
    } catch {
      return null;
    }
  });
  const [org, setOrg] = useState<Organizacion | null>(organizacion);
  const [equipo, setEquipo] = useState<IntegranteEquipo[]>([]);
  const [objetivos, setObjetivos] = useState<Objetivo[]>([]);
  const [hitos, setHitos] = useState<Hito[]>([]);
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cargado, setCargado] = useState(false);
  const [nueva, setNueva] = useState(false);
  const [excel, setExcel] = useState<{ mes: string; bajando: boolean } | null>(null);

  useEffect(() => {
    if (!esAdmin || !supabase) return;
    supabase
      .from('organizaciones')
      .select('*')
      .order('nombre')
      .then(({ data }) => {
        const lista = (data as Organizacion[]) ?? [];
        setOrgs(lista);
        if (!orgId || !lista.some((o) => o.id === orgId)) setOrgId(lista[0]?.id ?? null);
      });
  }, [esAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!esAdmin || !orgId) return;
    try {
      window.localStorage.setItem(CLAVE_ORG, orgId);
    } catch {
      /* sin almacenamiento */
    }
  }, [esAdmin, orgId]);

  const recargar = useCallback(async () => {
    if (!supabase || !orgId) return;
    const [o, e, ob, h, r] = await Promise.all([
      supabase.from('organizaciones').select('*').eq('id', orgId).maybeSingle(),
      supabase.from('equipo_miembros').select('*').eq('organizacion_id', orgId).order('activo', { ascending: false }).order('nombre'),
      supabase.from('equipo_objetivos').select('*').eq('organizacion_id', orgId).eq('activo', true).order('hasta', { ascending: false }),
      supabase.from('equipo_hitos').select('*').eq('organizacion_id', orgId).order('rol_comercial').order('orden').order('creado_en'),
      supabase.from('equipo_reportes').select('*').eq('organizacion_id', orgId).order('rol_comercial').order('creado_en'),
    ]);
    const fallo = [e, ob, h, r].find((x) => x.error)?.error;
    setError(fallo ? mensajeAmable(fallo) : null);
    if (o.data) setOrg(o.data as Organizacion);
    setEquipo((e.data as IntegranteEquipo[]) ?? []);
    setObjetivos((ob.data as Objetivo[]) ?? []);
    setHitos((h.data as Hito[]) ?? []);
    setReportes(((r.data as Reporte[]) ?? []).map(reporteSeguro));
    setCargado(true);
  }, [orgId]);

  useEffect(() => {
    setCargado(false);
    void recargar();
  }, [recargar]);

  const yo = esAdmin ? null : (equipo.find((m) => m.usuario_id === perfil.id && m.activo) ?? null);
  const monedas = org?.monedas?.length ? org.monedas : ['USD'];

  async function bajarExcel() {
    if (!supabase || !orgId || !excel) return;
    setExcel({ ...excel, bajando: true });
    setError(null);
    const { desde, hasta } = mesDe(`${excel.mes}-01`);
    // Los objetivos que tocan el mes. Los datos cubren todo su período, así cada fórmula da lo mismo que el portal.
    const { data: obs, error: eo } = await supabase
      .from('equipo_objetivos')
      .select('*')
      .eq('organizacion_id', orgId)
      .eq('activo', true)
      .lte('desde', hasta)
      .gte('hasta', desde)
      .order('desde');
    const lista = (obs as Objetivo[]) ?? [];
    const inicio = lista.reduce((m, o) => (o.desde < m ? o.desde : m), desde);
    const fin = lista.reduce((m, o) => (o.hasta > m ? o.hasta : m), hasta);
    const [v, r, logo] = await Promise.all([
      supabase.from('equipo_victorias').select('*').eq('organizacion_id', orgId).gte('fecha', inicio).lte('fecha', fin).order('fecha').limit(5000),
      supabase.from('equipo_reporte_respuestas').select('*').eq('organizacion_id', orgId).gte('periodo', inicio).lte('periodo', fin).order('periodo').limit(10000),
      logoFirma(),
    ]);
    const fallo = eo ?? v.error ?? r.error;
    if (fallo) {
      setExcel({ ...excel, bajando: false });
      return setError(mensajeAmable(fallo));
    }
    const bytes = armarExcel({
      empresa: org?.nombre ?? 'Empresa',
      desde,
      hasta,
      generado: new Date(),
      equipo,
      objetivos: lista,
      reportes,
      victorias: (v.data as Victoria[]) ?? [],
      respuestas: (r.data as Respuesta[]) ?? [],
      hitos,
      monedas,
      logo,
    });
    descargar(bytes, nombreArchivo(org?.nombre ?? 'Empresa', desde));
    setExcel(null);
  }

  const base: BaseEquipo | null = orgId ? { orgId, equipo, yo, lidera, esAdmin, soloLectura, objetivos, hitos, reportes, monedas, recargar } : null;
  const ir = (p: Pestana) => navegar(p === 'victorias' ? '/portal/equipo' : `/portal/equipo/${p}`);

  const selector =
    esAdmin && orgs.length > 1 ? (
      <label className="flex flex-col gap-2 max-w-[420px]">
        <span className="text-[12.5px] font-medium text-piedra">Cliente de FIRMA</span>
        <select className={claseInput} value={orgId ?? ''} onChange={(e) => setOrgId(e.target.value)}>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nombre}
            </option>
          ))}
        </select>
      </label>
    ) : null;

  return (
    <Marco perfil={perfil} orgId={orgId}>
      <Encabezado
        eyebrow="Equipo"
        titulo={
          <>
            Equipo de <span className="text-bosque">{org?.nombre ?? vista?.orgNombre ?? 'tu empresa'}</span>
          </>
        }
        bajada="Objetivos, victorias y reportes de la gente que trabaja con vos."
        acciones={
          orgId && !soloLectura ? (
            <>
              {lidera && (
                <Button variant="ghost" onClick={() => setExcel(excel ? null : { mes: hoy().slice(0, 7), bajando: false })}>
                  <FileSpreadsheet size={17} aria-hidden="true" /> Descargar en Excel
                </Button>
              )}
              {(lidera || yo) && (
                <Button
                  onClick={() => {
                    setNueva(true);
                    if (pestana !== 'victorias') ir('victorias');
                  }}
                >
                  <Plus size={18} aria-hidden="true" /> Cargar una victoria
                </Button>
              )}
            </>
          ) : null
        }
      />
      <div className="wrap py-8 desk:py-10 flex flex-col gap-8">
        {selector}
        {error && <Aviso tipo="error">{error}</Aviso>}
        {excel && (
          <div className="bg-marfil-oscuro p-5 flex flex-wrap items-end gap-4 max-w-[680px]">
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium">Mes</span>
              <input type="month" className={`${claseInput} w-[200px]`} value={excel.mes} max={hoy().slice(0, 7)} onChange={(e) => setExcel({ ...excel, mes: e.target.value })} />
            </label>
            <Button onClick={() => void bajarExcel()} disabled={excel.bajando || !excel.mes}>
              {excel.bajando ? 'Armando el Excel…' : 'Descargar'}
            </Button>
            <p className="text-[12.5px] text-piedra basis-full">Trae objetivos, victorias y reportes del mes, con la portada de FIRMA y fórmulas que se pueden revisar.</p>
          </div>
        )}
        {!esAdmin && cargado && !yo && !lidera && (
          <Aviso tipo="info">Todavía no estás en el equipo de la empresa. Pedile al titular que te sume y vas a poder cargar tus victorias y tus reportes.</Aviso>
        )}
        <Pestanas<Pestana>
          items={[
            { clave: 'victorias', titulo: 'Victorias' },
            { clave: 'objetivos', titulo: 'Objetivos' },
            { clave: 'reportes', titulo: 'Reportes' },
          ]}
          activa={pestana}
          alCambiar={ir}
        />
        {!base || !cargado ? (
          <p className="text-piedra text-sm" role="status">
            Cargando…
          </p>
        ) : pestana === 'objetivos' ? (
          <Objetivos base={base} />
        ) : pestana === 'reportes' ? (
          <Reportes base={base} />
        ) : (
          <Victorias base={base} nueva={nueva} cerrarNueva={() => setNueva(false)} />
        )}
      </div>
    </Marco>
  );
};

export default EquipoApp;
