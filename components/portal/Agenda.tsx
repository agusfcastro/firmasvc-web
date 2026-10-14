import React, { useEffect, useState } from 'react';
import { ArrowUpRight, CalendarDays, Clock } from 'lucide-react';
import { supabase } from './supabase';
import { Aviso, Encabezado, Marco } from './ui';
import type { Agenda as TipoAgenda, Organizacion, Perfil } from './tipos';

/** Abre la reserva en una ventana sobre el portal. Si el navegador la bloquea, sigue el enlace normal. */
function abrirReserva(e: React.MouseEvent<HTMLAnchorElement>, url: string) {
  const ancho = Math.min(1040, window.screen.availWidth - 40);
  const alto = Math.min(800, window.screen.availHeight - 60);
  const izq = Math.round((window.screen.availWidth - ancho) / 2);
  const arriba = Math.round((window.screen.availHeight - alto) / 2);
  const v = window.open(url, 'firma-agenda', `popup=yes,width=${ancho},height=${alto},left=${izq},top=${arriba}`);
  if (v) {
    e.preventDefault();
    v.focus();
  }
}

export const Agenda: React.FC<{ perfil: Perfil; organizacion: Organizacion | null }> = ({ perfil, organizacion }) => {
  const [agendas, setAgendas] = useState<TipoAgenda[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const esAdmin = perfil.rol === 'admin';

  useEffect(() => {
    if (!supabase) return;
    let q = supabase.from('agendas').select('*').eq('activa', true).order('orden').order('titulo');
    // En "Ver como" el admin ve solo lo que vería esa empresa.
    if (esAdmin) q = q.is('organizacion_id', null);
    else if (organizacion?.id) q = q.or(`organizacion_id.is.null,organizacion_id.eq.${organizacion.id}`);
    q.then(({ data, error: e }) => {
      if (e) setError(e.message);
      setAgendas((data as TipoAgenda[]) ?? []);
    });
  }, [esAdmin, organizacion?.id]);

  return (
    <Marco perfil={perfil}>
      <Encabezado
        eyebrow="Agenda"
        titulo={
          <>
            Agendá una <span className="text-bosque">reunión</span>
          </>
        }
        bajada="Elegí el tipo de reunión y reservá el horario que te quede mejor. Te llega la invitación con el enlace de videollamada."
      />
      <section className="section bg-carbon text-marfil">
        <div className="wrap flex flex-col gap-10">
          {error && <Aviso tipo="error">{error}</Aviso>}
          {agendas && agendas.length === 0 && <p className="text-calido">Por ahora no hay agendas disponibles.</p>}
          <div className="grid grid-cols-1 tab:grid-cols-2 wide:grid-cols-3 gap-5">
            {(agendas ?? []).map((a, i) => (
              <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" onClick={(e) => abrirReserva(e, a.url)} className="card">
                <span aria-hidden="true" className="wm">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="icon-box">
                  <CalendarDays size={26} strokeWidth={1.8} />
                </div>
                <h2 className="h3 relative">{a.titulo}</h2>
                {a.duracion_min && (
                  <span className="relative inline-flex items-center gap-2 eyebrow text-[11px] text-calido">
                    <Clock size={13} aria-hidden="true" /> {a.duracion_min} minutos
                  </span>
                )}
                {a.descripcion && <p className="relative text-[15px] leading-[1.6] text-calido">{a.descripcion}</p>}
                <span className="ir relative">
                  Ver disponibilidad <ArrowUpRight size={16} />
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>
    </Marco>
  );
};
