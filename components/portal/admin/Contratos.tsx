import React, { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../../Button';
import { supabase } from '../supabase';
import { Aviso, Etiqueta } from '../ui';
import type { Organizacion } from '../tipos';
import { MODELOS, type ClaveModelo } from '../pedidos/modelos';
import { CampoPregunta, type EsquemaContrato } from '../pedidos/Pedidos';
import { esquemaDe, faltantes, respuestasIniciales, visible, type Respuestas, type Valor } from '../pedidos/formulario';

/**
 * Administración › Contratos. FIRMA precarga las condiciones de los
 * contratos con el equipo de cada cliente (closer, setter) partiendo del
 * modelo que usa FIRMA. El cliente arranca con ellas, solo completa los
 * datos de la persona y lo distinto lo cuenta en las notas (migración 0062).
 */

const ZONA = 'America/Argentina/Buenos_Aires';
const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { timeZone: ZONA, day: 'numeric', month: 'short', year: 'numeric' });

interface Editando {
  org: Organizacion;
  modelo: ClaveModelo;
  existente: EsquemaContrato | null;
}

export const Contratos: React.FC = () => {
  const [orgs, setOrgs] = useState<Organizacion[]>([]);
  const [esquemas, setEsquemas] = useState<EsquemaContrato[]>([]);
  const [editando, setEditando] = useState<Editando | null>(null);
  const [respuestas, setRespuestas] = useState<Respuestas>({});
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    if (!supabase) return;
    const [o, e] = await Promise.all([supabase.from('organizaciones').select('*').order('nombre'), supabase.from('esquemas_contrato').select('*')]);
    if (e.error) setError(`${e.error.message}. Revisá que la migración 0062_contrato_setter.sql esté corrida en Supabase.`);
    setOrgs((o.data as Organizacion[]) ?? []);
    setEsquemas((e.data as EsquemaContrato[]) ?? []);
  }

  useEffect(() => {
    void cargar();
  }, []);

  const esquemaDeOrg = (orgId: string, modelo: ClaveModelo) => esquemas.find((e) => e.organizacion_id === orgId && e.modelo === modelo) ?? null;

  function abrir(org: Organizacion, modelo: ClaveModelo) {
    const existente = esquemaDeOrg(org.id, modelo);
    setRespuestas({ ...respuestasIniciales(MODELOS[modelo]), ...(existente?.respuestas ?? {}) });
    setEditando({ org, modelo, existente });
    setError(null);
    setOk(null);
    window.scrollTo(0, 0);
  }

  async function guardar() {
    if (!supabase || !editando) return;
    const m = MODELOS[editando.modelo];
    // Las notas son del cliente, y las marcas del pedido no van al esquema.
    const datos = Object.fromEntries(Object.entries(esquemaDe(m, respuestas)).filter(([k]) => !k.startsWith('_') && k !== m.claveNotas && k !== `${m.claveNotas}_otra`));
    setGuardando(true);
    setError(null);
    const { error: e } = editando.existente
      ? await supabase.from('esquemas_contrato').update({ respuestas: datos }).eq('id', editando.existente.id)
      : await supabase.from('esquemas_contrato').insert({ organizacion_id: editando.org.id, modelo: m.clave, respuestas: datos });
    setGuardando(false);
    if (e) return setError(e.message);
    setOk(`Guardamos las condiciones del ${m.titulo.toLowerCase()} de ${editando.org.nombre}. El próximo pedido arranca con ellas.`);
    setEditando(null);
    void cargar();
  }

  async function quitar() {
    if (!supabase || !editando?.existente) return;
    if (!window.confirm(`¿Quitar las condiciones de ${editando.org.nombre}? El próximo pedido arranca con las preguntas completas.`)) return;
    const { error: e } = await supabase.from('esquemas_contrato').delete().eq('id', editando.existente.id);
    if (e) return setError(e.message);
    setOk(`Quitamos las condiciones del ${MODELOS[editando.modelo].titulo.toLowerCase()} de ${editando.org.nombre}.`);
    setEditando(null);
    void cargar();
  }

  if (editando) {
    const m = MODELOS[editando.modelo];
    const secciones = m.secciones.filter((s) => !s.porContrato);
    const pendientes = faltantes(m, respuestas).filter((f) => !f.seccion.porContrato);
    const cambiar = (clave: string, valor: Valor) => setRespuestas((r) => ({ ...r, [clave]: valor }));
    return (
      <div className="flex flex-col gap-8 max-w-[760px]">
        <button type="button" onClick={() => setEditando(null)} className="self-start inline-flex items-center gap-2 text-sm text-piedra hover:text-bosque">
          <ArrowLeft size={14} aria-hidden="true" /> Volver a la lista
        </button>
        <div className="flex flex-col gap-3">
          <h2 className="h3">
            {m.titulo} · {editando.org.nombre}
          </h2>
          <p className="text-piedra text-[15px] leading-[1.6]">
            Arranca con el modelo de FIRMA. Cambiá lo que en este negocio sea distinto, sobre todo los honorarios. El cliente ve estas condiciones fijas, completa los datos del {m.persona} y, si algo cambia, lo cuenta en las notas.
          </p>
        </div>
        {editando.existente && !editando.existente.de_firma && (
          <Aviso tipo="info">
            El cliente guardó su propio esquema el {fecha(editando.existente.actualizado_en)} y ya viene cargado acá. Si guardás, pasa a ser precarga de FIRMA y el cliente ya no lo cambia.
          </Aviso>
        )}
        {error && <Aviso tipo="error">{error}</Aviso>}
        {secciones.map((s) => {
          const preguntas = s.preguntas.filter((p) => p.clave !== m.claveNotas && visible(p, respuestas));
          if (!preguntas.length) return null;
          return (
            <section key={s.clave} className="flex flex-col gap-6 border-t border-tinta/12 pt-6">
              <div className="flex flex-col gap-2">
                <h3 className="text-[19px] font-medium">{s.titulo}</h3>
                <p className="text-piedra text-[15px] leading-[1.6]">{s.bajada}</p>
              </div>
              {preguntas.map((p) => (
                <CampoPregunta key={p.clave} pregunta={p} respuestas={respuestas} alCambiar={cambiar} />
              ))}
            </section>
          );
        })}
        {pendientes.length > 0 && (
          <Aviso tipo="info">
            Quedan sin responder: {pendientes.map((f) => f.pregunta.etiqueta.toLowerCase()).join(', ')}. Podés guardar igual: el cliente no las va a poder completar, así que si hacen falta, cargalas ahora.
          </Aviso>
        )}
        <div className="flex flex-wrap gap-3 border-t border-tinta/12 pt-6">
          <Button type="button" onClick={() => void guardar()} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar condiciones'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setEditando(null)}>
            Cancelar
          </Button>
          {editando.existente && (
            <button type="button" onClick={() => void quitar()} className="ml-auto text-sm text-peligro underline underline-offset-4">
              Quitar condiciones
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-piedra text-[15px] leading-[1.6] max-w-[70ch]">
        Precargá las condiciones de los contratos con el equipo de cada cliente. Cuando el cliente pide uno, arranca con estas condiciones fijas, completa los datos de la persona y lo que sea distinto lo cuenta en las notas.
      </p>
      {error && <Aviso tipo="error">{error}</Aviso>}
      {ok && <Aviso tipo="ok">{ok}</Aviso>}
      <div className="overflow-x-auto">
        <table className="tabla min-w-[640px]">
          <thead>
            <tr>
              <th>Cliente</th>
              {Object.values(MODELOS).map((m) => (
                <th key={m.clave}>{m.titulo}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orgs.length === 0 && (
              <tr>
                <td colSpan={1 + Object.keys(MODELOS).length} className="text-piedra">
                  Todavía no hay clientes.
                </td>
              </tr>
            )}
            {orgs.map((o) => (
              <tr key={o.id}>
                <td className="font-heading font-bold text-[16px] leading-tight">{o.nombre}</td>
                {Object.values(MODELOS).map((m) => {
                  const e = esquemaDeOrg(o.id, m.clave);
                  return (
                    <td key={m.clave}>
                      <div className="flex flex-wrap items-center gap-3">
                        {e?.de_firma ? (
                          <Etiqueta tono="bosque">Precargado · {fecha(e.actualizado_en)}</Etiqueta>
                        ) : e ? (
                          <Etiqueta>Del cliente · {fecha(e.actualizado_en)}</Etiqueta>
                        ) : (
                          <span className="text-piedra text-sm">Sin condiciones</span>
                        )}
                        <button type="button" className="text-sm underline underline-offset-4 hover:text-bosque" onClick={() => abrir(o, m.clave)}>
                          {e?.de_firma ? 'Editar' : 'Precargar'}
                        </button>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
