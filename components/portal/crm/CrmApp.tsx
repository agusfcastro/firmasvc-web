import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { navegar } from '../navegacion';
import { Marco } from '../ui';
import type { Organizacion, Perfil } from '../tipos';
import { Listado } from './Listado';
import { Ficha } from './Ficha';
import { AltaCliente } from './AltaCliente';

/**
 * CRM legal de cada cliente de FIRMA.
 *   /portal/crm                lista (el admin elige la organización con ?org=)
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
        if (!orgId && lista.length) setOrgId(lista[0].id);
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

  return (
    <Marco perfil={perfil}>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <p className="eyebrow text-piedra mb-3">
            <a
              href="/portal"
              onClick={(e) => {
                e.preventDefault();
                navegar('/portal');
              }}
              className="hover:text-bosque"
            >
              Portal
            </a>{' '}
            / CRM legal
          </p>
          <h1 className="h2">{orgActual?.nombre ?? 'CRM legal'}</h1>
        </div>
        {esAdmin && orgs.length > 0 && !sub && (
          <label className="text-sm">
            <span className="block mb-1 text-piedra">Cliente de FIRMA</span>
            <select
              className="h-11 px-3 bg-white border border-[rgba(27,31,27,0.25)]"
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
        )}
      </div>

      {!orgId ? (
        <p className="text-piedra">Todavía no hay clientes cargados en el portal.</p>
      ) : sub === 'nuevo' ? (
        <AltaCliente orgId={orgId} esAdmin={esAdmin} />
      ) : sub ? (
        <Ficha id={sub} esAdmin={esAdmin} puedeGestionar={puedeGestionar} />
      ) : (
        <Listado orgId={orgId} />
      )}
    </Marco>
  );
};

export default CrmApp;
