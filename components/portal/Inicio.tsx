import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  ChevronRight,
  CircleCheck,
  FilePlus2,
  FileSignature,
  FileText,
  Kanban,
  MessageSquare,
  PenLine,
  ShieldCheck,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '../Button';
import { supabase } from './supabase';
import { navegar } from './navegacion';
import { Encabezado, Enlace, Marco } from './ui';
import type { EstadoSesion } from './useSesion';
import { cargoDe, permisosDe, type Permisos } from './tipos';
import { COLUMNAS_FIRMANTE, type Firmante, type Sobre } from './firmas/api';
import type { Asunto, Novedad } from './asuntos';
import type { Abono } from './abonos';
import { ROTULO_PLAN, duracion, firmasOcupadas, usoAgenda, usoFirmas, type Plan, type UsoAgenda, type UsoFirmas } from './planes';

/* ------------------------------------------------------------------ */
/* Fechas                                                              */
/* ------------------------------------------------------------------ */
const DIA = 86_400_000;
const diasHasta = (iso: string): number => Math.ceil((Date.parse(iso) - Date.now()) / DIA);
const fechaLarga = (iso: string): string => new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', timeZone: 'America/Argentina/Buenos_Aires' });

function hace(iso: string): string {
  const min = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (min < 60) return min <= 1 ? 'recién' : `hace ${min} minutos`;
  const horas = Math.round(min / 60);
  if (horas < 24) return horas === 1 ? 'hace 1 hora' : `hace ${horas} horas`;
  const dias = Math.round(horas / 24);
  if (dias === 1) return 'ayer';
  if (dias < 7) return new Date(iso).toLocaleDateString('es-AR', { weekday: 'long', timeZone: 'America/Argentina/Buenos_Aires' });
  return fechaLarga(iso);
}

function venceEn(iso: string): string {
  const d = diasHasta(iso);
  if (d < 0) return 'Vencido';
  if (d === 0) return 'Vence hoy';
  if (d === 1) return 'Vence mañana';
  return `Vence en ${d} días`;
}

