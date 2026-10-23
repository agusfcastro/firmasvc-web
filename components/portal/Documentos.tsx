import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUpRight, FileSpreadsheet, FileText, Globe, Link2, Presentation } from 'lucide-react';
import { supabase } from './supabase';
import { Aviso, Encabezado, Enlace, Marco } from './ui';
import { useVistaPrevia } from './vistaPrevia';
import { SECCIONES, descargarArchivo, extension, fechaLarga, formatoDe, registrarDescarga, seccionDeRuta, tamano, visibleEnPantalla } from './descargas';
import type { Documento, Organizacion, Perfil } from './tipos';

/**
 * Documentos del cliente en tres secciones, cada una con su ruta, y los
 * protocolos y la formación en una vista aparte.
 *   /portal/documentos          contratos de servicio
 *   /portal/documentos/equipo   contratos con el equipo
 *   /portal/documentos/otros    otros documentos
 *   /portal/protocolos          protocolos y formación (es_protocolo)
 * La base decide qué ve cada usuario. El admin, sin Ver como, ve la biblioteca común.
 */

function iconoDe(d: Documento): React.ElementType {
  if (d.url) {
    if (d.url.startsWith('/')) return Globe;
    return /docs\.google\.com\/spreadsheets/.test(d.url) ? FileSpreadsheet : Link2;
  }
  const ext = extension(d.archivo_nombre);
  if (ext === 'xlsx' || ext === 'xls') return FileSpreadsheet;
  if (ext === 'pptx') return Presentation;
  return FileText;
}

const claseAccion =
  'inline-flex items-center justify-center gap-2 h-11 px-5 bg-marfil text-tinta text-sm font-medium whitespace-nowrap transition-colors duration-150 hover:bg-white disabled:opacity-60 disabled:cursor-wait';
const claseSecundaria =
  'text-sm font-medium text-marfil underline underline-offset-4 decoration-[rgba(245,243,236,0.4)] transition-colors duration-150 hover:decoration-marfil';

