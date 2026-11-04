import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, List } from 'lucide-react';
import { supabase } from '../supabase';
import { Enlace } from '../ui';
import { llamarSobres } from '../firmas/api';
import { BotonCopiar } from './firma';
import { hoyISO, type ClienteCrm, type IntegranteEquipo } from './tipos';

/**
 * Onboardings de la empresa en el inicio. Por defecto, los del día ordenados
 * por hora; con la vista de calendario se ve el mes y se elige otro día.
 * El cliente lleva a su ficha del CRM y, al lado, se copia el enlace del
 * contrato: el de firma del cliente si está en firma, o el contrato firmado.
 */

type Fila = Pick<ClienteCrm, 'id' | 'nombre' | 'email' | 'servicio' | 'fecha_onboarding' | 'estado_firma' | 'link_contrato_servicio' | 'responsable' | 'responsable_id' | 'closer_id'>;

/** Día en la hora del navegador, igual que el campo de la ficha. */
const diaDe = (iso: string): string => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

function sumarDias(dia: string, n: number): string {
  const [y, m, d] = dia.split('-').map(Number);
  const x = new Date(y, m - 1, d + n);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

const inicioLocal = (dia: string): Date => {
  const [y, m, d] = dia.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });

function rotuloDia(dia: string, hoy: string): string {
  if (dia === hoy) return 'Hoy';
  if (dia === sumarDias(hoy, 1)) return 'Mañana';
  if (dia === sumarDias(hoy, -1)) return 'Ayer';
  const t = inicioLocal(dia).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const DIAS_SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const claseFlecha = 'w-9 h-9 inline-flex items-center justify-center border border-tinta/22 bg-white transition-colors duration-150 hover:border-tinta';

export const OnboardingsDia: React.FC<{ orgId: string }> = ({ orgId }) => {
  const hoy = hoyISO();
  const [dia, setDia] = useState(hoy);
  const [vista, setVista] = useState<'dia' | 'calendario'>('dia');
  const [mes, setMes] = useState(hoy.slice(0, 7));
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [equipo, setEquipo] = useState<IntegranteEquipo[]>([]);
  const [enlaces, setEnlaces] = useState<Record<string, string>>({});

  // Se trae el mes visible entero: alcanza para el día y para el calendario.
  const mesConsulta = vista === 'calendario' ? mes : dia.slice(0, 7);
  useEffect(() => {
    if (!supabase) return;
    let vivo = true;
    const desde = inicioLocal(`${mesConsulta}-01`);
    const hasta = new Date(desde.getFullYear(), desde.getMonth() + 1, 1);
    supabase
      .from('crm_clientes')
      .select('id, nombre, email, servicio, fecha_onboarding, estado_firma, link_contrato_servicio, responsable, responsable_id, closer_id')
      .eq('organizacion_id', orgId)
      .neq('estado_firma', 'Baja')
      .gte('fecha_onboarding', desde.toISOString())
      .lt('fecha_onboarding', hasta.toISOString())
      .order('fecha_onboarding')
      .then(({ data }) => vivo && setFilas((data ?? []) as Fila[]));
    return () => {
      vivo = false;
    };
  }, [orgId, mesConsulta]);

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from('equipo_miembros')
      .select('*')
      .eq('organizacion_id', orgId)
      .then(({ data }) => setEquipo((data ?? []) as IntegranteEquipo[]));
  }, [orgId]);

  const delDia = useMemo(() => (filas ?? []).filter((f) => f.fecha_onboarding && diaDe(f.fecha_onboarding) === dia), [filas, dia]);

  // Enlace de firma de cada cliente del día con el contrato en firma. No se guarda: lo calcula el servidor.
  const clavesDia = delDia.map((f) => f.id).join(',');
  useEffect(() => {
    if (!supabase || !delDia.length) return;
    let vivo = true;
    const sb = supabase;
    void (async () => {
      const { data: contratos } = await sb.from('crm_contratos_firma').select('cliente_id, sobre_id').in('cliente_id', delDia.map((f) => f.id)).not('sobre_id', 'is', null);
      const lista = (contratos ?? []) as { cliente_id: string; sobre_id: string }[];
      if (!lista.length) return;
      const { data: sobres } = await sb.from('firma_sobres').select('id, estado').in('id', lista.map((c) => c.sobre_id));
      const enCurso = new Set(((sobres ?? []) as { id: string; estado: string }[]).filter((s) => s.estado === 'en_curso').map((s) => s.id));
      const nuevos: Record<string, string> = {};
      await Promise.all(
        lista
          .filter((c) => enCurso.has(c.sobre_id))
          .map(async (c) => {
            const r = await llamarSobres<{ enlaces: { email: string; url: string }[] }>({ accion: 'enlaces', sobre_id: c.sobre_id });
            if (!r.ok) return;
            const mail = (delDia.find((f) => f.id === c.cliente_id)?.email ?? '').trim().toLowerCase();
            const propio = r.datos.enlaces.find((x) => x.email.toLowerCase() === mail);
            if (propio) nuevos[c.cliente_id] = propio.url;
          }),
      );
      if (vivo) setEnlaces((e) => ({ ...e, ...nuevos }));
    })();
    return () => {
      vivo = false;
    };
  }, [clavesDia]); // eslint-disable-line react-hooks/exhaustive-deps

  const nombreDe = (id: string | null | undefined) => (id ? equipo.find((m) => m.id === id)?.nombre ?? null : null);

  function irAlDia(d: string) {
    setDia(d);
    setVista('dia');
  }

  const cabeza = (
    <div className="p-tarjeta-cabeza">
      <h2>Onboardings</h2>
      {vista === 'dia' && delDia.length > 0 && (
        <span className="min-w-[22px] h-[22px] px-1.5 grid place-items-center rounded-pastilla bg-tinta text-marfil text-[12px] font-bold tabular-nums">{delDia.length}</span>
      )}
      <div className="ml-auto inline-flex border border-tinta/22" role="group" aria-label="Vista">
        {(
          [
            ['dia', 'Día', List],
            ['calendario', 'Calendario', CalendarDays],
          ] as const
        ).map(([clave, texto, Icono]) => (
          <button
            key={clave}
            type="button"
            aria-pressed={vista === clave}
            onClick={() => {
              if (clave === 'calendario') setMes(dia.slice(0, 7));
              setVista(clave);
            }}
            className={`inline-flex items-center gap-1.5 h-9 px-3 text-[13px] font-medium transition-colors duration-150 ${vista === clave ? 'bg-tinta text-marfil' : 'bg-white text-tinta hover:bg-marfil'}`}
          >
            <Icono size={14} aria-hidden="true" /> {texto}
          </button>
        ))}
      </div>
    </div>
  );

  if (vista === 'calendario') {
    const primero = inicioLocal(`${mes}-01`);
    const ultimo = new Date(primero.getFullYear(), primero.getMonth() + 1, 0).getDate();
    const corrimiento = (primero.getDay() + 6) % 7; // la semana arranca el lunes
    const porDia: Record<string, number> = {};
    for (const f of filas ?? []) if (f.fecha_onboarding) porDia[diaDe(f.fecha_onboarding)] = (porDia[diaDe(f.fecha_onboarding)] ?? 0) + 1;
    const moverMes = (n: number) => {
      const x = new Date(primero.getFullYear(), primero.getMonth() + n, 1);
      setMes(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`);
    };
    const tituloMes = primero.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
    return (
      <section className="p-tarjeta">
        {cabeza}
        <div className="px-5 desk:px-6 py-5 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <button type="button" className={claseFlecha} aria-label="Mes anterior" onClick={() => moverMes(-1)}>
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <span className="font-medium capitalize">{tituloMes}</span>
            <button type="button" className={claseFlecha} aria-label="Mes siguiente" onClick={() => moverMes(1)}>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {DIAS_SEMANA.map((d, i) => (
              <span key={i} className="text-[12px] text-piedra py-1" aria-hidden="true">
                {d}
              </span>
            ))}
            {Array.from({ length: corrimiento }, (_, i) => (
              <span key={`v${i}`} />
            ))}
            {Array.from({ length: ultimo }, (_, i) => {
              const d = `${mes}-${String(i + 1).padStart(2, '0')}`;
              const n = porDia[d] ?? 0;
              const esHoy = d === hoy;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => irAlDia(d)}
                  aria-label={`${rotuloDia(d, hoy)}: ${n === 0 ? 'sin onboardings' : n === 1 ? '1 onboarding' : `${n} onboardings`}`}
                  className={`relative h-11 flex flex-col items-center justify-center text-[14px] tabular-nums border transition-colors duration-150 hover:border-tinta ${
                    d === dia ? 'border-tinta' : 'border-transparent'
                  } ${n ? 'bg-bosque-suave text-bosque font-semibold' : ''} ${esHoy ? 'underline underline-offset-4' : ''}`}
                >
                  {i + 1}
                  {n > 0 && <span className="text-[10.5px] leading-none mt-0.5">{n}</span>}
                </button>
              );
            })}
          </div>
          <p className="text-[13px] text-piedra">Elegí un día para ver sus onboardings.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="p-tarjeta">
      {cabeza}
      <div className="px-5 desk:px-6 pt-4 flex items-center gap-2">
        <button type="button" className={claseFlecha} aria-label="Día anterior" onClick={() => setDia(sumarDias(dia, -1))}>
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <button type="button" className={claseFlecha} aria-label="Día siguiente" onClick={() => setDia(sumarDias(dia, 1))}>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
        <span className="font-medium ml-1">{rotuloDia(dia, hoy)}</span>
        {dia !== hoy && (
          <button type="button" className="ml-auto text-[13.5px] text-piedra underline underline-offset-4 hover:text-bosque" onClick={() => setDia(hoy)}>
            Volver a hoy
          </button>
        )}
      </div>
      {filas === null ? (
        <p className="px-5 desk:px-6 py-6 text-[14px] text-piedra">Cargando los onboardings…</p>
      ) : !delDia.length ? (
        <p className="px-5 desk:px-6 py-6 text-[14px] text-piedra">{dia === hoy ? 'No hay onboardings para hoy.' : 'No hay onboardings ese día.'}</p>
      ) : (
        <ul className="mt-2">
          {delDia.map((f) => {
            const responsable = nombreDe(f.responsable_id) ?? f.responsable;
            const closer = nombreDe(f.closer_id);
            const enlace = enlaces[f.id] ?? (f.estado_firma === 'Firmado' ? f.link_contrato_servicio : null);
            return (
              <li key={f.id} className="border-b border-separador last:border-b-0 px-5 desk:px-6 py-3.5 flex items-center gap-4">
                <span className="w-14 shrink-0 font-heading font-bold text-[16px] tabular-nums">{hora(f.fecha_onboarding!)}</span>
                <span className="flex flex-col min-w-0 flex-1">
                  <Enlace a={`/portal/crm/${f.id}`} className="font-medium text-[15px] truncate hover:text-bosque underline-offset-4 hover:underline">
                    {f.nombre}
                  </Enlace>
                  <span className="text-[13px] text-piedra truncate">
                    {[f.servicio, responsable && `CSM/AM ${responsable}`, closer && `Closer ${closer}`].filter(Boolean).join(' · ') || 'Sin responsable asignado'}
                  </span>
                </span>
                {enlace ? (
                  <BotonCopiar texto={enlace} descripcion={f.estado_firma === 'Firmado' ? `Copiar el contrato firmado de ${f.nombre}` : `Copiar el enlace de firma de ${f.nombre}`} />
                ) : (
                  <span
                    className="inline-flex items-center justify-center w-9 h-9 border border-tinta/10 text-piedra/50 shrink-0"
                    title={f.estado_firma === 'Firmado' ? 'El contrato firmado no tiene enlace cargado' : 'El contrato todavía no se mandó a firmar'}
                    aria-label={`Sin enlace de contrato para ${f.nombre}`}
                  >
                    —
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
