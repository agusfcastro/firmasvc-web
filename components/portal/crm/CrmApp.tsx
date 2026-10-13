import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { Encabezado, Marco } from '../ui';
import type { Organizacion, Perfil } from '../tipos';
import { Listado } from './Listado';
import { Ficha } from './Ficha';
import { AltaCliente } from './AltaCliente';

/**
 * CRM legal de cada cliente de FIRMA.
 *   /portal/crm                lista (el admin elige la organización)
 *   /portal/crm/nuevo          alta
 *   /portal/crm/<id>           ficha del cliente final
 */
export const CrmApp: React.FC<{ perfil: Perfil; organizacion: Organizacion | null; ruta: string }> = ({ perfil, organizacion, ruta }) => {
  const esAdmin = perfil.rol === 'admin';
  const [orgs, setOrgs] = useState<Organizacion[]>([]);
  const [orgId, setOrgId] = useState<string | null>(() => {
    if (!esAdmin) return organizacion?.id ?? null;
    const q = new URLSearchParams(window.location.search).get('org');
    try {
      return q || window.localStorage.getItem('firma-crm-org');
    } catch {
      return q;
    }
  });

  useEffect(() => {
    if (!esAdmin || !supabase) return;
    supabase
      .from('organizaciones')
      .select('*')
      .order('nombre')
      .then(({ data }) => {
        const lista = (data as Organizacion[]) ?? [];
        setOrgs(lista);
        if (!orgId || !lista.some((o) => o.id === orgId)) setOrgId(lista[0]?.id ?? null);
      });
  }, [esAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!esAdmin || !orgId) return;
    try {
      window.localStorage.setItem('firma-crm-org', orgId);
    } catch {
      /* sin almacenamiento */
    }
  }, [esAdmin, orgId]);

  const sub = ruta.replace(/^\/portal\/crm\/?/, '');
  const orgActual = esAdmin ? orgs.find((o) => o.id === orgId) ?? null : organizacion;
  const puedeGestionar = esAdmin || perfil.rol === 'titular';

  const selector =
    esAdmin && orgs.length > 1 ? (
      <label className="flex flex-col gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-piedra">Cliente de FIRMA</span>
        <select
          className="h-12 pl-3.5 pr-10 bg-white border border-tinta font-medium text-[15px] focus:outline-none focus:ring-1 focus:ring-bosque"
          value={orgId ?? ''}
          onChange={(e) => setOrgId(e.target.value)}
        >
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nombre}
            </option>
          ))}
        </select>
      </label>
    ) : null;

  return (
    <Marco perfil={perfil}>
      {!orgId ? (
        <Encabezado eyebrow="CRM legal" titulo="Sin clientes todavía" bajada="Cuando des de alta una empresa en Administración, su CRM aparece acá." />
      ) : sub === 'nuevo' ? (
        <AltaCliente orgId={orgId} esAdmin={esAdmin} orgNombre={orgActual?.nombre ?? ''} />
      ) : sub ? (
        <Ficha id={sub} esAdmin={esAdmin} puedeGestionar={puedeGestionar} orgNombre={orgActual?.nombre ?? ''} />
      ) : (
        <Listado orgId={orgId} orgNombre={orgActual?.nombre ?? ''} selector={selector} />
      )}
    </Marco>
  );
};

export default CrmApp;
