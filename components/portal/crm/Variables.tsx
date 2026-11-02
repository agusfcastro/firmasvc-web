import React, { useEffect, useState } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { Button } from '../../Button';
import { supabase } from '../supabase';
import { Aviso, Campo, Encabezado, Enlace, Etiqueta, claseInput } from '../ui';
import { useVistaPrevia } from '../vistaPrevia';
import { BotonCopiar } from './firma';
import { CampoVariable } from './variablesPropias';
import { TIPO_VARIABLE, type AmbitoVariable, type TipoVariable, type VariablePropia } from './tipos';

/**
 * Variables propias de la empresa para los contratos modelo, además de las
 * del sistema. Se escriben en el Word igual, {{DIAS_GARANTIA}}.
 *   negocio  un valor para toda la empresa, que se carga acá
 *   cliente  un valor por cliente, que se carga en su ficha
 * Las define el titular (o FIRMA). Una variable no se borra: se desactiva.
 * El tipo y el ámbito no se cambian después del alta.
 *   /portal/crm/variables
 */

interface Borrador {
  id?: string;
  etiqueta: string;
  clave: string;
  ambito: AmbitoVariable;
  tipo: TipoVariable;
  opciones: string;
  ayuda: string;
  obligatoria: boolean;
  activa: boolean;
}

const VACIO: Borrador = { etiqueta: '', clave: '', ambito: 'negocio', tipo: 'texto', opciones: '', ayuda: '', obligatoria: false, activa: true };

/** "Días de garantía" pasa a DIAS_DE_GARANTIA. */
function claveDe(etiqueta: string): string {
  return etiqueta
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^(\d)/, 'V_$1')
    .slice(0, 40);
}

