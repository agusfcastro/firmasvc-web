import React, { Suspense, lazy, useEffect, useRef } from 'react';
// Archivo variable (peso y ancho), alojada en firmasvc.com. Solo la descarga quien entra al portal.
import '@fontsource-variable/archivo/wdth.css';
import { Button } from '../Button';
import { supabase } from './supabase';
import { guardarDestino, navegar, tomarDestino, useRuta } from './navegacion';
import { useSesion } from './useSesion';
import { registrarServiceWorker } from './push';
import { Aviso, Cargando, Marco } from './ui';
import { LimiteError } from './LimiteError';
import { LayoutAcceso } from './LayoutAcceso';
import { Ingresar } from './Ingresar';
import { DefinirClave } from './DefinirClave';
import { SegundoFactor } from './SegundoFactor';
import { Inicio } from './Inicio';
import { Agenda } from './Agenda';
import { Documentos } from './Documentos';
// Sin lazy: Documentos ya trae este módulo para la tarjeta del pedido.
import { Pedido } from './pedidos/Pedidos';
import { VistaPreviaContexto, leerVistaPrevia } from './vistaPrevia';
import { permisosDe, veAsuntos, type Organizacion, type Perfil } from './tipos';

const CrmApp = lazy(() => import('./crm/CrmApp'));
const Firmas = lazy(() => import('./firmas/Firmas'));
const EquipoApp = lazy(() => import('./equipo/EquipoApp'));
const Asuntos = lazy(() => import('./EstadoAsuntos'));
const Bitacora = lazy(() => import('./Bitacora'));
// Pagos lo abre solo el titular: no hace falta que lo descargue todo el equipo.
const Pagos = lazy(() => import('./Pagos').then((m) => ({ default: m.Pagos })));
const PanelAdmin = lazy(() => import('./admin/PanelAdmin').then((m) => ({ default: m.PanelAdmin })));

const CargandoSeccion: React.FC = () => (
  <div className="wrap py-16 flex items-center gap-3 text-piedra text-[14px]" role="status">
    <span aria-hidden="true" className="w-4 h-4 rounded-full border-2 border-borde-suave border-t-tinta animate-spin motion-reduce:animate-none" />
    Cargando…
  </div>
);

/**
 * Portal de clientes FIRMA. Rutas
 *   /portal/ingresar   login
 *   /portal/clave      definir o cambiar contraseña (desde el enlace del mail)
 *   /portal            inicio según rol
 *   /portal/documentos contratos de servicio, con el equipo y otros (más /equipo y /otros)
 *   /portal/protocolos protocolos y formación del equipo
 *   /portal/firmas     firma electrónica propia (más /nuevo y /<id>)
 *   /portal/equipo     personas, calendario del equipo, victorias, objetivos y reportes (más /persona/<id>, /victorias, /objetivos y /reportes)
 *   /portal/pedidos/closer formulario para pedir un contrato (más /<id>)
 *   /portal/pagos      abonos mensuales con tarjeta (solo titular y admin)
 *   /portal/bitacora   bitácora de la empresa (solo titular; FIRMA usa Administración › Registro)
 *   /portal/admin/...  panel de administración (solo admin)
 */
