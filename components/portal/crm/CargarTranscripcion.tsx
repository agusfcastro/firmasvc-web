import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../../Button';
import { supabase } from '../supabase';
import { Aviso, Campo, TituloSeccion, claseInput } from '../ui';
import { mensajeAmable } from '../errores';
import { rolDe, type IntegranteEquipo } from './tipos';
import { hablantesDe, leerTranscripcion, sinFalsosHablantes } from './analisis';
import { Selector, Fecha } from '../campos';

/**
 * Cargar a mano una llamada que no vino por Fathom (interaccion_cargar_manual,
 * migración 0067). Se pega la transcripción o se sube el archivo (txt, vtt o
 * srt), se marca quién es el vendedor y quién el prospecto, y se confirma el
 * consentimiento de la grabación. La llamada queda cifrada por 90 días y su
 * análisis entra a la cola.
 */

type Rol = 'vendedor' | 'prospecto' | 'otro' | 'no_es';

const ROLES: [Rol, string][] = [
  ['prospecto', 'Prospecto'],
  ['vendedor', 'Vendedor'],
  ['otro', 'Otra persona'],
  ['no_es', 'No es un nombre'],
];

const MAXIMO_BYTES = 2_000_000;
const claseTextarea = `${claseInput} h-auto min-h-[220px] py-3 leading-[1.5] font-mono text-[13px]`;

function ahoraLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

const bajo = (s: string) => s.trim().toLowerCase();