export const Variables: React.FC<{ orgId: string; orgNombre: string; puedeGestionar: boolean }> = ({ orgId, orgNombre, puedeGestionar }) => {
  const [lista, setLista] = useState<VariablePropia[]>([]);
  const [valores, setValores] = useState<Record<string, unknown>>({});
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const soloLectura = Boolean(useVistaPrevia()) || !puedeGestionar;

  async function cargar() {
    if (!supabase) return;
    const [{ data, error: e }, { data: vals }] = await Promise.all([
      supabase.from('org_variables_def').select('*').eq('organizacion_id', orgId).order('activa', { ascending: false }).order('orden').order('etiqueta'),
      supabase.from('org_variables_valor').select('clave, valor').eq('organizacion_id', orgId),
    ]);
    if (e) setError(e.message);
    setLista((data as VariablePropia[]) ?? []);
    setValores(Object.fromEntries(((vals ?? []) as { clave: string; valor: unknown }[]).map((v) => [v.clave, v.valor])));
  }

  useEffect(() => {
    void cargar();
  }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  const delNegocio = lista.filter((v) => v.ambito === 'negocio' && v.activa);

  async function guardarValores(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setGuardando(true);
    setError(null);
    setOk(null);
    const cargados = delNegocio.filter((v) => valores[v.clave] !== null && valores[v.clave] !== undefined);
    const vacios = delNegocio.filter((v) => !cargados.includes(v)).map((v) => v.clave);
    const r1 = cargados.length
      ? await supabase.from('org_variables_valor').upsert(cargados.map((v) => ({ organizacion_id: orgId, clave: v.clave, valor: valores[v.clave] })))
      : { error: null };
    const r2 = vacios.length ? await supabase.from('org_variables_valor').delete().eq('organizacion_id', orgId).in('clave', vacios) : { error: null };
    setGuardando(false);
    const err = r1.error || r2.error;
    if (err) return setError(err.message);
    setOk('Datos de la empresa guardados. Los contratos nuevos ya salen con estos valores.');
  }

  async function guardarDefinicion(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !borrador) return;
    const etiqueta = borrador.etiqueta.trim();
    const clave = (borrador.clave.trim() || claveDe(etiqueta)).toUpperCase();
    const opciones = borrador.opciones
      .split(/\n|,/)
      .map((o) => o.trim())
      .filter(Boolean);
    if (etiqueta.length < 2) return setError('Poné el nombre de la variable.');
    if (!/^[A-Z][A-Z0-9_]{1,39}$/.test(clave)) return setError('La clave va en mayúsculas, sin espacios ni tildes, y empieza con una letra. Por ejemplo DIAS_GARANTIA.');
    if (borrador.tipo === 'opcion' && opciones.length === 0) return setError('Escribí las opciones, una por renglón.');

    setGuardando(true);
    setError(null);
    setOk(null);
    const datos = {
      etiqueta,
      ayuda: borrador.ayuda.trim() || null,
      opciones: borrador.tipo === 'opcion' ? opciones : null,
      obligatoria: borrador.obligatoria,
      activa: borrador.activa,
    };
    const { error: err } = borrador.id
      ? await supabase.from('org_variables_def').update(datos).eq('id', borrador.id)
      : await supabase.from('org_variables_def').insert({ ...datos, organizacion_id: orgId, clave, ambito: borrador.ambito, tipo: borrador.tipo });
    setGuardando(false);
    if (err) {
      if (/duplicate|unique/i.test(err.message)) return setError(`Ya hay una variable {{${clave}}}.`);
      if (/variable_de_sistema|check/i.test(err.message)) return setError(`{{${clave}}} es una variable del sistema o no es una clave válida. Elegí otra.`);
      return setError(err.message);
    }
    setOk(borrador.id ? 'Variable actualizada.' : `Listo. Usala en el Word como {{${clave}}}.`);
    setBorrador(null);
    void cargar();
  }

  return (
    <>
      <Encabezado
        eyebrow={
          <Enlace a="/portal/crm/servicios" className="inline-flex items-center gap-1.5 hover:text-bosque">
            <ArrowLeft size={13} aria-hidden="true" /> Servicios
          </Enlace>
        }
        titulo={
          <>
            Variables de <span className="text-bosque">{orgNombre}</span>
          </>
        }
        bajada="Datos propios de la empresa para los contratos, además de los del sistema. Se escriben en el Word con llaves dobles."
        acciones={
          !soloLectura && !borrador ? (
            <Button size="lg" onClick={() => setBorrador({ ...VACIO })} className="self-end">
              <Plus size={18} /> Nueva variable
            </Button>
          ) : null
        }
      />
      <div className="wrap py-10 desk:py-12 flex flex-col gap-8">
        {error && <Aviso tipo="error">{error}</Aviso>}
        {ok && <Aviso tipo="ok">{ok}</Aviso>}
        {!puedeGestionar && <Aviso tipo="info">Las variables las define el titular de la empresa.</Aviso>}

        {borrador && (
          <form onSubmit={guardarDefinicion} className="bg-marfil-oscuro p-6 desk:p-8 space-y-5 max-w-[680px]">
            <h2 className="h3">{borrador.id ? 'Editar variable' : 'Nueva variable'}</h2>
            <Campo etiqueta="Nombre">
              <input required className={claseInput} maxLength={80} value={borrador.etiqueta} placeholder="Días de garantía" onChange={(e) => setBorrador({ ...borrador, etiqueta: e.target.value })} />
            </Campo>
            <Campo etiqueta="Clave" ayuda={borrador.id ? 'No se cambia, porque ya puede estar en los modelos.' : 'Es lo que va en el Word. Si la dejás vacía se arma con el nombre.'}>
              <input
                className={`${claseInput} uppercase`}
                disabled={Boolean(borrador.id)}
                maxLength={40}
                value={borrador.clave}
                placeholder={claveDe(borrador.etiqueta) || 'DIAS_GARANTIA'}
                onChange={(e) => setBorrador({ ...borrador, clave: e.target.value })}
              />
            </Campo>
            <div className="grid gap-4 tab:grid-cols-2">
              <Campo etiqueta="De quién es el dato" ayuda={borrador.id ? 'No se cambia después del alta.' : undefined}>
                <select className={claseInput} disabled={Boolean(borrador.id)} value={borrador.ambito} onChange={(e) => setBorrador({ ...borrador, ambito: e.target.value as AmbitoVariable })}>
                  <option value="negocio">De la empresa, uno para todos los contratos</option>
                  <option value="cliente">De cada cliente, se carga en su ficha</option>
                </select>
              </Campo>
              <Campo etiqueta="Tipo" ayuda={borrador.id ? 'No se cambia después del alta.' : undefined}>
                <select className={claseInput} disabled={Boolean(borrador.id)} value={borrador.tipo} onChange={(e) => setBorrador({ ...borrador, tipo: e.target.value as TipoVariable })}>
                  {(Object.keys(TIPO_VARIABLE) as TipoVariable[]).map((t) => (
                    <option key={t} value={t}>
                      {TIPO_VARIABLE[t]}
                    </option>
                  ))}
                </select>
              </Campo>
            </div>
            {borrador.tipo === 'opcion' && (
              <Campo etiqueta="Opciones" ayuda="Una por renglón.">
                <textarea className={`${claseInput} min-h-[96px] py-3`} value={borrador.opciones} onChange={(e) => setBorrador({ ...borrador, opciones: e.target.value })} />
              </Campo>
            )}
            <Campo etiqueta="Ayuda (opcional)" ayuda="Se muestra debajo del campo al cargar el dato.">
              <input className={claseInput} maxLength={300} value={borrador.ayuda} onChange={(e) => setBorrador({ ...borrador, ayuda: e.target.value })} />
            </Campo>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={borrador.obligatoria} onChange={(e) => setBorrador({ ...borrador, obligatoria: e.target.checked })} />
              Obligatoria. Sin este dato, el contrato que la usa no se puede mandar a firmar.
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={borrador.activa} onChange={(e) => setBorrador({ ...borrador, activa: e.target.checked })} />
              Activa. Desactivada deja de completarse en los contratos nuevos.
            </label>
            <div className="flex gap-3">
              <Button type="submit" disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setBorrador(null)}>
                Cancelar
              </Button>
            </div>
          </form>
        )}

        {delNegocio.length > 0 && (
          <form onSubmit={guardarValores} className="bg-white border border-[rgba(27,31,27,0.14)] p-6 desk:p-8 space-y-5 max-w-[680px]">
            <div className="space-y-2">
              <h2 className="h3">Datos de la empresa</h2>
              <p className="text-sm text-piedra">Un valor para todos los contratos.</p>
            </div>
            {delNegocio.map((v) => (
              <Campo key={v.id} etiqueta={`${v.etiqueta}${v.obligatoria ? ' *' : ''}`} ayuda={v.ayuda ?? undefined}>
                <CampoVariable v={v} valor={valores[v.clave] ?? null} deshabilitado={soloLectura} alCambiar={(x) => setValores({ ...valores, [v.clave]: x })} />
              </Campo>
            ))}
            {!soloLectura && (
              <Button type="submit" variant="ghost" disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar datos'}
              </Button>
            )}
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="tabla min-w-[680px]">
            <thead>
              <tr>
                <th>Variable</th>
                <th>De quién</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-piedra">
                    Todavía no hay variables propias. Los modelos usan solo las del sistema.
                  </td>
                </tr>
              )}
              {lista.map((v) => (
                <tr key={v.id}>
                  <td>
                    <div className="font-heading font-bold text-[16px] leading-tight">{v.etiqueta}</div>
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-piedra">{`{{${v.clave}}}`}</code>
                      <BotonCopiar texto={`{{${v.clave}}}`} descripcion={`Copiar {{${v.clave}}}`} />
                    </div>
                  </td>
                  <td>{v.ambito === 'negocio' ? 'Empresa' : 'Cada cliente'}</td>
                  <td>
                    {TIPO_VARIABLE[v.tipo]}
                    {v.obligatoria && <span className="text-xs text-piedra"> · obligatoria</span>}
                  </td>
                  <td>{v.activa ? <Etiqueta tono="bosque">Activa</Etiqueta> : <Etiqueta>Inactiva</Etiqueta>}</td>
                  <td className="text-right">
                    {!soloLectura && (
                      <button
                        type="button"
                        className="underline underline-offset-4 hover:text-bosque"
                        onClick={() =>
                          setBorrador({
                            id: v.id,
                            etiqueta: v.etiqueta,
                            clave: v.clave,
                            ambito: v.ambito,
                            tipo: v.tipo,
                            opciones: (v.opciones ?? []).join('\n'),
                            ayuda: v.ayuda ?? '',
                            obligatoria: v.obligatoria,
                            activa: v.activa,
                          })
                        }
                      >
                        Editar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};