export const Documentos: React.FC<{ perfil: Perfil; organizacion: Organizacion | null; ruta: string }> = ({ perfil, organizacion, ruta }) => {
  const vista = useVistaPrevia();
  const [docs, setDocs] = useState<Documento[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bajando, setBajando] = useState<string | null>(null);
  // En Ver como el perfil llega con el rol del cliente, así que esto es el admin mirando la biblioteca común.
  const esAdmin = perfil.rol === 'admin';
  const enProtocolos = ruta === '/portal/protocolos';
  const seccion = seccionDeRuta(ruta);
  const orgId = esAdmin ? null : (organizacion?.id ?? null);

  useEffect(() => {
    if (!supabase) return;
    let vivo = true;
    supabase
      .from('documentos')
      .select('*')
      .eq('activo', true)
      .order('orden')
      .order('titulo')
      .then(({ data, error: e }) => {
        if (!vivo) return;
        if (e) setError(esAdmin ? `${e.message}. Revisá que la migración 0005_documentos.sql esté corrida en Supabase.` : 'No pudimos cargar los documentos. Probá recargar la página.');
        setDocs((data as Documento[]) ?? []);
      });
    return () => {
      vivo = false;
    };
  }, [esAdmin]);

  const disponibles = (docs ?? []).filter((d) => visibleEnPantalla(d, perfil.rol, perfil.areas ?? [], orgId));
  const protocolos = disponibles.filter((d) => d.es_protocolo);
  // Los protocolos tienen su propia vista y no se repiten en las secciones de documentos.
  const visibles = disponibles.filter((d) => !d.es_protocolo);
  const lista = enProtocolos ? protocolos : visibles.filter((d) => d.seccion === seccion.clave);
  const cuenta = (clave: string) => visibles.filter((d) => d.seccion === clave).length;
  // Quien no es titular ve solo las secciones donde tiene documentos y nunca el aviso laboral, que es para el titular.
  const esMiembro = perfil.rol !== 'admin' && perfil.rol !== 'titular';
  const pestanas = esMiembro && docs ? SECCIONES.filter((s) => s.clave === seccion.clave || cuenta(s.clave) > 0) : SECCIONES;
  const mostrarAviso = !(esMiembro && seccion.clave === 'equipo');

  async function descargar(d: Documento) {
    setBajando(d.id);
    setError(null);
    const fallo = await descargarArchivo(d);
    setBajando(null);
    if (fallo) return setError(fallo);
    if (!vista) registrarDescarga(d);
  }

  return (
    <Marco perfil={perfil}>
      {enProtocolos ? (
        <Encabezado
          eyebrow={esAdmin ? 'Protocolos · Biblioteca común' : 'Protocolos'}
          titulo={
            <>
              Protocolos de <span className="text-bosque">{esAdmin ? 'trabajo' : 'tu equipo'}</span>
            </>
          }
          bajada={
            esAdmin
              ? 'Así ven tus clientes los protocolos y la formación. Cada persona ve los de sus áreas.'
              : 'Cómo trabaja cada área de tu equipo, por escrito y con respaldo legal, junto con la formación.'
          }
          acciones={
            esAdmin ? (
              <Enlace a="/portal/admin/documentos" className="inline-flex items-center h-[52px] px-6 text-[15px] font-medium bg-bosque text-marfil transition-colors duration-150 hover:bg-bosque-dark">
                Administrar protocolos
              </Enlace>
            ) : undefined
          }
        />
      ) : (
        <Encabezado
          eyebrow={esAdmin ? 'Documentos · Biblioteca común' : 'Documentos'}
          titulo={
            esAdmin ? (
              <>
                Biblioteca de <span className="text-bosque">documentos</span>
              </>
            ) : (
              <>
                Documentación de <span className="text-bosque">tu empresa</span>
              </>
            )
          }
          bajada={
            esAdmin
              ? 'Así ven tus clientes la biblioteca común. Los documentos exclusivos de cada empresa se ven con Ver como.'
              : 'Modelos redactados para tu negocio y documentación vigente. Cuando FIRMA actualiza un documento, acá ya está la versión nueva.'
          }
          acciones={
            esAdmin ? (
              <Enlace a="/portal/admin/documentos" className="inline-flex items-center h-[52px] px-6 text-[15px] font-medium bg-bosque text-marfil transition-colors duration-150 hover:bg-bosque-dark">
                Administrar documentos
              </Enlace>
            ) : undefined
          }
        />
      )}

      <section className="bg-carbon text-marfil py-14 desk:py-20">
        <div className="wrap flex flex-col gap-10 desk:gap-12">
          {!enProtocolos && (
            <nav aria-label="Secciones de documentos" className="flex gap-7 desk:gap-9 overflow-x-auto scrollbar-hide" style={{ borderBottom: '1px solid rgba(245,243,236,0.15)' }}>
              {pestanas.map((s) => {
                const activa = s.clave === seccion.clave;
                return (
                  <Enlace
                    key={s.clave}
                    a={s.ruta}
                    aria-current={activa ? 'page' : undefined}
                    className={`pb-4 -mb-px text-[15px] font-medium whitespace-nowrap border-b-2 transition-colors duration-150 ${activa ? 'border-marfil text-marfil' : 'border-transparent text-calido hover:text-marfil'}`}
                  >
                    {s.titulo}
                    {docs && <span className="ml-2 tabular-nums text-xs opacity-60">{cuenta(s.clave)}</span>}
                  </Enlace>
                );
              })}
            </nav>
          )}

          {!enProtocolos && (
            <div className="grid gap-8 desk:grid-cols-2 desk:items-end">
              <div className="flex flex-col gap-4">
                <h2 className="h2">{seccion.titulo}</h2>
                <p className="text-calido text-[17px] leading-[1.55] max-w-[48ch]">{seccion.bajada}</p>
              </div>
              {mostrarAviso && (
                <div className="border-l-[3px] border-calido pl-5 flex flex-col gap-2 max-w-[60ch]">
                  <span className="eyebrow text-[11px] text-calido">{seccion.avisoTitulo}</span>
                  <p className="text-[15px] leading-[1.6] text-marfil">{seccion.aviso}</p>
                </div>
              )}
            </div>
          )}

          {error && <Aviso tipo="error">{error}</Aviso>}

          {docs === null ? (
            <p className="eyebrow text-calido">Cargando</p>
          ) : lista.length === 0 ? (
            <div className="flex flex-col gap-4 p-8 desk:p-10 max-w-[680px]" style={{ border: '1px solid rgba(245,243,236,0.12)' }}>
              <p className="h3">{esAdmin ? 'Todavía no cargaste documentos acá' : enProtocolos ? 'Todavía no hay protocolos para tu área' : 'Esta sección todavía no tiene documentos'}</p>
              <p className="text-[15px] leading-[1.6] text-calido">
                {esAdmin ? 'Cargalos desde Administración, en la pestaña Documentos.' : 'Si necesitás un modelo para un caso puntual, contanos en una reunión y lo redactamos.'}
              </p>
              <Enlace a={esAdmin ? '/portal/admin/documentos' : '/portal/agenda'} className={`${claseSecundaria} self-start`}>
                {esAdmin ? 'Cargar documentos' : 'Agendar una reunión'}
              </Enlace>
            </div>
          ) : (
            <div className="grid grid-cols-1 tab:grid-cols-2 gap-5">
              {lista.map((d, i) => {
                const Icono = iconoDe(d);
                const peso = tamano(d.archivo_bytes);
                const version = d.version?.trim().replace(/^v(ersi[oó]n)?\s*/i, '');
                return (
                  <article key={d.id} className="card">
                    <span aria-hidden="true" className="wm">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="relative flex items-center gap-4">
                      <div className="icon-box">
                        <Icono size={26} strokeWidth={1.8} />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <span className="eyebrow text-[11px] text-calido">
                          {formatoDe(d)}
                          {peso ? ` · ${peso}` : ''}
                        </span>
                        {d.organizacion_id && <span className="eyebrow text-[11px] text-marfil">Exclusivo para tu empresa</span>}
                      </div>
                    </div>
                    <h3 className="h3 relative">{d.titulo}</h3>
                    {d.descripcion && <p className="relative text-[15px] leading-[1.6] text-calido">{d.descripcion}</p>}
                    <p className="relative text-[13px] text-calido">
                      {version ? `Versión ${version} · ` : ''}Actualizado el {fechaLarga(d.actualizado_en)}
                    </p>
                    <div className="relative mt-auto pt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
                      {d.archivo_ruta ? (
                        <button type="button" className={claseAccion} onClick={() => descargar(d)} disabled={bajando === d.id} aria-label={`Descargar ${d.titulo}`}>
                          <ArrowDown size={16} aria-hidden="true" />
                          {bajando === d.id ? 'Preparando' : 'Descargar'}
                        </button>
                      ) : d.url ? (
                        <a
                          href={d.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={claseAccion}
                          aria-label={`Abrir ${d.titulo}`}
                          onClick={() => {
                            if (!vista) registrarDescarga(d);
                          }}
                        >
                          <ArrowUpRight size={16} aria-hidden="true" />
                          Abrir
                        </a>
                      ) : null}
                      {!esAdmin && (
                        <Enlace a="/portal/agenda" className={claseSecundaria}>
                          Pedir adaptación
                        </Enlace>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </Marco>
  );
};
