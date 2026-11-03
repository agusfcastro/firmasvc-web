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
      <Encabezado tutorial="agenda"
        eyebrow="Agenda"
        titulo={
          <>
            Hablemos <span className="text-bosque whitespace-nowrap">cara a cara.</span>
          </>
        }
        bajada="Elegí el tipo de reunión y el horario que te quede cómodo. La invitación con el enlace de la videollamada te llega por mail."
      />
      <section className="section">
        <div className="wrap flex flex-col gap-7">
          {error && <Aviso tipo="error">{error}</Aviso>}
          {conLimite && (
            <BarraUso
              titulo={`Tiempo de reuniones ${periodoAgenda(uso.plan)}`}
              usado={uso.usado_min}
              incluido={uso.incluido_min as number}
              formato={duracion}
              nota={uso.hasta ? `Se renueva el ${diaYMes(uso.hasta)}. FIRMA carga el tiempo de cada reunión cuando termina.` : undefined}
            />
          )}
          {agotada && uso && (
            <div className="p-tarjeta flex flex-col gap-4 max-w-[620px] p-6 desk:p-8">
              <h2 className="font-heading font-semibold text-[18px]">Usaste el tiempo de reuniones {periodoAgenda(uso.plan)}</h2>
              <p className="text-[15px] leading-[1.6] text-piedra">
                Tu plan incluye {duracion(uso.incluido_min as number)} {uso.plan === 'black' ? 'por semana' : 'por mes'}. La agenda se habilita de nuevo el {diaYMes(uso.hasta)}. Si necesitás
                hablar antes, escribinos por WhatsApp.
              </p>
              <a
                href={whatsapp('Hola Agustín, usé el tiempo de agenda de mi plan y necesito coordinar una reunión.')}
                target="_blank"
                rel="noopener noreferrer"
                className="self-start inline-flex items-center gap-2 h-11 px-5 rounded-control bg-bosque text-marfil font-medium text-[14.5px] hover:bg-bosque-dark transition-colors duration-150"
              >
                <MessageCircle size={18} aria-hidden="true" /> Escribir por WhatsApp
              </a>
            </div>
          )}
          {!agotada && agendas && agendas.length === 0 && <p className="text-piedra">No hay horarios publicados en este momento. Escribinos a agustin@firmasvc.com y coordinamos.</p>}
          <div className="grid grid-cols-1 tab:grid-cols-2 wide:grid-cols-3 gap-4 desk:gap-5">
            {visibles.map((a) => (
              <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" onClick={(e) => abrirReserva(e, a.url)} className="group p-tarjeta flex flex-col gap-2.5 p-5 desk:p-6 transition-colors duration-150 hover:border-bosque">
                <span className="w-10 h-10 rounded-[12px] grid place-items-center bg-niebla text-tinta mb-1 transition-colors duration-150 group-hover:bg-tinta group-hover:text-marfil">
                  <CalendarDays size={20} strokeWidth={1.75} aria-hidden="true" />
                </span>
                <h2 className="font-heading font-semibold text-[18px] leading-snug">{a.titulo}</h2>
                {a.duracion_min && (
                  <span className="inline-flex items-center gap-1.5 text-[13px] text-piedra">
                    <Clock size={14} aria-hidden="true" /> {a.duracion_min} minutos
                  </span>
                )}
                {a.descripcion && <p className="text-[14px] leading-[1.55] text-piedra">{a.descripcion}</p>}
                <span className="mt-auto pt-2 inline-flex items-center gap-1.5 text-[14px] font-medium text-bosque">
                  Ver disponibilidad <ArrowUpRight size={16} aria-hidden="true" />
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>
    </Marco>
  );
};
