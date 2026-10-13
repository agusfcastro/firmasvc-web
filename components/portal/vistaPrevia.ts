import { createContext, useContext } from 'react';
import { navegar } from './navegacion';

/**
 * Modo "Ver como". Un admin de FIRMA ve el portal con la perspectiva de un
 * cliente (empresa, rol y áreas), en solo lectura y sin usar su cuenta.
 * Es una simulación de pantalla. Los permisos reales los aplica la base.
 */
export interface VistaPrevia {
  orgId: string;
  orgNombre: string;
  rol: 'titular' | 'miembro';
  areas: string[];
  nombre?: string;
}

const CLAVE = 'firma-vista-previa';

export function leerVistaPrevia(): VistaPrevia | null {
  try {
    const v = window.sessionStorage.getItem(CLAVE);
    return v ? (JSON.parse(v) as VistaPrevia) : null;
  } catch {
    return null;
  }
}

export function iniciarVistaPrevia(v: VistaPrevia) {
  try {
    window.sessionStorage.setItem(CLAVE, JSON.stringify(v));
  } catch {
    /* sin almacenamiento, no se puede activar */
  }
  navegar('/portal');
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function salirVistaPrevia() {
  try {
    window.sessionStorage.removeItem(CLAVE);
  } catch {
    /* nada */
  }
  navegar('/portal/admin');
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export const VistaPreviaContexto = createContext<VistaPrevia | null>(null);
export const useVistaPrevia = () => useContext(VistaPreviaContexto);
