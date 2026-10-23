import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '../../Button';
import { supabase } from '../supabase';
import { Aviso, Campo, claseInput } from '../ui';
import { BarraUso } from '../BarraUso';
import { ROTULO_PLAN, diaYMes, duracion, periodoAgenda, usoAgenda, type UsoAgenda } from '../planes';
import type { Organizacion } from '../tipos';

/**
 * Tiempo de reuniones de cada empresa. Después de cada reunión FIRMA carga
 * los minutos y la barra del cliente se actualiza. Con el tiempo del
 * período agotado, la empresa deja de ver los enlaces de reserva.
 */

interface Consumo {
  id: string;
  organizacion_id: string;
  fecha: string;
  minutos: number;
  nota: string | null;
  creado_en: string;
}

const hoy = (): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());

export const TiempoAgenda: React.FC<{ orgs: Organizacion[] }> = ({ orgs }) => {
  const conPlan = orgs.filter((o) => o.plan === 'gold' || o.plan === 'black');
  const [orgId, setOrgId] = useState('');
  const [uso, setUso] = useState<UsoAgenda | null>(null);
  const [consumos, setConsumos] = useState<Consumo[]>([]);
  const [form, setForm] = useState({ fecha: hoy(), minutos: '', nota: '' });
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId && conPlan[0]) setOrgId(conPlan[0].id);
  }, [orgId, conPlan]);

  const cargar = useCallback(async () => {
    if (!supabase || !orgId) return;
    const [u, { data, error: e }] = await Promise.all([
      usoAgenda(orgId),
      supabase.from('agenda_consumos').select('*').eq('organizacion_id', orgId).order('fecha', { ascending: false }).order('creado_en', { ascending: false }).limit(20),
    ]);
    if (e) setError(`${e.message}. Revisá que la migración 0022 esté corrida en Supabase.`);
    setUso(u);
    setConsumos((data as Consumo[]) ?? []);
  }, [orgId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function cargarConsumo(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !orgId) return;
    const minutos = Math.round(Number(form.minutos));
    if (!Number.isFinite(minutos) || minutos < 1 || minutos > 600) return setError('Los minutos van de 1 a 600.');
    setOcupado(true);
    setError(null);
    const { error: e1 } = await supabase.from('agenda_consumos').insert({ organizacion_id: orgId, fecha: form.fecha || hoy(), minutos, nota: form.nota.trim() || null });
    setOcupado(false);
    if (e1) return setError(e1.message);
    setForm({ fecha: hoy(), minutos: '', nota: '' });
    setOk(`Cargamos ${duracion(minutos)}.`);
    void cargar();
  }

  async function borrar(c: Consumo) {
    if (!supabase || !window.confirm(`¿Borrar la reunión del ${diaYMes(c.fecha)} de ${duracion(c.minutos)}? Vuelve al saldo de la empresa.`)) return;
    const { error: e1 } = await supabase.from('agenda_consumos').delete().eq('id', c.id);
    if (e1) return setError(e1.message);
    setOk('Reunión borrada.');
    void cargar();
  }

  if (conPlan.length === 0) {
    return (
      <section className="bg-marfil-oscuro p-6 desk:p-8 max-w-[820px] flex flex-col gap-2">
        <h2 className="h3">Tiempo de reuniones</h2>
        <p className="text-sm text-piedra">Ninguna empresa tiene plan Gold o Black. El plan se elige en Clientes › Editar.</p>
      </section>
    );
  }

  const enPeriodo = (c: Consumo) => uso?.desde && uso.hasta && c.fecha >= uso.desde && c.fecha < uso.hasta;

  return (
    <section className="bg-marfil-oscuro p-6 desk:p-8 max-w-[820px] flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="h3">Tiempo de reuniones</h2>
          <p className="text-sm text-piedra">Cargá lo que duró cada reunión. Gold incluye 60 minutos por mes y Black 60 por semana.</p>
        </div>
        <label className="block">
          <span className="sr-only">Empresa</span>
          <select className={`${claseInput} min-w-[220px]`} value={orgId} onChange={(e) => setOrgId(e.target.value)}>
            {conPlan.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nombre} · {ROTULO_PLAN[o.plan as 'gold' | 'black']}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <Aviso tipo="error">{error}</Aviso>}
      {ok && <Aviso tipo="ok">{ok}</Aviso>}

      {uso && uso.incluido_min !== null && (
        <BarraUso
          titulo={`Usado ${periodoAgenda(uso.plan)}`}
          usado={uso.usado_min}
          incluido={uso.incluido_min}
          formato={duracion}
          nota={`Se renueva el ${diaYMes(uso.hasta)}.${uso.usado_min >= uso.incluido_min ? ' La empresa no ve los enlaces de reserva hasta entonces.' : ''}`}
        />
      )}

      <form onSubmit={cargarConsumo} className="grid gap-4 tab:grid-cols-[160px_120px_minmax(0,1fr)_auto] items-end">
        <Campo etiqueta="Fecha">
          <input type="date" required className={claseInput} value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
        </Campo>
        <Campo etiqueta="Minutos">
          <input type="number" required min={1} max={600} className={claseInput} value={form.minutos} onChange={(e) => setForm({ ...form, minutos: e.target.value })} />
        </Campo>
        <Campo etiqueta="Nota">
          <input maxLength={300} className={claseInput} placeholder="Opcional. Por ejemplo, revisión del contrato de servicios" value={form.nota} onChange={(e) => setForm({ ...form, nota: e.target.value })} />
        </Campo>
        <Button type="submit" disabled={ocupado}>
          {ocupado ? 'Cargando…' : 'Cargar'}
        </Button>
      </form>

      {consumos.length > 0 && (
        <div className="overflow-x-auto">
          <table className="tabla tabla-media min-w-[560px]">
            <thead>
              <tr>
                <th>Fecha</th>
                <th className="num">Duración</th>
                <th>Nota</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {consumos.map((c) => (
                <tr key={c.id} className={enPeriodo(c) ? undefined : 'text-piedra'}>
                  <td className="whitespace-nowrap">{diaYMes(c.fecha)}</td>
                  <td className="num whitespace-nowrap">{duracion(c.minutos)}</td>
                  <td>{c.nota ?? ''}</td>
                  <td className="text-right">
                    <button type="button" className="text-xs underline underline-offset-4 text-piedra hover:text-tinta" onClick={() => borrar(c)}>
                      Borrar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