export const CargarTranscripcion: React.FC<{
  orgId: string;
  equipo: IntegranteEquipo[];
  clientes: { id: string; nombre: string; codigo: string | null }[];
  alCancelar: () => void;
  alCargar: (mensaje: string) => void;
}> = ({ orgId, equipo, clientes, alCancelar, alCargar }) => {
  const [titulo, setTitulo] = useState('');
  const [fecha, setFecha] = useState(ahoraLocal);
  const [miembro, setMiembro] = useState('');
  const [cliente, setCliente] = useState('');
  const [texto, setTexto] = useState('');
  const [roles, setRoles] = useState<Record<string, Rol>>({});
  const [consentimiento, setConsentimiento] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const activos = equipo.filter((m) => m.activo);
  const crudos = useMemo(() => leerTranscripcion(texto), [texto]);
  const hablantes = useMemo(() => hablantesDe(crudos), [crudos]);
  const noSon = useMemo(() => new Set(Object.entries(roles).filter(([, r]) => r === 'no_es').map(([n]) => n)), [roles]);
  const segmentos = useMemo(() => sinFalsosHablantes(crudos, noSon), [crudos, noSon]);

  // Una primera propuesta de roles: quien coincide con el equipo es vendedor; el resto, prospecto.
  useEffect(() => {
    const delEquipo = new Set(activos.flatMap((m) => [bajo(m.nombre), bajo(m.nombre).split(/\s+/)[0]]));
    setRoles((antes) => {
      const nuevos: Record<string, Rol> = {};
      for (const h of hablantes) nuevos[h.nombre] = antes[h.nombre] ?? (delEquipo.has(bajo(h.nombre)) || delEquipo.has(bajo(h.nombre).split(/\s+/)[0]) ? 'vendedor' : 'prospecto');
      return nuevos;
    });
  }, [hablantes]); // eslint-disable-line react-hooks/exhaustive-deps

  const conRol = (r: Rol) => hablantes.some((h) => roles[h.nombre] === r);
  const sinHablantes = texto.trim() && hablantes.length < 2;
  const listo = segmentos.length >= 3 && conRol('vendedor') && conRol('prospecto') && consentimiento && !ocupado;

  async function leerArchivo(archivo: File | null) {
    setError(null);
    if (!archivo) return;
    if (archivo.size > MAXIMO_BYTES) return setError('El archivo es demasiado pesado. Pegá el texto o subí uno de menos de 2 MB.');
    if (!/\.(txt|vtt|srt)$/i.test(archivo.name)) return setError('Subí un archivo de texto (txt, vtt o srt), o pegá la transcripción.');
    setTexto(await archivo.text());
    if (!titulo) setTitulo(archivo.name.replace(/\.(txt|vtt|srt)$/i, ''));
  }

  async function cargar(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !listo) return;
    setOcupado(true);
    setError(null);
    const marcados = Object.fromEntries(Object.entries(roles).filter(([, r]) => r === 'vendedor' || r === 'prospecto'));
    const { error: err } = await supabase.rpc('interaccion_cargar_manual', {
      p_org: orgId,
      p_titulo: titulo.trim() || null,
      p_ocurrida_en: fecha ? new Date(fecha).toISOString() : null,
      p_cliente: cliente || null,
      p_miembro: miembro || null,
      p_contenido: { transcripcion: segmentos, roles: marcados },
    });
    setOcupado(false);
    if (err) return setError(mensajeAmable(err, 'No pudimos cargar la llamada.'));
    alCargar('Cargamos la llamada. El análisis tarda unos minutos y después lo revisa FIRMA.');
  }

  return (
    <section className="flex flex-col gap-6">
      <TituloSeccion eyebrow="Sin Fathom" titulo="Cargar una transcripción" />
      <p className="text-sm text-piedra max-w-[70ch]">
        Para una llamada que no grabó Fathom. Pegá la transcripción o subí el archivo que exporta Zoom, Meet o Teams. Necesitamos saber quién habla en cada parte,
        con el formato «Nombre: lo que dijo» o el del archivo exportado.
      </p>
      {error && <Aviso tipo="error">{error}</Aviso>}
      <form className="flex flex-col gap-5 max-w-[860px]" onSubmit={(e) => void cargar(e)}>
        <div className="grid gap-4 desk:grid-cols-2">
          <Campo etiqueta="Título" ayuda="Opcional. Si no ponés nada, queda «Llamada cargada a mano».">
            <input className={claseInput} value={titulo} maxLength={300} onChange={(e) => setTitulo(e.target.value)} />
          </Campo>
          <Campo etiqueta="Fecha y hora de la llamada">
            <Fecha type="datetime-local" className={claseInput} value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </Campo>
          <Campo etiqueta="Quién vendió">
            <Selector className={claseInput} value={miembro} onChange={(e) => setMiembro(e.target.value)}>
              <option value="">Sin indicar</option>
              {activos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre} · {rolDe(m)}
                </option>
              ))}
            </Selector>
          </Campo>
          <Campo etiqueta="Cliente del CRM" ayuda="Si todavía no compró, dejalo sin cliente y asignalo después.">
            <Selector className={claseInput} value={cliente} onChange={(e) => setCliente(e.target.value)}>
              <option value="">Todavía no es cliente</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                  {c.codigo ? ` (${c.codigo})` : ''}
                </option>
              ))}
            </Selector>
          </Campo>
        </div>

        <Campo etiqueta="Transcripción">
          <textarea
            className={claseTextarea}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={'Martín: Hola, ¿cómo estás?\nSofía: Bien, quería saber cómo funciona el programa.'}
          />
        </Campo>
        <label className="text-sm inline-flex items-center gap-3">
          <span className="underline underline-offset-4 cursor-pointer">Subir un archivo (txt, vtt o srt)</span>
          <input type="file" accept=".txt,.vtt,.srt,text/plain,text/vtt" className="sr-only" onChange={(e) => void leerArchivo(e.target.files?.[0] ?? null)} />
        </label>

        {sinHablantes && (
          <Aviso tipo="info">No encontramos quién habla en cada parte. Revisá que cada intervención empiece con el nombre, como «Sofía: lo que dijo».</Aviso>
        )}

        {hablantes.length >= 2 && (
          <div className="flex flex-col gap-3">
            <p className="text-sm">
              Encontramos {segmentos.length} intervenciones. Marcá quién es quién. Al modelo le llegan los roles, no los nombres.
            </p>
            <div className="overflow-x-auto">
              <table className="tabla min-w-[520px]">
                <thead>
                  <tr>
                    <th>Hablante</th>
                    <th>Intervenciones</th>
                    <th>Rol</th>
                  </tr>
                </thead>
                <tbody>
                  {hablantes.map((h) => (
                    <tr key={h.nombre}>
                      <td>{h.nombre}</td>
                      <td className="tabular-nums">{h.veces}</td>
                      <td>
                        <Selector
                          className={`${claseInput} min-w-[180px]`}
                          aria-label={`Rol de ${h.nombre}`}
                          value={roles[h.nombre] ?? 'prospecto'}
                          onChange={(e) => setRoles({ ...roles, [h.nombre]: e.target.value as Rol })}
                        >
                          {ROLES.map(([r, t]) => (
                            <option key={r} value={r}>
                              {t}
                            </option>
                          ))}
                        </Selector>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(!conRol('vendedor') || !conRol('prospecto')) && <p className="text-sm text-peligro">Tiene que haber al menos un vendedor y un prospecto.</p>}
          </div>
        )}

        <label className="inline-flex items-start gap-2 text-sm max-w-[70ch]">
          <input type="checkbox" className="mt-1" checked={consentimiento} onChange={(e) => setConsentimiento(e.target.checked)} />
          La llamada se grabó con aviso a los participantes y con su consentimiento, incluido que se analiza para el seguimiento del servicio.
        </label>

        <div className="flex gap-3">
          <Button type="submit" size="sm" disabled={!listo}>
            {ocupado ? 'Cargando…' : 'Cargar y analizar'}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={alCancelar}>
            Cancelar
          </Button>
        </div>
      </form>
    </section>
  );
};
