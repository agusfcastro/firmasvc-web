import React, { useEffect, useState } from 'react';
import { Bell, BellOff, Share, X } from 'lucide-react';
import { Button } from '../Button';
import { activarPush, cerrarTarjeta, desactivarPush, estadoPush, tarjetaCerrada, type EstadoPush } from './push';

/**
 * Tarjeta de Inicio que ofrece activar los avisos en este dispositivo.
 * Desaparece cuando se activan o cuando la persona la cierra; después se
 * manejan con la campana de la barra lateral.
 */
export const TarjetaAvisos: React.FC = () => {
  const [estado, setEstado] = useState<EstadoPush | null>(null);
  const [cerrada, setCerrada] = useState(tarjetaCerrada);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    estadoPush().then((e) => vivo && setEstado(e));
    return () => {
      vivo = false;
    };
  }, []);

  if (cerrada || !estado || estado === 'activos' || estado === 'no_soportado') return null;

  const cerrar = () => {
    cerrarTarjeta();
    setCerrada(true);
  };

  const activar = async () => {
    setOcupado(true);
    setError(null);
    const r = await activarPush();
    setOcupado(false);
    setEstado(r.estado);
    if (r.error) setError(r.error);
  };

  return (
    <section className="p-tarjeta relative flex flex-col sm:flex-row sm:items-center gap-4">
      <span aria-hidden="true" className="w-10 h-10 shrink-0 grid place-items-center rounded-full bg-tinta text-marfil">
        <Bell size={18} />
      </span>
      <div className="flex-1 min-w-0 pr-8">
        <h2 className="font-bold text-[15.5px] tracking-[-0.01em]">Avisos en este dispositivo</h2>
        {estado === 'instalar' ? (
          <p className="text-[13.5px] text-piedra mt-1">
            En iPhone, primero instalá la app: tocá <Share size={14} className="inline -mt-0.5" aria-label="Compartir" /> y después «Agregar a inicio». Abrí FIRMA desde
            ese ícono y activá los avisos.
          </p>
        ) : estado === 'bloqueados' ? (
          <p className="text-[13.5px] text-piedra mt-1">Los avisos están bloqueados para el portal. Habilitalos en la configuración del navegador o del celular y volvé a esta página.</p>
        ) : (
          <p className="text-[13.5px] text-piedra mt-1">Te avisamos al momento de novedades en tus asuntos, firmas y onboardings. Solo cosas de trabajo, nada de marketing.</p>
        )}
        {error && <p className="text-[13px] text-peligro-fuerte mt-2">{error}</p>}
      </div>
      {estado === 'apagados' && (
        <Button onClick={activar} disabled={ocupado} className="shrink-0">
          {ocupado ? 'Activando…' : 'Activar avisos'}
        </Button>
      )}
      <button type="button" onClick={cerrar} aria-label="Cerrar" title="Cerrar" className="absolute top-3 right-3 w-9 h-9 grid place-items-center rounded-[10px] text-piedra hover:text-tinta hover:bg-tinta/[0.05]">
        <X size={16} aria-hidden="true" />
      </button>
    </section>
  );
};

/** Campana de la barra lateral: prende y apaga los avisos de este dispositivo. */
export const BotonAvisos: React.FC = () => {
  const [estado, setEstado] = useState<EstadoPush | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    estadoPush().then((e) => vivo && setEstado(e));
    return () => {
      vivo = false;
    };
  }, []);

  if (!estado || estado === 'no_soportado' || estado === 'instalar') return null;
  const activos = estado === 'activos';
  const titulo = activos ? 'Avisos activos en este dispositivo. Tocá para apagarlos' : estado === 'bloqueados' ? 'Avisos bloqueados en el navegador' : 'Activar avisos en este dispositivo';

  const alternar = async () => {
    if (estado === 'bloqueados') return;
    setOcupado(true);
    if (activos) {
      await desactivarPush();
      setEstado('apagados');
    } else {
      setEstado((await activarPush()).estado);
    }
    setOcupado(false);
  };

  return (
    <button
      type="button"
      onClick={alternar}
      disabled={ocupado || estado === 'bloqueados'}
      aria-label={titulo}
      aria-pressed={activos}
      title={titulo}
      className={`w-10 h-10 grid place-items-center shrink-0 rounded-[10px] hover:bg-marfil/[0.06] disabled:opacity-50 ${activos ? 'text-marfil' : 'text-lateral-tenue hover:text-marfil'}`}
    >
      {activos ? <Bell size={17} aria-hidden="true" /> : <BellOff size={17} aria-hidden="true" />}
    </button>
  );
};
