import React, { useEffect, useState } from 'react';
import { ArrowUpRight, CalendarDays, Clock, MessageCircle } from 'lucide-react';
import { supabase } from './supabase';
import { Aviso, Encabezado, Marco } from './ui';
import { BarraUso } from './BarraUso';
import { agendaAgotada, diaYMes, duracion, periodoAgenda, usoAgenda, whatsapp, type UsoAgenda } from './planes';
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
  const [uso, setUso] = useState<UsoAgenda | null>(null);
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
    if (!esAdmin && organizacion?.id) void usoAgenda(organizacion.id).then(setUso);
  }, [esAdmin, organizacion?.id]);

  const agotada = agendaAgotada(uso);
  const conLimite = uso && uso.incluido_min !== null;
  // En "Ver como" el admin ve todas las agendas: el bloqueo se respeta igual en pantalla.
  const visibles = agotada ? [] : agendas ?? [];

  return (
    <Marco perfil={perfil}>
      <Encabezado
        eyebrow="Agenda"
        titulo={
          <>
            Agendá una <span className="text-bosque">reunión</span>
          </>
        }
        bajada="Elegí el tipo de reunión y el horario. La invitación llega a tu mail con el enlace de la videollamada."
      />
      <section className="section bg-carbon text-marfil">
        <div className="wrap flex flex-col gap-10">
          {error && <Aviso tipo="error">{error}</Aviso>}
          {conLimite && (
            <BarraUso
              oscuro
              titulo={`Tiempo de reuniones ${periodoAgenda(uso.plan)}`}
              usado={uso.usado_min}
              incluido={uso.incluido_min as number}
              formato={duracion}
              nota={uso.hasta ? `Se renueva el ${diaYMes(uso.hasta)}. FIRMA carga el tiempo de cada reunión cuando termina.` : undefined}
            />
          )}
          {agotada && uso && (
            <div className="flex flex-col gap-5 max-w-[620px] border border-[rgba(244,242,237,0.2)] p-6 desk:p-8">
              <h2 className="h3">Usaste el tiempo de reuniones {periodoAgenda(uso.plan)}</h2>
              <p className="text-[15px] leading-[1.6] text-calido">
                Tu plan incluye {duracion(uso.incluido_min as number)} {uso.plan === 'black' ? 'por semana' : 'por mes'}. La agenda se habilita de nuevo el {diaYMes(uso.hasta)}. Si necesitás
                hablar antes, escribinos por WhatsApp.
              </p>
              <a
                href={whatsapp('Hola Agustín, usé el tiempo de agenda de mi plan y necesito coordinar una reunión.')}
                target="_blank"
                rel="noopener noreferrer"
                className="self-start inline-flex items-center gap-2 h-12 px-6 bg-marfil text-tinta font-medium text-[15px] hover:bg-calido transition-colors duration-150"
              >
                <MessageCircle size={18} aria-hidden="true" /> Escribir por WhatsApp
              </a>
            </div>
          )}
          {!agotada && agendas && agendas.length === 0 && <p className="text-calido">No hay horarios publicados en este momento. Escribinos a agustin@firmasvc.com y coordinamos.</p>}
          <div className="grid grid-cols-1 tab:grid-cols-2 wide:grid-cols-3 gap-5">
            {visibles.map((a, i) => (
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
