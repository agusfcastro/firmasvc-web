import React, { useState } from 'react';
import { Button } from '../Button';
import { supabase } from './supabase';
import { navegar } from './navegacion';
import { Aviso, Campo, claseInput } from './ui';
import { LayoutAcceso } from './LayoutAcceso';
import type { EstadoSesion } from './useSesion';

const MINIMO = 10;

function problemaDeClave(clave: string): string | null {
  if (clave.length < MINIMO) return `Tiene que tener al menos ${MINIMO} caracteres.`;
  if (!/[a-zA-Z]/.test(clave) || !/\d/.test(clave)) return 'Combiná letras y números.';
  return null;
}

export const DefinirClave: React.FC<{ estado: EstadoSesion }> = ({ estado }) => {
  const [clave, setClave] = useState('');
  const [repetir, setRepetir] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activando, setActivando] = useState(false);
  const [enlaceFallido, setEnlaceFallido] = useState(false);
  const [ver, setVer] = useState(false);

  async function activar() {
    setActivando(true);
    const motivo = await estado.activarEnlace();
    setActivando(false);
    if (motivo) setEnlaceFallido(true);
  }

  // Enlace del mail sin activar: un paso con botón, así ningún filtro de correo lo gasta.
  if (estado.enlacePendiente) {
    return (
      <LayoutAcceso>
        <p className="text-[13px] font-medium text-piedra mb-2">Acceso de clientes</p>
        <h1 className="p-titulo-grande mb-3">
          Activá tu <span className="text-bosque">acceso</span>
        </h1>
        <p className="text-piedra mb-8">Tocá el botón para validar tu enlace. Después definís tu contraseña y entrás al portal.</p>
        <Button size="lg" fullWidth onClick={activar} disabled={activando}>
          {activando ? 'Validando…' : 'Activar mi acceso'}
        </Button>
      </LayoutAcceso>
    );
  }

  if (!estado.sesion) {
    return (
      <LayoutAcceso>
        <p className="text-[13px] font-medium text-piedra mb-2">Acceso</p>
        <h1 className="p-titulo-grande mb-5">
          El enlace <span className="text-bosque">venció</span>
        </h1>
        <p className="text-piedra mb-8">
          {enlaceFallido ? 'Este enlace ya se usó o venció. ' : ''}Los enlaces de acceso se usan una sola vez y, si pedís uno nuevo, el anterior deja de servir. Pedí uno desde la pantalla de
          ingreso con «Olvidé mi contraseña», o pedíselo a FIRMA.
        </p>
        <Button size="lg" onClick={() => navegar('/portal/ingresar')}>Ir al ingreso</Button>
      </LayoutAcceso>
    );
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    const problema = problemaDeClave(clave);
    if (problema) return setError(problema);
    if (clave !== repetir) return setError('Las contraseñas no coinciden.');
    setEnviando(true);
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ password: clave });
    setEnviando(false);
    if (err) {
      setError(/different|same/i.test(err.message) ? 'Elegí una contraseña distinta de la anterior.' : 'No se pudo guardar. Probá con otra contraseña o pedí un enlace nuevo.');
      return;
    }
    await supabase.rpc('registrar_ingreso');
    estado.terminarEnlace();
    // Reemplaza /portal/clave en el historial, así «atrás» no vuelve a esta pantalla, y avisa el cambio de ruta.
    window.history.replaceState({}, '', '/portal');
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.scrollTo(0, 0);
  }

  return (
    <LayoutAcceso>
      <p className="text-[13px] font-medium text-piedra mb-2">Primer ingreso</p>
      <h1 className="p-titulo-grande mb-3">
        Definí tu <span className="text-bosque">contraseña</span>
      </h1>
      <p className="text-piedra mb-8">Para {estado.sesion.user.email}. Se guarda cifrada: nadie en FIRMA puede verla.</p>
      <form onSubmit={guardar} className="space-y-5">
        {error && <Aviso tipo="error">{error}</Aviso>}
        <Campo etiqueta="Contraseña nueva">
          <input type={ver ? 'text' : 'password'} required autoComplete="new-password" aria-describedby="requisitos-clave" className={claseInput} value={clave} onChange={(e) => setClave(e.target.value)} />
        </Campo>
        {/* Los requisitos se van tildando mientras se escribe, así nadie se entera recién al guardar. */}
        <ul id="requisitos-clave" className="-mt-2 flex flex-col gap-1 text-[13px]">
          {[
            { ok: clave.length >= MINIMO, texto: `Al menos ${MINIMO} caracteres` },
            { ok: /[a-zA-Z]/.test(clave) && /\d/.test(clave), texto: 'Letras y números' },
          ].map((r) => (
            <li key={r.texto} className={`flex items-center gap-2 ${r.ok ? 'text-exito' : 'text-piedra'}`}>
              <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full ${r.ok ? 'bg-exito' : 'bg-borde'}`} />
              {r.texto}
              <span className="sr-only">{r.ok ? ', cumplido' : ', falta'}</span>
            </li>
          ))}
        </ul>
        <Campo etiqueta="Confirmá la contraseña">
          <input type={ver ? 'text' : 'password'} required autoComplete="new-password" aria-invalid={Boolean(repetir) && repetir !== clave} className={claseInput} value={repetir} onChange={(e) => setRepetir(e.target.value)} />
          {repetir && repetir !== clave && <span className="block mt-1.5 text-[13px] text-peligro">Todavía no coinciden.</span>}
        </Campo>
        <label className="flex items-center gap-2.5 min-h-[32px] text-[14px] cursor-pointer">
          <input type="checkbox" checked={ver} onChange={(e) => setVer(e.target.checked)} className="w-4 h-4 accent-tinta" />
          Mostrar las contraseñas
        </label>
        <Button type="submit" size="lg" fullWidth disabled={enviando}>
          {enviando ? 'Guardando…' : 'Guardar y entrar'}
        </Button>
      </form>
    </LayoutAcceso>
  );
};