function saludo(): string {
  const h = Number(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Argentina/Buenos_Aires' }));
  return h < 13 ? 'Buen día' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/* ------------------------------------------------------------------ */
/* Datos del inicio                                                     */
/* ------------------------------------------------------------------ */
type Tono = 'aviso' | 'bosque' | 'neutro';

interface Pendiente {
  clave: string;
  tono: Tono;
  icono: LucideIcon;
  titulo: string;
  detalle: string;
  chip: string;
  accion: string;
  a: string;
  /** Menor es más urgente. */
  orden: number;
}

interface Evento {
  clave: string;
  quien: string;
  texto: string;
  objeto: string;
  a: string;
  cuando: string;
}

interface Resumen {
  asuntos: Asunto[];
  sobres: (Sobre & { firmantes: Firmante[] })[];
  documentos: { id: string; titulo: string; actualizado_en: string; es_protocolo?: boolean }[];
  novedades: (Novedad & { asunto?: Asunto })[];
  pedidos: { id: string; titulo: string | null; actualizado_en: string }[];
  abono: Abono | null;
  firmas: UsoFirmas | null;
  agenda: UsoAgenda | null;
  crmPendientes: number | null;
}

const VACIO: Resumen = { asuntos: [], sobres: [], documentos: [], novedades: [], pedidos: [], abono: null, firmas: null, agenda: null, crmPendientes: null };

async function cargarResumen(orgId: string, p: Permisos): Promise<Resumen> {
  const sb = supabase!;
  const hace30 = new Date(Date.now() - 30 * DIA).toISOString();
  const [asuntos, sobres, documentos, novedades, pedidos, abonos, firmas, agenda, crm] = await Promise.all([
    p.casos
      ? sb.from('asuntos').select('id, codigo, titulo, tipo, estado, proximo_paso, vence_en, actualizado_en').eq('organizacion_id', orgId).neq('estado', 'finalizado').order('vence_en', { ascending: true, nullsFirst: false })
      : null,
    p.documentosLegales
      ? sb.from('firma_sobres').select('id, codigo, titulo, estado, vence_en, creado_en, completado_en').eq('organizacion_id', orgId).in('estado', ['en_curso', 'completado']).order('creado_en', { ascending: false }).limit(40)
      : null,
    p.documentosLegales ? sb.from('documentos').select('id, titulo, actualizado_en, es_protocolo').eq('activo', true) : null,
    p.casos
      ? sb.from('asunto_novedades').select('id, asunto_id, texto, tipo, interna, creado_en').eq('organizacion_id', orgId).eq('interna', false).gte('creado_en', hace30).order('creado_en', { ascending: false }).limit(8)
      : null,
    p.casos ? sb.from('pedidos_contrato').select('id, titulo, actualizado_en').eq('organizacion_id', orgId).is('enviado_en', null).order('actualizado_en', { ascending: false }).limit(3) : null,
    p.gestion ? sb.from('abonos').select('*').eq('organizacion_id', orgId).in('estado', ['activo', 'pendiente', 'pausado', 'con_error']).order('creado_en', { ascending: false }).limit(1) : null,
    p.documentosLegales ? usoFirmas(orgId) : null,
    p.agenda ? usoAgenda(orgId) : null,
    p.crm && !p.casos ? sb.from('crm_clientes').select('id', { count: 'exact', head: true }).eq('organizacion_id', orgId).eq('estado_firma', 'Pendiente') : null,
  ]);

  const listaSobres = ((sobres?.data ?? []) as Sobre[]).filter((s) => s.estado === 'en_curso' || (s.completado_en && s.completado_en >= hace30));
  const enCurso = listaSobres.filter((s) => s.estado === 'en_curso');
  const { data: f } = enCurso.length ? await sb.from('firma_firmantes').select(COLUMNAS_FIRMANTE).in('sobre_id', enCurso.map((s) => s.id)) : { data: [] };
  const firmantes = (f ?? []) as unknown as Firmante[];
  const listaAsuntos = (asuntos?.data ?? []) as Asunto[];

  return {
    asuntos: listaAsuntos,
    sobres: listaSobres.map((s) => ({ ...s, firmantes: firmantes.filter((x) => x.sobre_id === s.id) })),
    documentos: (documentos?.data ?? []) as Resumen['documentos'],
    novedades: ((novedades?.data ?? []) as Novedad[]).map((n) => ({ ...n, asunto: listaAsuntos.find((a) => a.id === n.asunto_id) })),
    pedidos: (pedidos?.data ?? []) as Resumen['pedidos'],
    abono: ((abonos?.data ?? [])[0] as Abono | undefined) ?? null,
    firmas: firmas ?? null,
    agenda: agenda ?? null,
    crmPendientes: crm ? crm.count ?? 0 : null,
  };
}

/** Lo que la persona tiene que resolver, del más urgente al menos. */
function pendientesDe(r: Resumen, email: string): Pendiente[] {
  const lista: Pendiente[] = [];
  const yo = email.trim().toLowerCase();

  for (const s of r.sobres.filter((x) => x.estado === 'en_curso')) {
    const firmaron = s.firmantes.filter((x) => x.estado === 'firmado').length;
    const meFalta = s.firmantes.some((x) => x.email.toLowerCase() === yo && x.estado !== 'firmado' && x.estado !== 'rechazado');
    const dias = diasHasta(s.vence_en);
    if (meFalta) {
      lista.push({ clave: `yo-${s.id}`, tono: 'aviso', icono: PenLine, titulo: s.titulo, detalle: 'Te falta firmar. El enlace personal te llegó por mail.', chip: venceEn(s.vence_en), accion: 'Ver envío', a: `/portal/firmas/${s.id}`, orden: 0 });
    } else if (dias <= 3) {
      lista.push({ clave: `sb-${s.id}`, tono: 'aviso', icono: FileSignature, titulo: s.titulo, detalle: `Firma electrónica · ${firmaron} de ${s.firmantes.length} firmaron`, chip: venceEn(s.vence_en), accion: 'Ver envío', a: `/portal/firmas/${s.id}`, orden: 2 + dias / 10 });
    }
  }

  for (const a of r.asuntos) {
    const codigo = a.codigo ? `Asunto ${a.codigo}` : 'Asunto';
    if (a.estado === 'espera_cliente') {
      lista.push({ clave: `as-${a.id}`, tono: 'bosque', icono: MessageSquare, titulo: a.titulo, detalle: a.proximo_paso ? `${codigo} · ${a.proximo_paso}` : `${codigo} · FIRMA espera tu respuesta`, chip: 'Espera tu respuesta', accion: 'Responder', a: `/portal/asuntos/${a.id}`, orden: 1 });
    } else if (a.vence_en && diasHasta(a.vence_en) <= 7) {
      lista.push({ clave: `av-${a.id}`, tono: 'neutro', icono: BriefcaseBusiness, titulo: a.titulo, detalle: a.proximo_paso ? `${codigo} · ${a.proximo_paso}` : codigo, chip: venceEn(a.vence_en), accion: 'Ver', a: `/portal/asuntos/${a.id}`, orden: 3 });
    }
  }

  for (const p of r.pedidos) {
    lista.push({ clave: `pc-${p.id}`, tono: 'neutro', icono: FilePlus2, titulo: p.titulo || 'Pedido de contrato', detalle: `Borrador guardado el ${fechaLarga(p.actualizado_en)}`, chip: 'Sin enviar', accion: 'Seguir', a: `/portal/pedidos/closer/${p.id}`, orden: 4 });
  }

  if (r.abono && (r.abono.estado === 'pendiente' || r.abono.estado === 'con_error')) {
    const error = r.abono.estado === 'con_error';
    lista.push({ clave: 'abono', tono: 'aviso', icono: Wallet, titulo: r.abono.concepto, detalle: error ? 'No se pudo cobrar con tu tarjeta.' : 'Falta activar el débito automático.', chip: error ? 'Revisar medio de pago' : 'Pendiente', accion: 'Ver pagos', a: '/portal/pagos', orden: error ? 0.5 : 5 });
  }

  if (r.crmPendientes) {
    lista.push({ clave: 'crm', tono: 'neutro', icono: Kanban, titulo: plural(r.crmPendientes, 'cliente con la firma pendiente', 'clientes con la firma pendiente'), detalle: 'CRM legal · contratos que todavía no firmaron', chip: 'Seguimiento', accion: 'Ver clientes', a: '/portal/crm', orden: 6 });
  }

  return lista.sort((x, y) => x.orden - y.orden).slice(0, 6);
}

function actividadDe(r: Resumen): Evento[] {
  const ev: Evento[] = [];
  for (const n of r.novedades) {
    if (!n.asunto) continue;
    ev.push({ clave: `n-${n.id}`, quien: 'FIRMA', texto: n.tipo === 'documento' ? 'subió un documento en' : n.tipo === 'estado' ? 'actualizó el estado de' : 'dejó una novedad en', objeto: n.asunto.titulo, a: `/portal/asuntos/${n.asunto_id}`, cuando: n.creado_en });
  }
  for (const s of r.sobres) {
    if (s.estado === 'completado' && s.completado_en) ev.push({ clave: `s-${s.id}`, quien: 'Firmaron todos', texto: 'el envío', objeto: s.titulo, a: `/portal/firmas/${s.id}`, cuando: s.completado_en });
  }
  const hace14 = new Date(Date.now() - 14 * DIA).toISOString();
  for (const d of r.documentos) {
    if (d.actualizado_en >= hace14) ev.push({ clave: `d-${d.id}`, quien: 'FIRMA', texto: d.es_protocolo ? 'actualizó el protocolo' : 'actualizó', objeto: d.titulo, a: d.es_protocolo ? '/portal/protocolos' : '/portal/documentos', cuando: d.actualizado_en });
  }
  return ev.sort((x, y) => (x.cuando < y.cuando ? 1 : -1)).slice(0, 5);
}

/* ------------------------------------------------------------------ */
/* Piezas                                                              */
/* ------------------------------------------------------------------ */
const TONO_FICHA: Record<Tono, string> = {
  aviso: 'bg-aviso-suave text-aviso',
  bosque: 'bg-bosque-suave text-bosque',
  neutro: 'bg-marfil text-piedra border border-separador',
};
const TONO_CHIP: Record<Tono, string> = {
  aviso: 'bg-aviso-suave text-aviso',
  bosque: 'bg-bosque-suave text-bosque',
  neutro: 'bg-separador text-piedra',
};

interface Dato {
  titulo: string;
  icono: LucideIcon;
  valor: React.ReactNode;
  nota?: React.ReactNode;
  tono?: 'aviso' | 'bosque';
  barra?: number;
  a?: string;
}

const Datos: React.FC<{ items: Dato[]; cargando: boolean }> = ({ items, cargando }) => (
  <div className={`grid grid-cols-2 ${items.length >= 4 ? 'wide:grid-cols-4' : items.length === 3 ? 'wide:grid-cols-3' : ''} p-tarjeta`}>
    {items.map((d, i) => {
      const Icono = d.icono;
      const cuerpo = (
        <>
          <span className="flex items-center gap-2 text-[13px] text-piedra">
            <Icono size={16} strokeWidth={1.75} aria-hidden="true" />
            {d.titulo}
          </span>
          <span className="font-heading font-bold text-[30px] leading-none tracking-[-0.01em] mt-3 mb-2 tabular-nums">{cargando ? '·' : d.valor}</span>
          {d.barra !== undefined ? (
            <span aria-hidden="true" className="block h-1 bg-separador mt-1">
              <span className="block h-full bg-bosque" style={{ width: `${Math.min(100, Math.max(0, d.barra))}%` }} />
            </span>
          ) : (
            <span className={`text-[13px] ${d.tono === 'aviso' ? 'text-aviso' : d.tono === 'bosque' ? 'text-bosque' : 'text-piedra'}`}>{cargando ? '' : d.nota}</span>
          )}
        </>
      );
      const borde = `${i % 2 ? 'border-l' : ''} ${i >= 2 ? 'border-t wide:border-t-0' : ''} ${items.length >= 3 && i > 0 ? 'wide:border-l' : ''} border-separador`;
      return d.a ? (
        <Enlace key={d.titulo} a={d.a} className={`flex flex-col p-4 desk:px-6 desk:py-5 transition-colors duration-150 hover:bg-marfil/60 ${borde}`}>
          {cuerpo}
        </Enlace>
      ) : (
        <div key={d.titulo} className={`flex flex-col p-4 desk:px-6 desk:py-5 ${borde}`}>
          {cuerpo}
        </div>
      );
    })}
  </div>
);

const Tarjeta: React.FC<{ titulo: string; cuenta?: number; enlace?: { a: string; texto: string }; children: React.ReactNode; className?: string }> = ({ titulo, cuenta, enlace, children, className = '' }) => (
  <section className={`p-tarjeta ${className}`}>
    <div className="p-tarjeta-cabeza">
      <h2>{titulo}</h2>
      {cuenta !== undefined && cuenta > 0 && <span className="min-w-[22px] h-[22px] px-1.5 grid place-items-center rounded-pastilla bg-bosque-suave text-bosque text-[12px] font-semibold tabular-nums">{cuenta}</span>}
      {enlace && (
        <Enlace a={enlace.a} className="ml-auto inline-flex items-center gap-1 min-h-[40px] text-[13.5px] text-piedra hover:text-bosque">
          {enlace.texto} <ChevronRight size={15} aria-hidden="true" />
        </Enlace>
      )}
    </div>
    {children}
  </section>
);

const ListaPendientes: React.FC<{ items: Pendiente[]; cargando: boolean; vacio: string }> = ({ items, cargando, vacio }) => {
  if (cargando) return <p className="px-5 desk:px-6 py-6 text-[14px] text-piedra">Cargando lo pendiente…</p>;
  if (!items.length)
    return (
      <div className="px-5 desk:px-6 py-8 flex items-center gap-4">
        <span className="w-10 h-10 grid place-items-center bg-bosque-suave text-bosque shrink-0">
          <CircleCheck size={20} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <div>
          <p className="font-medium">Estás al día</p>
          <p className="text-[14px] text-piedra">{vacio}</p>
        </div>
      </div>
    );
  return (
    <ul>
      {items.map((p) => {
        const Icono = p.icono;
        return (
          <li key={p.clave} className="border-b border-separador last:border-b-0">
            <Enlace a={p.a} className="group flex flex-wrap tab:flex-nowrap items-center gap-x-4 gap-y-2 px-4 desk:px-6 py-4 transition-colors duration-150 hover:bg-marfil/60">
              <span className={`w-10 h-10 grid place-items-center shrink-0 ${TONO_FICHA[p.tono]}`}>
                <Icono size={19} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <span className="flex flex-col min-w-0 flex-1 basis-[calc(100%-56px)] tab:basis-auto">
                <span className="font-medium text-[15px] leading-snug">{p.titulo}</span>
                <span className="text-[13px] text-piedra leading-snug mt-0.5 line-clamp-2">{p.detalle}</span>
              </span>
              <span className={`ml-14 tab:ml-0 shrink-0 px-2.5 py-[3px] rounded-pastilla text-[12px] font-medium whitespace-nowrap ${TONO_CHIP[p.tono]}`}>{p.chip}</span>
              <span className="hidden tab:inline-flex items-center gap-1.5 shrink-0 h-9 px-3.5 border border-borde-suave bg-papel text-[13.5px] font-medium group-hover:border-tinta">
                {p.accion}
              </span>
            </Enlace>
          </li>
        );
      })}
    </ul>
  );
};

const Actividad: React.FC<{ eventos: Evento[] }> = ({ eventos }) => (
  <ol className="px-5 desk:px-6 py-3">
    {eventos.map((e, i) => (
      <li key={e.clave} className="relative grid grid-cols-[18px_minmax(0,1fr)_auto] gap-3 py-3">
        {i < eventos.length - 1 && <span aria-hidden="true" className="absolute left-[8px] top-[26px] -bottom-1 w-px bg-borde-suave" />}
        <span aria-hidden="true" className="relative z-[1] mt-[6px] w-[9px] h-[9px] ml-[4px] border-2 border-bosque bg-papel" />
        <p className="text-[14px] leading-snug">
          <span className="font-medium">{e.quien}</span> {e.texto}{' '}
          <Enlace a={e.a} className="text-bosque font-medium hover:underline underline-offset-2">
            {e.objeto}
          </Enlace>
        </p>
        <span className="text-[12.5px] text-piedra whitespace-nowrap pt-0.5">{hace(e.cuando)}</span>
      </li>
    ))}
  </ol>
);

const BarraPlan: React.FC<{ titulo: string; usado: number; incluido: number | null; formato?: (n: number) => string }> = ({ titulo, usado, incluido, formato = String }) => (
  <div className="flex flex-col gap-2">
    <div className="flex items-baseline justify-between gap-4 text-[14px]">
      <span>{titulo}</span>
      <span className="text-piedra tabular-nums">{incluido === null ? `${formato(usado)}, sin límite` : `${formato(usado)} de ${formato(incluido)}`}</span>
    </div>
    {incluido !== null && (
      <div role="progressbar" aria-label={titulo} aria-valuemin={0} aria-valuemax={incluido} aria-valuenow={Math.min(usado, incluido)} className="h-1 bg-separador">
        <div className={`h-full ${usado >= incluido ? 'bg-tinta' : 'bg-bosque'}`} style={{ width: `${incluido > 0 ? Math.min(100, (usado / incluido) * 100) : 100}%` }} />
      </div>
    )}
  </div>
);

const ModulosRapidos: React.FC<{ items: { a: string; titulo: string; texto: string; icono: LucideIcon }[] }> = ({ items }) => (
  <ul>
    {items.map((m) => {
      const Icono = m.icono;
      return (
        <li key={m.a} className="border-b border-separador last:border-b-0">
          <Enlace a={m.a} className="flex items-center gap-4 px-5 desk:px-6 py-4 transition-colors duration-150 hover:bg-marfil/60">
            <span className="w-10 h-10 grid place-items-center bg-bosque-suave text-bosque shrink-0">
              <Icono size={19} strokeWidth={1.75} aria-hidden="true" />
            </span>
            <span className="flex flex-col min-w-0 flex-1">
              <span className="font-medium text-[15px]">{m.titulo}</span>
              <span className="text-[13px] text-piedra leading-snug">{m.texto}</span>
            </span>
            <ArrowRight size={16} className="text-piedra shrink-0" aria-hidden="true" />
          </Enlace>
        </li>
      );
    })}
  </ul>
);

/* ------------------------------------------------------------------ */
/* Inicio del cliente                                                   */
/* ------------------------------------------------------------------ */
const InicioCliente: React.FC<{ estado: EstadoSesion }> = ({ estado }) => {
  const { perfil, organizacion } = estado;
  const [r, setR] = useState<Resumen>(VACIO);
  const [cargando, setCargando] = useState(true);
  const orgId = organizacion?.id ?? null;
  const permisos = permisosDe(perfil!.rol);

  useEffect(() => {
    if (!supabase || !orgId) return;
    let vivo = true;
    setCargando(true);
    void cargarResumen(orgId, permisos)
      .then((x) => vivo && setR(x))
      .catch(() => vivo && setR(VACIO))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, [orgId, perfil!.rol]); // eslint-disable-line react-hooks/exhaustive-deps

  const nombre = (perfil!.nombre || '').split(' ')[0];
  const pendientes = pendientesDe(r, perfil!.email);
  const eventos = actividadDe(r);
  const firmasEnCurso = r.sobres.filter((s) => s.estado === 'en_curso');
  const porVencer = firmasEnCurso.filter((s) => diasHasta(s.vence_en) <= 3).length;
  const esperan = r.asuntos.filter((a) => a.estado === 'espera_cliente').length;
  const hace7 = new Date(Date.now() - 7 * DIA).toISOString();
  const nuevos = r.documentos.filter((d) => d.actualizado_en >= hace7).length;
  const plan = (organizacion?.plan ?? null) as Plan | null;

  const datos: Dato[] = [];
  if (permisos.documentosLegales)
    datos.push({ titulo: 'Firmas en curso', icono: FileSignature, valor: firmasEnCurso.length, nota: porVencer ? plural(porVencer, 'vence en 3 días o menos', 'vencen en 3 días o menos') : 'Ninguna por vencer', tono: porVencer ? 'aviso' : undefined, a: '/portal/firmas' });
  if (permisos.casos) datos.push({ titulo: 'Asuntos abiertos', icono: BriefcaseBusiness, valor: r.asuntos.length, nota: esperan ? plural(esperan, 'espera tu respuesta', 'esperan tu respuesta') : 'Ninguno espera tu respuesta', tono: esperan ? 'bosque' : undefined, a: '/portal/asuntos' });
  if (permisos.documentosLegales) datos.push({ titulo: 'Documentos', icono: FileText, valor: r.documentos.length, nota: nuevos ? plural(nuevos, 'actualizado esta semana', 'actualizados esta semana') : 'Sin cambios esta semana', tono: nuevos ? 'bosque' : undefined, a: '/portal/documentos' });
  if (r.firmas && permisos.documentosLegales) {
    const ocupadas = firmasOcupadas(r.firmas);
    datos.push(
      r.firmas.limite === null
        ? { titulo: 'Firmas del mes', icono: CircleCheck, valor: ocupadas, nota: 'Sin límite en tu plan' }
        : {
            titulo: 'Firmas del mes',
            icono: CircleCheck,
            valor: (
              <>
                {ocupadas}
                <span className="font-sans font-medium text-[14px] text-piedra tracking-normal ml-1">de {r.firmas.limite}</span>
              </>
            ),
            barra: (ocupadas / Math.max(1, r.firmas.limite)) * 100,
          },
    );
  }

  const resumen = cargando
    ? 'Juntando lo de tu empresa…'
    : pendientes.length
      ? `Tenés ${plural(pendientes.length, 'cosa para resolver', 'cosas para resolver')}.`
      : 'No tenés nada pendiente por ahora.';

  const rapidos = [
    ...(permisos.casos ? [{ a: '/portal/documentos/equipo', titulo: 'Pedir un contrato', texto: 'Para un closer o alguien nuevo de tu equipo.', icono: FilePlus2 }] : []),
    ...(permisos.crm ? [{ a: '/portal/crm', titulo: 'CRM legal', texto: 'Tus clientes, su contrato y el plan de cuotas.', icono: Kanban }] : []),
    { a: '/portal/protocolos', titulo: 'Protocolos', texto: 'Cómo trabaja cada área, por escrito y con respaldo legal.', icono: BookOpen },
  ];

  return (
    <Marco perfil={perfil}>
      <Encabezado
        tutorial="inicio"
        grande
        eyebrow={`${organizacion?.nombre ?? ''} · ${cargoDe(perfil!)}`}
        titulo={
          <>
            {saludo()}
            {nombre ? ', ' : ' '}
            <span className="text-bosque whitespace-nowrap">{nombre || 'bienvenido'}</span>
          </>
        }
        bajada={resumen}
        acciones={
          permisos.documentosLegales ? (
            <Button onClick={() => navegar('/portal/firmas/nuevo')}>
              <PenLine size={16} aria-hidden="true" /> Enviar a firmar
            </Button>
          ) : undefined
        }
      />

      <div className="wrap pt-6 pb-10 flex flex-col gap-6">
        {datos.length > 0 && <Datos items={datos} cargando={cargando} />}

        <div className="grid grid-cols-1 wide:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
          <div className="flex flex-col gap-6 min-w-0">
            {(permisos.casos || permisos.documentosLegales || permisos.crm) && (
              <Tarjeta titulo="Para hoy" cuenta={pendientes.length}>
                <ListaPendientes items={pendientes} cargando={cargando} vacio="Cuando algo necesite tu respuesta o esté por vencer, aparece acá." />
              </Tarjeta>
            )}
            {eventos.length > 0 && (
              <Tarjeta titulo="Actividad reciente" enlace={perfil!.rol === 'titular' ? { a: '/portal/bitacora', texto: 'Ver bitácora' } : undefined}>
                <Actividad eventos={eventos} />
              </Tarjeta>
            )}
            {!permisos.casos && !permisos.documentosLegales && (
              <Tarjeta titulo="Tu espacio">
                <ModulosRapidos items={rapidos} />
              </Tarjeta>
            )}
          </div>

          <div className="flex flex-col gap-6">
            {permisos.gestion && (plan || r.abono) && (
              <Tarjeta titulo="Tu plan" enlace={{ a: '/portal/pagos', texto: 'Ver pagos' }}>
                <div className="px-5 desk:px-6 py-5 flex flex-col gap-4">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="font-heading font-bold text-[22px]">{plan ? ROTULO_PLAN[plan] : r.abono?.concepto ?? 'A medida'}</span>
                    {r.abono && (
                      <span className="text-[13px] text-piedra tabular-nums">
                        {r.abono.moneda} {Math.round(Number(r.abono.monto)).toLocaleString('es-AR')} {r.abono.periodo_meses === 1 ? 'por mes' : `cada ${r.abono.periodo_meses} meses`}
                      </span>
                    )}
                  </div>
                  {r.abono?.proximo_cobro && r.abono.estado === 'activo' && (
                    <p className="-mt-2 text-[13.5px] text-piedra">
                      Próximo débito <span className="text-tinta font-medium">{fechaLarga(r.abono.proximo_cobro)}</span>
                    </p>
                  )}
                  {r.firmas && <BarraPlan titulo="Firmas electrónicas" usado={firmasOcupadas(r.firmas)} incluido={r.firmas.limite} />}
                  {r.agenda && <BarraPlan titulo="Reuniones" usado={r.agenda.usado_min} incluido={r.agenda.incluido_min} formato={duracion} />}
                </div>
              </Tarjeta>
            )}
            {permisos.agenda && (
              <Tarjeta titulo="Agenda">
                <div className="px-5 desk:px-6 py-5 flex flex-col gap-4">
                  <p className="text-[14px] text-piedra leading-relaxed">Reuniones de consulta y seguimiento con Agustín Castro. Elegís el tipo de reunión y el horario.</p>
                  {r.agenda && !permisos.gestion && <BarraPlan titulo="Tiempo usado" usado={r.agenda.usado_min} incluido={r.agenda.incluido_min} formato={duracion} />}
                  <Button variant="ghost" onClick={() => navegar('/portal/agenda')} className="self-start">
                    <CalendarDays size={16} aria-hidden="true" /> Agendar reunión
                  </Button>
                </div>
              </Tarjeta>
            )}
            {(permisos.casos || permisos.documentosLegales) && (
              <Tarjeta titulo="Accesos">
                <ModulosRapidos items={rapidos} />
              </Tarjeta>
            )}
          </div>
        </div>
      </div>
    </Marco>
  );
};

/* ------------------------------------------------------------------ */
/* Inicio de FIRMA                                                      */
/* ------------------------------------------------------------------ */
interface ResumenFirma {
  orgs: { id: string; nombre: string; activa: boolean; demo?: boolean }[];
  asuntos: Asunto[];
  sobres: Sobre[];
  abonos: Abono[];
  pedidos: { id: string; organizacion_id: string; titulo: string | null; asunto_id: string | null; enviado_en: string }[];
}

const InicioFirma: React.FC<{ estado: EstadoSesion }> = ({ estado }) => {
  const { perfil } = estado;
  const [r, setR] = useState<ResumenFirma>({ orgs: [], asuntos: [], sobres: [], abonos: [], pedidos: [] });
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!supabase) return;
    let vivo = true;
    const sb = supabase;
    const hace7 = new Date(Date.now() - 7 * DIA).toISOString();
    void Promise.all([
      sb.from('organizaciones').select('id, nombre, activa, demo').order('nombre'),
      sb.from('asuntos').select('id, organizacion_id, codigo, titulo, estado, proximo_paso, vence_en, actualizado_en').eq('estado', 'en_curso').order('vence_en', { ascending: true, nullsFirst: false }),
      sb.from('firma_sobres').select('id, organizacion_id, titulo, estado, vence_en, error_sellado, creado_en').eq('estado', 'en_curso'),
      sb.from('abonos').select('id, organizacion_id, concepto, estado, monto, moneda, periodo_meses, proximo_cobro').in('estado', ['activo', 'con_error', 'pendiente']),
      sb.from('pedidos_contrato').select('id, organizacion_id, titulo, asunto_id, enviado_en').gte('enviado_en', hace7).order('enviado_en', { ascending: false }),
    ]).then(([o, a, s, ab, pc]) => {
      if (!vivo) return;
      setR({ orgs: (o.data ?? []) as ResumenFirma['orgs'], asuntos: (a.data ?? []) as Asunto[], sobres: (s.data ?? []) as Sobre[], abonos: (ab.data ?? []) as Abono[], pedidos: (pc.data ?? []) as ResumenFirma['pedidos'] });
      setCargando(false);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const nombreOrg = (id: string | null) => r.orgs.find((o) => o.id === id)?.nombre ?? 'Sin empresa';
  const clientes = r.orgs.filter((o) => o.activa && !o.demo).length;
  const conError = r.abonos.filter((a) => a.estado === 'con_error');
  const venceSemana = r.asuntos.filter((a) => a.vence_en && diasHasta(a.vence_en) <= 7);

  const pendientes: Pendiente[] = [
    ...conError.map((a) => ({ clave: `ab-${a.id}`, tono: 'aviso' as Tono, icono: Wallet, titulo: `${nombreOrg(a.organizacion_id)} · ${a.concepto}`, detalle: 'dLocal Go no pudo cobrar el abono.', chip: 'Problema de cobro', accion: 'Ver abonos', a: '/portal/admin/abonos', orden: 0 })),
    ...r.sobres.filter((s) => s.error_sellado).map((s) => ({ clave: `se-${s.id}`, tono: 'aviso' as Tono, icono: FileSignature, titulo: s.titulo, detalle: `${nombreOrg(s.organizacion_id)} · no se pudo sellar el PDF`, chip: 'Error de sellado', accion: 'Ver envío', a: `/portal/firmas/${s.id}`, orden: 0.5 })),
    ...r.pedidos.map((p) => ({ clave: `pc-${p.id}`, tono: 'bosque' as Tono, icono: FilePlus2, titulo: p.titulo || 'Pedido de contrato', detalle: `${nombreOrg(p.organizacion_id)} · enviado ${hace(p.enviado_en)}`, chip: 'Pedido nuevo', accion: 'Ver', a: p.asunto_id ? `/portal/asuntos/${p.asunto_id}` : '/portal/asuntos', orden: 1 })),
    ...venceSemana.map((a) => ({ clave: `as-${a.id}`, tono: (diasHasta(a.vence_en!) <= 2 ? 'aviso' : 'neutro') as Tono, icono: BriefcaseBusiness, titulo: a.titulo, detalle: `${nombreOrg(a.organizacion_id)}${a.proximo_paso ? ` · ${a.proximo_paso}` : ''}`, chip: venceEn(a.vence_en!), accion: 'Ver', a: `/portal/asuntos/${a.id}`, orden: 2 + diasHasta(a.vence_en!) / 10 })),
  ]
    .sort((x, y) => x.orden - y.orden)
    .slice(0, 8);

  const datos: Dato[] = [
    { titulo: 'Clientes activos', icono: Users, valor: clientes, nota: plural(r.orgs.length, 'empresa en total', 'empresas en total'), a: '/portal/admin/clientes' },
    { titulo: 'Asuntos en curso', icono: BriefcaseBusiness, valor: r.asuntos.length, nota: venceSemana.length ? plural(venceSemana.length, 'vence esta semana', 'vencen esta semana') : 'Ninguno vence esta semana', tono: venceSemana.length ? 'aviso' : undefined, a: '/portal/asuntos' },
    { titulo: 'Firmas en curso', icono: FileSignature, valor: r.sobres.length, nota: 'De todos los clientes', a: '/portal/firmas' },
    { titulo: 'Abonos activos', icono: Wallet, valor: r.abonos.filter((a) => a.estado === 'activo').length, nota: conError.length ? plural(conError.length, 'con problema de cobro', 'con problema de cobro') : 'Sin problemas de cobro', tono: conError.length ? 'aviso' : undefined, a: '/portal/admin/abonos' },
  ];

  const accesos = [
    { a: '/portal/admin', titulo: 'Usuarios', texto: 'Invitaciones, roles y verificación en dos pasos.', icono: ShieldCheck },
    { a: '/portal/admin/clientes', titulo: 'Clientes', texto: 'Empresas, planes, logos y vista como cliente.', icono: Users },
    { a: '/portal/admin/documentos', titulo: 'Documentos', texto: 'Modelos, protocolos y avisos a cada empresa.', icono: FileText },
    { a: '/portal/crm', titulo: 'CRM legal', texto: 'Clientes de cada empresa y sus casos.', icono: Kanban },
  ];

  return (
    <Marco perfil={perfil}>
      <Encabezado
        tutorial="inicio"
        grande
        eyebrow="FIRMA · Administración"
        titulo={
          <>
            {saludo()}, <span className="text-bosque">{(perfil!.nombre || 'FIRMA').split(' ')[0]}</span>
          </>
        }
        bajada={cargando ? 'Juntando lo de tus clientes…' : pendientes.length ? `Hay ${plural(pendientes.length, 'cosa que mirar', 'cosas que mirar')} en los negocios de tus clientes.` : 'Nada urgente en los negocios de tus clientes.'}
      />
      <div className="wrap pt-6 pb-10 flex flex-col gap-6">
        <Datos items={datos} cargando={cargando} />
        <div className="grid grid-cols-1 wide:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
          <Tarjeta titulo="Para hoy" cuenta={pendientes.length} enlace={{ a: '/portal/asuntos', texto: 'Todos los asuntos' }}>
            <ListaPendientes items={pendientes} cargando={cargando} vacio="Cuando un asunto esté por vencer o falle un cobro, aparece acá." />
          </Tarjeta>
          <Tarjeta titulo="Administración">
            <ModulosRapidos items={accesos} />
          </Tarjeta>
        </div>
      </div>
    </Marco>
  );
};

export const Inicio: React.FC<{ estado: EstadoSesion }> = ({ estado }) => {
  if (!estado.perfil) return null;
  return estado.perfil.rol === 'admin' ? <InicioFirma estado={estado} /> : <InicioCliente estado={estado} />;
};