const Portal: React.FC = () => {
  const ruta = useRuta();
  const estado = useSesion();
  const { cargando, sesion, perfil, vieneDeEnlace } = estado;

  // App instalable y avisos: el service worker solo muestra notificaciones, no guarda nada en caché.
  useEffect(() => {
    void registrarServiceWorker();
  }, []);

  useEffect(() => {
    const previo = document.title;
    // El título de cada sección lo pone el Marco. Este es el de las pantallas de acceso.
    document.title = 'Portal de clientes · FIRMA';
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => {
      document.title = previo;
      meta.remove();
    };
  }, []);

  const yaControlo = useRef(false);

  // Redirecciones según la sesión.
  useEffect(() => {
    if (cargando || !supabase) return;
    const alAbrir = !yaControlo.current;
    yaControlo.current = true;
    if (!sesion && ruta !== '/portal/ingresar' && ruta !== '/portal/clave') {
      // Se guarda adónde iba (el enlace de un mail o de un aviso) para llevarla ahí después de ingresar.
      // Solo al abrir el portal: al salir no, así la próxima persona que ingrese acá empieza por Inicio.
      if (alAbrir) guardarDestino(window.location.pathname + window.location.search);
      navegar('/portal/ingresar');
    } else if (sesion && ruta === '/portal/ingresar') {
      // Vuelta del ingreso con Google: se anota en la bitácora como el ingreso con contraseña.
      let conGoogle = false;
      try {
        conGoogle = window.sessionStorage.getItem('firma-ingreso-google') === '1';
        window.sessionStorage.removeItem('firma-ingreso-google');
      } catch {
        /* sin almacenamiento */
      }
      if (conGoogle) void supabase.rpc('registrar_ingreso').then(() => undefined, () => undefined);
      navegar(tomarDestino());
    }
    else if (sesion && vieneDeEnlace && ruta !== '/portal/clave') navegar('/portal/clave');
  }, [cargando, sesion, ruta, vieneDeEnlace]);

  if (!supabase) {
    return (
      <LayoutAcceso>
        <h1 className="p-titulo-grande mb-5">Portal sin configurar</h1>
        <Aviso tipo="error">Faltan las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY. Revisá la guía PORTAL.md.</Aviso>
      </LayoutAcceso>
    );
  }

  if (cargando) return <Cargando />;
  // Las cuentas de FIRMA no pasan de acá sin el segundo factor, ni siquiera para cambiar la contraseña.
  if (sesion && perfil?.rol === 'admin' && perfil.activo && !estado.enlacePendiente) {
    if (!estado.mfa) return <Cargando />;
    if (estado.mfa.actual !== 'aal2') return <SegundoFactor estado={estado} />;
  }
  if (ruta === '/portal/clave') return <DefinirClave estado={estado} />;
  if (!sesion) return <Ingresar />;

  if (estado.falloCarga && !perfil) {
    return (
      <LayoutAcceso>
        <p className="text-[13px] font-medium text-piedra mb-2">Sin conexión</p>
        <h1 className="p-titulo-grande mb-5">
          No pudimos cargar <span className="text-bosque">tu cuenta</span>
        </h1>
        <p className="text-piedra mb-8">Parece un problema de conexión. Tu acceso sigue igual: revisá tu internet y probá de nuevo.</p>
        <Button onClick={() => void estado.recargar()}>Reintentar</Button>
      </LayoutAcceso>
    );
  }

  if (!perfil || !perfil.activo || (perfil.rol !== 'admin' && !estado.organizacion)) {
    return (
      <LayoutAcceso>
        <p className="text-[13px] font-medium text-piedra mb-2">Acceso</p>
        <h1 className="p-titulo-grande mb-5">
          Tu cuenta no está <span className="text-bosque">habilitada</span>
        </h1>
        <p className="text-piedra mb-8">Ingresaste como {sesion.user.email}, pero esta cuenta no tiene acceso activo al portal. Escribinos y lo revisamos.</p>
        <Button
          variant="ghost"
          onClick={async () => {
            await supabase?.auth.signOut({ scope: 'local' });
            navegar('/portal/ingresar');
          }}
        >
          Salir
        </Button>
      </LayoutAcceso>
    );
  }

  // Mientras baja una sección, el marco queda en su lugar: solo espera el contenido.
  const espera = (
    <Marco perfil={perfil}>
      <CargandoSeccion />
    </Marco>
  );

  // Modo "Ver como": el admin navega con la perspectiva de un cliente.
  const vista = perfil.rol === 'admin' ? leerVistaPrevia() : null;
  if (vista) {
    const perfilVista: Perfil = { ...perfil, rol: vista.rol, organizacion_id: vista.orgId, areas: vista.areas, nombre: vista.nombre ?? perfil.nombre, cargo: null };
    const orgVista = { id: vista.orgId, nombre: vista.orgNombre, activa: true } as Organizacion;
    const permisosVista = permisosDe(vista.rol);
    const esperaVista = (
      <Marco perfil={perfilVista}>
        <CargandoSeccion />
      </Marco>
    );
    const enCrm = (ruta === '/portal/crm' || ruta.startsWith('/portal/crm/')) && permisosVista.crm;
    const enDocumentos = ruta === '/portal/documentos' || ruta.startsWith('/portal/documentos/') || ruta === '/portal/protocolos';
    const enFirmas = (ruta === '/portal/firmas' || ruta.startsWith('/portal/firmas/')) && permisosVista.documentosLegales;
    const enAsuntos = (ruta === '/portal/asuntos' || ruta.startsWith('/portal/asuntos/')) && permisosVista.casos;
    const enPedidos = ruta.startsWith('/portal/pedidos/') && permisosVista.casos;
    const enEquipo = ruta === '/portal/equipo' || ruta.startsWith('/portal/equipo/');
    return (
      <VistaPreviaContexto.Provider value={vista}>
        {enPedidos ? (
          <Pedido perfil={perfilVista} organizacion={orgVista} ruta={ruta} />
        ) : enCrm ? (
          <Suspense fallback={esperaVista}>
            <CrmApp perfil={perfilVista} organizacion={orgVista} ruta={ruta} />
          </Suspense>
        ) : enEquipo ? (
          <Suspense fallback={esperaVista}>
            <EquipoApp perfil={perfilVista} organizacion={orgVista} ruta={ruta} />
          </Suspense>
        ) : enFirmas ? (
          <Suspense fallback={esperaVista}>
            <Firmas perfil={perfilVista} organizacion={orgVista} ruta={ruta} />
          </Suspense>
        ) : enAsuntos ? (
          <Suspense fallback={esperaVista}>
            <Asuntos perfil={perfilVista} organizacion={orgVista} ruta={ruta} />
          </Suspense>
        ) : enDocumentos ? (
          <Documentos perfil={perfilVista} organizacion={orgVista} ruta={permisosVista.documentosLegales ? ruta : '/portal/protocolos'} />
        ) : ruta === '/portal/agenda' && permisosVista.agenda ? (
          <Agenda perfil={perfilVista} organizacion={orgVista} />
        ) : ruta === '/portal/pagos' && permisosVista.gestion ? (
          <Suspense fallback={esperaVista}>
            <Pagos perfil={perfilVista} organizacion={orgVista} />
          </Suspense>
        ) : (
          <Inicio estado={{ ...estado, perfil: perfilVista, organizacion: orgVista }} />
        )}
      </VistaPreviaContexto.Provider>
    );
  }

  const permisos = permisosDe(perfil.rol);

  if ((ruta === '/portal/crm' || ruta.startsWith('/portal/crm/')) && permisos.crm) {
    return (
      <Suspense fallback={espera}>
        <CrmApp perfil={perfil} organizacion={estado.organizacion} ruta={ruta} />
      </Suspense>
    );
  }

  // Equipo es de toda la gente de la empresa. Lo que cada uno ve lo decide la base (0076).
  if (ruta === '/portal/equipo' || ruta.startsWith('/portal/equipo/')) {
    return (
      <Suspense fallback={espera}>
        <EquipoApp perfil={perfil} organizacion={estado.organizacion} ruta={ruta} />
      </Suspense>
    );
  }

  // Sin documentos legales, la biblioteca es solo protocolos: cualquier ruta de documentos cae ahí.
  if (ruta === '/portal/documentos' || ruta.startsWith('/portal/documentos/') || ruta === '/portal/protocolos') {
    return <Documentos perfil={perfil} organizacion={estado.organizacion} ruta={permisos.documentosLegales ? ruta : '/portal/protocolos'} />;
  }

  if ((ruta === '/portal/firmas' || ruta.startsWith('/portal/firmas/')) && permisos.documentosLegales) {
    return (
      <Suspense fallback={espera}>
        <Firmas perfil={perfil} organizacion={estado.organizacion} ruta={ruta} />
      </Suspense>
    );
  }

  // Closers y setters responsables de un cliente entran solo a los asuntos de su cartera.
  if ((ruta === '/portal/asuntos' || ruta.startsWith('/portal/asuntos/')) && veAsuntos(perfil)) {
    return (
      <Suspense fallback={espera}>
        <Asuntos perfil={perfil} organizacion={estado.organizacion} ruta={ruta} />
      </Suspense>
    );
  }

  // FIRMA abre los pedidos enviados desde el asunto. Los crea el titular o el CSM.
  if (ruta.startsWith('/portal/pedidos/') && permisos.casos) return <Pedido perfil={perfil} organizacion={estado.organizacion} ruta={ruta} />;

  if (ruta === '/portal/agenda' && permisos.agenda) return <Agenda perfil={perfil} organizacion={estado.organizacion} />;

  // Pagos solo para titulares y FIRMA. El resto del equipo vuelve al inicio.
  if (ruta === '/portal/pagos') {
    if (!permisos.gestion) return <Inicio estado={estado} />;
    return (
      <Suspense fallback={espera}>
        <Pagos perfil={perfil} organizacion={estado.organizacion} />
      </Suspense>
    );
  }

  if (ruta === '/portal/bitacora') {
    if (perfil.rol !== 'titular') return <Inicio estado={estado} />;
    return (
      <Suspense fallback={espera}>
        <Bitacora perfil={perfil} organizacion={estado.organizacion} />
      </Suspense>
    );
  }

  if (ruta.startsWith('/portal/admin')) {
    if (perfil.rol !== 'admin') return <Inicio estado={estado} />;
    return (
      <Suspense fallback={espera}>
        <PanelAdmin perfil={perfil} ruta={ruta} />
      </Suspense>
    );
  }

  return <Inicio estado={estado} />;
};

/** El portal entero dentro de la red de contención: un error en una pantalla no deja la página en blanco. */
export const PortalApp: React.FC = () => (
  <LimiteError>
    <Portal />
  </LimiteError>
);

export default PortalApp;
