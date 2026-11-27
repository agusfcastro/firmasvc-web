import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '../../Button';
import { supabase } from '../supabase';
import { navegar } from '../navegacion';
import { Aviso, Campo, Encabezado, Enlace, TituloSeccion, claseInput } from '../ui';
import { mensajeAmable } from '../errores';
import { useVistaPrevia } from '../vistaPrevia';
import { generarContratoFirma } from './contratoFirma';
import { rolDe, dinero, hoyISO, nombreMonedaCrm, type IntegranteEquipo, type Servicio, type TipoCliente, type VariablePropia } from './tipos';
import { simboloMoneda } from '../../../api/_lib/variables';
import { CampoVariable, sinVacios } from './variablesPropias';
import { DatosCliente, filaIdentidad } from './DatosCliente';
import { Selector, Fecha } from '../campos';

/** Valor de la lista para asignar a alguien que todavía no está en Equipo. */
const NUEVO = '__nuevo__';

const FECHA_VALIDA = /^\d{4}-\d{2}-\d{2}$/;

function sumarMeses(iso: string, n: number): string {
  if (!FECHA_VALIDA.test(iso)) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1 + n, 1));
  const ultimo = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
  base.setUTCDate(Math.min(d, ultimo));
  return base.toISOString().slice(0, 10);
}

/** Los montos se comparan en centavos para que la suma cierre exacta. */
function aCentavos(v: string): number {
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function aTexto(centavos: number): string {
  return (centavos / 100).toFixed(2).replace(/\.00$/, '');
}

interface Cuota {
  monto: string;
  vencimiento: string;
}

/** Reparte el saldo en partes iguales. La diferencia de redondeo va en la última cuota. */
function repartir(saldo: number, cantidad: number, primera: string): Cuota[] {
  if (saldo <= 0 || cantidad < 1) return [];
  const base = Math.floor(saldo / cantidad);
  const resto = saldo - base * cantidad;
  return Array.from({ length: cantidad }, (_, i) => ({ monto: aTexto(i === cantidad - 1 ? base + resto : base), vencimiento: sumarMeses(primera, i) }));
}

/** Guarda el alta en la pestaña. Sin nombre, mail, documento ni monto no hay nada que guardar. */
function guardarBorrador(clave: string, b: { f: { nombre: string; email: string; dni: string; monto_total: string }; extra: Record<string, unknown>; cuotas: unknown[]; manual: boolean } | null) {
  if (!b) return;
  try {
    if (!b.f.nombre.trim() && !b.f.email.trim() && !b.f.dni.trim() && !b.f.monto_total) window.sessionStorage.removeItem(clave);
    else window.sessionStorage.setItem(clave, JSON.stringify(b));
  } catch {
    /* sin almacenamiento */
  }
}

export const AltaCliente: React.FC<{ orgId: string; esAdmin: boolean; orgNombre: string; cobranza: boolean; monedas: string[] }> = ({ orgId, esAdmin, orgNombre, monedas }) => {
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [equipo, setEquipo] = useState<IntegranteEquipo[]>([]);
  const inicial = () => ({
    tipo: 'persona' as TipoCliente, nombre: '', id_fiscal: '', representante: '', cargo: '', dni: '', email: '', telefono: '', domicilio: '', servicio: '', monto_total: '', moneda: monedas[0] ?? 'USD', modalidad: 'Cuotas' as 'Cuotas' | 'PIF',
    fecha_onboarding: '', closer_id: '', responsable_id: '', closer_nuevo: '', responsable_nuevo: '', notas: '', condiciones: '', anticipo: '', cantidad: '2', primera: hoyISO(),
  });
  const [f, setF] = useState(inicial);
  // Datos propios de la empresa que van por cliente, como el plazo del programa.
  const [variables, setVariables] = useState<VariablePropia[]>([]);
  const [extra, setExtra] = useState<Record<string, unknown>>({});
  const [cuotas, setCuotas] = useState<Cuota[]>([]);
  const [manual, setManual] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [etapa, setEtapa] = useState<'' | 'guardando'>('');
  // Un cliente por nombre en cada empresa (migración 0073). Se avisa mientras se escribe, con la ficha que ya existe.
  const [repetido, setRepetido] = useState<{ id: string; codigo: string | null } | null>(null);
  useEffect(() => {
    const buscado = f.nombre.trim();
    if (!supabase || buscado.length < 3) {
      setRepetido(null);
      return;
    }
    let vivo = true;
    const espera = window.setTimeout(async () => {
      const { data } = await supabase!.rpc('crm_cliente_con_nombre', { org: orgId, buscado });
      if (vivo) setRepetido(((data as { id: string; codigo: string | null }[] | null) ?? [])[0] ?? null);
    }, 350);
    return () => {
      vivo = false;
      window.clearTimeout(espera);
    };
  }, [f.nombre, orgId]);
  const soloLectura = Boolean(useVistaPrevia());

  // Borrador del alta en esta pestaña, por persona y empresa. Si la sesión se corta a mitad del alta,
  // al volver a entrar está todo como lo dejó. Se borra al crear el cliente, al empezar de cero o al tocar Salir.
  const [claveBorrador, setClaveBorrador] = useState<string | null>(null);
  const [recuperado, setRecuperado] = useState(false);
  const creado = useRef(false);
  const ultimo = useRef<{ f: typeof f; extra: Record<string, unknown>; cuotas: Cuota[]; manual: boolean } | null>(null);
  useEffect(() => {
    if (soloLectura || !supabase) return;
    let vivo = true;
    void supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user.id;
      if (!vivo || !uid) return;
      const clave = `firma-alta-borrador:${uid}:${orgId}`;
      try {
        const guardado = window.sessionStorage.getItem(clave);
        const b = guardado ? (JSON.parse(guardado) as typeof ultimo.current) : null;
        if (b?.f) {
          setF((x) => ({ ...x, ...b.f }));
          setExtra(b.extra ?? {});
          if (b.manual) {
            setManual(true);
            setCuotas(b.cuotas ?? []);
          }
          setRecuperado(true);
        }
      } catch {
        /* sin almacenamiento o borrador ilegible: se empieza de cero */
      }
      setClaveBorrador(clave);
    });
    return () => {
      vivo = false;
    };
  }, [orgId, soloLectura]);
  useEffect(() => {
    ultimo.current = { f, extra, cuotas, manual };
    if (!claveBorrador || creado.current) return;
    const t = window.setTimeout(() => guardarBorrador(claveBorrador, ultimo.current), 400);
    return () => window.clearTimeout(t);
  }, [claveBorrador, f, extra, cuotas, manual]);
  // Al salir de la pantalla (también cuando la sesión se corta) se guarda lo último, sin esperar.
  useEffect(() => () => {
    if (claveBorrador && !creado.current) guardarBorrador(claveBorrador, ultimo.current);
  }, [claveBorrador]);
  function empezarDeCero() {
    if (claveBorrador) {
      try {
        window.sessionStorage.removeItem(claveBorrador);
      } catch {
        /* nada */
      }
    }
    setF(inicial());
    setExtra({});
    setManual(false);
    setRecuperado(false);
  }
  // Las monedas de la empresa llegan después del primer render. Si la elegida no está habilitada, se usa la primera.
  const claveMonedas = monedas.join(',');
  useEffect(() => {
    setF((x) => (monedas.includes(x.moneda) ? x : { ...x, moneda: monedas[0] ?? 'USD' }));
  }, [claveMonedas]); // eslint-disable-line react-hooks/exhaustive-deps
  const simbolo = simboloMoneda(f.moneda);

  useEffect(() => {
    supabase
      ?.from('crm_servicios')
      .select('*')
      .eq('organizacion_id', orgId)
      .eq('activo', true)
      .order('clave')
      .then(({ data }) => setServicios((data as Servicio[]) ?? []));
    supabase
      ?.from('equipo_miembros')
      .select('*')
      .eq('organizacion_id', orgId)
      .eq('activo', true)
      .order('nombre')
      .then(({ data }) => setEquipo((data as IntegranteEquipo[]) ?? []));
    supabase
      ?.from('org_variables_def')
      .select('*')
      .eq('organizacion_id', orgId)
      .eq('ambito', 'cliente')
      .eq('activa', true)
      .order('orden')
      .order('etiqueta')
      .then(({ data }) => setVariables((data as VariablePropia[]) ?? []));
  }, [orgId]);

  // PIF es pago total ya abonado: no se pregunta cuánto pagó ni cuándo vence un saldo, porque no hay saldo.
  // Se registra un solo pago por el total, como abonado al contratar.
  const esPif = f.modalidad === 'PIF';
  const total = aCentavos(f.monto_total);
  const anticipo = esPif ? total : aCentavos(f.anticipo);
  const cantidad = Math.max(1, Math.min(36, parseInt(f.cantidad, 10) || 1));

  // Mientras no se toquen las cuotas a mano, el plan se reparte solo.
  useEffect(() => {
    if (manual) return;
    setCuotas(esPif ? [] : repartir(total - anticipo, cantidad, f.primera));
  }, [manual, esPif, total, anticipo, cantidad, f.primera]);

  // Validación. Anticipo más la suma de las cuotas tiene que dar el monto acordado.
  const montos = cuotas.map((c) => aCentavos(c.monto));
  const sumaCuotas = montos.reduce((a, b) => a + b, 0);
  const suma = anticipo + sumaCuotas;
  const diferencia = total - suma;
  let problema: string | null = null;
  if (total <= 0) problema = esPif ? 'Cargá el monto total que pagó.' : 'Cargá el monto total acordado para armar el plan.';
  else if (anticipo > total) problema = 'El anticipo supera el monto total acordado.';
  else if (montos.some((m) => m <= 0)) problema = 'Cada cuota necesita un monto mayor a cero.';
  else if (cuotas.some((c) => !FECHA_VALIDA.test(c.vencimiento))) problema = 'Cada cuota necesita su fecha de vencimiento.';
  else if (diferencia !== 0)
    problema = `Anticipo más cuotas suman ${dinero(suma / 100, f.moneda)} y el monto acordado es ${dinero(total / 100, f.moneda)}. ${diferencia > 0 ? 'Faltan' : 'Sobran'} ${dinero(Math.abs(diferencia) / 100, f.moneda)}.`;
  const valido = problema === null;
  const tonoResumen = valido ? 'ok' : total <= 0 ? 'info' : 'error';

  function editarCuota(i: number, cambios: Partial<Cuota>) {
    setManual(true);
    setCuotas(cuotas.map((c, j) => (j === i ? { ...c, ...cambios } : c)));
  }

  function quitarCuota(i: number) {
    setManual(true);
    setCuotas(cuotas.filter((_, j) => j !== i));
  }

  function agregarCuota() {
    setManual(true);
    const ultima = cuotas[cuotas.length - 1]?.vencimiento;
    setCuotas([...cuotas, { monto: diferencia > 0 ? aTexto(diferencia) : '', vencimiento: ultima ? sumarMeses(ultima, 1) : f.primera }]);
  }

  function cambiarPrimera(v: string) {
    setF({ ...f, primera: v });
    // Con cuotas editadas a mano se corren las fechas y se respetan los montos.
    if (manual && FECHA_VALIDA.test(v)) setCuotas(cuotas.map((c, i) => ({ ...c, vencimiento: sumarMeses(v, i) })));
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    if (!valido) return setError(problema);
    if (repetido) return setError('Ya hay un cliente con ese nombre en la empresa. Abrí su ficha o sumale un segundo apellido.');
    const datosExtra = sinVacios(extra);
    const sinCargar = variables.filter((v) => v.obligatoria && !(v.clave in datosExtra));
    if (sinCargar.length) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return setError(`Falta elegir ${sinCargar.map((v) => v.etiqueta).join(', ')}. Sin ese dato el contrato sale incompleto.`);
    }
    setEtapa('guardando');
    setError(null);
    // Quien todavía no está en Equipo se suma ahora. Si ya hay alguien con ese nombre, se usa ese.
    const asignados: Record<'closer_id' | 'responsable_id', string | null> = { closer_id: f.closer_id || null, responsable_id: f.responsable_id || null };
    for (const [campo, nuevo, rol] of [
      ['closer_id', f.closer_nuevo, 'closer'],
      ['responsable_id', f.responsable_nuevo, 'account_manager'],
    ] as const) {
      if (f[campo] !== NUEVO) continue;
      const { data: idNuevo, error: eq } = await supabase.rpc('equipo_sumar', { org: orgId, nombre: nuevo.trim(), rol });
      if (eq || !idNuevo) {
        setEtapa('');
        return setError(mensajeAmable(eq, 'No se pudo sumar a la persona al equipo.'));
      }
      asignados[campo] = idNuevo as string;
    }
    const { data, error: e1 } = await supabase
      .from('crm_clientes')
      .insert({
        organizacion_id: orgId,
        ...filaIdentidad(f),
        servicio: f.servicio || null,
        monto_total: total / 100,
        moneda: f.moneda,
        modalidad: f.modalidad,
        fecha_onboarding: f.fecha_onboarding ? new Date(f.fecha_onboarding).toISOString() : null,
        ...asignados,
        notas: f.notas.trim() || null,
        condiciones: f.condiciones.trim() || null,
        datos_extra: datosExtra,
      })
      .select('id')
      .single();
    if (e1 || !data) {
      setEtapa('');
      return setError(mensajeAmable(e1, 'No se pudo crear el cliente.'));
    }
    const filas = [
      ...(anticipo > 0 ? [{ cliente_id: data.id, organizacion_id: orgId, monto: anticipo / 100, estado: 'pagado', fecha_pago: hoyISO(), nota: esPif ? 'Pago total' : 'Anticipo' }] : []),
      ...cuotas.map((c) => ({ cliente_id: data.id, organizacion_id: orgId, monto: aCentavos(c.monto) / 100, vencimiento: c.vencimiento, estado: 'pendiente' })),
    ];
    let planOk = true;
    if (filas.length) {
      const { error: e2 } = await supabase.from('crm_pagos').insert(filas);
      planOk = !e2;
    }
    // El contrato se arma con el plan completo y no se espera: la ficha muestra el estado,
    // la vista previa y el botón para mandarlo a firmar.
    if (planOk) void generarContratoFirma(data.id);
    creado.current = true;
    if (claveBorrador) {
      try {
        window.sessionStorage.removeItem(claveBorrador);
      } catch {
        /* nada */
      }
    }
    setEtapa('');
    navegar(`/portal/crm/${data.id}${planOk ? '?armando=1' : ''}`);
  }

  const set = (k: keyof typeof f, v: string) => setF({ ...f, [k]: v });

  if (soloLectura)
    return (
      <div className="wrap py-14">
        <Aviso tipo="info">En la vista previa no se pueden crear clientes.</Aviso>
      </div>
    );

  const estiloResumen = {
    ok: 'border-bosque bg-bosque-suave text-bosque',
    error: 'border-peligro bg-peligro-suave text-peligro-fuerte',
    info: 'border-tinta bg-marfil-oscuro text-tinta',
  }[tonoResumen];

  return (
    <>
    <Encabezado
      eyebrow={
        <Enlace a="/portal/crm" className="inline-flex items-center gap-1.5 hover:text-bosque">
          <ArrowLeft size={13} aria-hidden="true" /> {orgNombre || 'CRM'}
        </Enlace>
      }
      titulo={
        <>
          Nuevo <span className="text-bosque">cliente</span>
        </>
      }
      bajada="Cargá los datos y el plan de pagos. Al crear el cliente se arma el contrato con el modelo del servicio, listo para revisar y mandar a firmar."
    />
    <form onSubmit={guardar} className="wrap py-10 desk:py-14 flex flex-col gap-10 max-w-[860px] desk:ml-0">
      <TituloSeccion eyebrow="Paso 1" titulo="Datos del cliente" />
      {error && <Aviso tipo="error">{error}</Aviso>}
      {recuperado && (
        <Aviso tipo="info">
          Recuperamos lo que estabas cargando. Revisalo antes de crear el cliente o{' '}
          <button type="button" onClick={empezarDeCero} className="underline underline-offset-4 font-medium">
            empezá de cero
          </button>
          .
        </Aviso>
      )}
      {!esAdmin && (
        <Aviso tipo="info">
          El cliente queda con la firma pendiente. El contrato se arma solo, FIRMA lo revisa, lo envía a firmar y actualiza el estado.
        </Aviso>
      )}

      <DatosCliente d={f} alCambiar={set} mailObligatorio nombreGrupo="tipo-alta" />
      {repetido && (
        <Aviso tipo="error">
          Ya hay un cliente con ese nombre en {orgNombre || 'la empresa'}.{' '}
          <Enlace a={`/portal/crm/${repetido.id}`} className="underline underline-offset-4">
            Abrir su ficha{repetido.codigo ? ` ${repetido.codigo}` : ''}
          </Enlace>
          . Si es otra persona, sumale el segundo apellido.
        </Aviso>
      )}

      <div className="grid gap-5 tab:grid-cols-2">
        <Campo etiqueta="Servicio">
          <Selector
            required
            className={claseInput}
            value={f.servicio}
            onChange={(e) => {
              const s = servicios.find((x) => x.clave === e.target.value);
              // El servicio trae su moneda. El ticket se precarga solo si queda en esa misma moneda.
              const moneda = s?.moneda && monedas.includes(s.moneda) ? s.moneda : f.moneda;
              const precio = s?.precio && (s.moneda ?? 'USD') === moneda ? String(s.precio) : f.monto_total;
              setF({ ...f, servicio: e.target.value, moneda, monto_total: precio });
            }}
          >
            <option value="">Elegí</option>
            {servicios.map((s) => (
              <option key={s.id} value={s.clave}>
                {s.clave}
                {s.nombre ? ` · ${s.nombre}` : ''}
              </option>
            ))}
          </Selector>
        </Campo>
        {monedas.length > 1 && (
          <Campo etiqueta="Moneda" ayuda="Es la del contrato y la del plan de pagos.">
            <Selector className={claseInput} value={f.moneda} onChange={(e) => set('moneda', e.target.value)}>
              {monedas.map((m) => (
                <option key={m} value={m}>
                  {nombreMonedaCrm(m)}
                </option>
              ))}
            </Selector>
          </Campo>
        )}
        <Campo etiqueta={`Monto total acordado (${simbolo})`} ayuda="Arranca con el ticket del servicio, si tiene. Cambialo si hubo descuento.">
          <input required type="number" step="0.01" min="1" className={claseInput} value={f.monto_total} onChange={(e) => set('monto_total', e.target.value)} />
        </Campo>
        <Campo etiqueta="Onboarding">
          <Fecha type="datetime-local" className={claseInput} value={f.fecha_onboarding} onChange={(e) => set('fecha_onboarding', e.target.value)} />
        </Campo>
        {(
          [
            ['closer_id', 'Closer', ['closer']],
            ['responsable_id', 'Account Manager', ['account_manager']],
          ] as const
        ).map(([campo, etiqueta, roles]) => {
          // Primero los de ese rol; si no hay ninguno, cualquiera del equipo con su rol al lado.
          const delRol = equipo.filter((m) => (roles as readonly string[]).includes(m.rol_comercial));
          const otros = equipo.filter((m) => !delRol.includes(m));
          const campoNuevo = campo === 'closer_id' ? 'closer_nuevo' : 'responsable_nuevo';
          return (
            <Campo key={campo} etiqueta={etiqueta}>
              <div className="flex flex-col gap-2">
                <Selector className={claseInput} value={f[campo]} onChange={(e) => set(campo, e.target.value)}>
                  <option value="">Sin asignar</option>
                  {delRol.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre}
                    </option>
                  ))}
                  {otros.length > 0 && (
                    <optgroup label="Otros del equipo">
                      {otros.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nombre} · {rolDe(m)}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <option value={NUEVO}>+ Alguien que no está en el equipo</option>
                </Selector>
                {f[campo] === NUEVO && (
                  <input
                    required
                    autoFocus
                    className={claseInput}
                    maxLength={120}
                    placeholder="Nombre y apellido"
                    aria-label={`Nombre del ${etiqueta.toLowerCase()}`}
                    value={f[campoNuevo]}
                    onChange={(e) => set(campoNuevo, e.target.value)}
                  />
                )}
              </div>
            </Campo>
          );
        })}
      </div>
      {(f.closer_id === NUEVO || f.responsable_id === NUEVO) && (
        <p className="text-sm text-piedra -mt-6">
          Al crear el cliente, la persona queda en{' '}
          <Enlace a="/portal/crm/equipo" className="underline underline-offset-4 hover:text-bosque">
            Equipo
          </Enlace>
          . Si ya tiene cuenta en el portal o la abre después, se une sola por el nombre.
        </p>
      )}

      {variables.length > 0 && (
        <div className="grid gap-5 tab:grid-cols-2 pt-6 border-t border-tinta/15">
          <p className="tab:col-span-2 eyebrow text-piedra">Datos propios de la empresa</p>
          {variables.map((v) => (
            <Campo key={v.id} etiqueta={`${v.etiqueta}${v.obligatoria ? ' *' : ''}`} ayuda={v.ayuda ?? undefined}>
              <CampoVariable v={v} valor={extra[v.clave] ?? null} alCambiar={(x) => setExtra({ ...extra, [v.clave]: x })} />
            </Campo>
          ))}
        </div>
      )}

      <fieldset className="flex flex-col gap-6 pt-8 min-w-0 border-t border-tinta/15">
        <TituloSeccion eyebrow="Paso 2" titulo="Plan de pagos" />
        <div className="grid gap-5 tab:grid-cols-2 desk:grid-cols-4">
          <Campo etiqueta="Modalidad">
            <Selector
              className={claseInput}
              value={f.modalidad}
              onChange={(e) => {
                set('modalidad', e.target.value);
                setManual(false);
              }}
            >
              <option value="Cuotas">Cuotas</option>
              <option value="PIF">PIF (pago total)</option>
            </Selector>
          </Campo>
          {!esPif && (
            <Campo etiqueta={`Anticipo (${simbolo}) *`} ayuda="* Todo lo que se pague antes del día del onboarding.">
              <input
                type="number"
                step="0.01"
                min="0"
                className={claseInput}
                title="Todo lo que se pague antes del día del onboarding."
                value={f.anticipo}
                onChange={(e) => set('anticipo', e.target.value)}
              />
            </Campo>
          )}
          {!esPif && (
            <Campo etiqueta="Cantidad de cuotas">
              <input
                type="number"
                min="1"
                max="36"
                className={claseInput}
                value={f.cantidad}
                onChange={(e) => {
                  set('cantidad', e.target.value);
                  setManual(false);
                }}
              />
            </Campo>
          )}
          {!esPif && (
            <Campo etiqueta="Primera cuota">
              <Fecha type="date" className={claseInput} value={f.primera} onChange={(e) => cambiarPrimera(e.target.value)} />
            </Campo>
          )}
        </div>

        {!esPif && (
        <div className="flex flex-col gap-3">
          {cuotas.length > 0 && (
            <div className="grid grid-cols-[36px_minmax(0,1fr)_minmax(0,1fr)_44px] gap-3 text-[12.5px] font-medium text-piedra">
              <span>#</span>
              <span>Monto ({simbolo})</span>
              <span>Vencimiento</span>
              <span />
            </div>
          )}
          {cuotas.map((c, i) => (
            <div key={i} className="grid grid-cols-[36px_minmax(0,1fr)_minmax(0,1fr)_44px] gap-3 items-center">
              <span className="font-heading font-black text-[20px] text-bosque tabular-nums">{i + 1}</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                aria-label={`Monto de la cuota ${i + 1}`}
                className={claseInput}
                value={c.monto}
                onChange={(e) => editarCuota(i, { monto: e.target.value })}
              />
              <Fecha
                aria-label={`Vencimiento de la cuota ${i + 1}`}
                className={claseInput}
                value={c.vencimiento}
                onChange={(e) => editarCuota(i, { vencimiento: e.target.value })}
              />
              <button
                type="button"
                aria-label={`Quitar la cuota ${i + 1}`}
                title="Quitar cuota"
                onClick={() => quitarCuota(i)}
                className="h-12 w-11 inline-flex items-center justify-center text-piedra hover:text-peligro transition-colors duration-150"
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </div>
          ))}
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="ghost" size="sm" onClick={agregarCuota}>
              <Plus size={16} /> Agregar cuota
            </Button>
            {manual && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setManual(false)}>
                <RotateCcw size={16} /> Repartir el saldo en partes iguales
              </Button>
            )}
          </div>
        </div>
        )}

        <div role="status" aria-live="polite" className={`border-l-[3px] px-4 py-3 text-sm leading-[1.5] ${estiloResumen}`}>
          {esPif ? (
            <p className="font-medium">{problema ?? `Pago total de ${dinero(total / 100, f.moneda)}, registrado como abonado al contratar.`}</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-x-6 gap-y-1 tabular-nums">
                <span>Anticipo {dinero(anticipo / 100, f.moneda)}</span>
                <span>
                  Cuotas {dinero(sumaCuotas / 100, f.moneda)} en {cuotas.length} {cuotas.length === 1 ? 'pago' : 'pagos'}
                </span>
                <span>
                  Total {dinero(suma / 100, f.moneda)} de {dinero(total / 100, f.moneda)}
                </span>
              </div>
              <p className="mt-1 font-medium">{problema ?? 'El plan cierra exacto con el monto acordado.'}</p>
            </>
          )}
        </div>
        {!esPif && <p className="text-xs text-piedra">Después podés ajustar montos y fechas de cada cuota desde la ficha.</p>}
      </fieldset>

      <Campo
        etiqueta="Condiciones acordadas (opcional)"
        ayuda="Va tal cual al contrato, como cláusula de condiciones particulares, y nadie lo reescribe. Escribilo como querés que lo lea el cliente, con montos, plazos y fechas concretas. Si no sabés cómo ponerlo, pedinos la redacción antes de mandar a firmar."
      >
        <textarea
          rows={3}
          className={`${claseInput} h-auto py-2`}
          placeholder="Ej. Si EL CLIENTE abona el total dentro de las 48 horas de la firma, se bonifica el 10% del precio."
          value={f.condiciones}
          onChange={(e) => set('condiciones', e.target.value)}
        />
      </Campo>

      <Campo etiqueta="Notas">
        <textarea rows={3} className={`${claseInput} h-auto py-2`} value={f.notas} onChange={(e) => set('notas', e.target.value)} />
      </Campo>

      <div className="flex flex-col gap-3 items-start">
        <Button type="submit" size="lg" disabled={!valido || etapa !== '' || Boolean(repetido)} className="disabled:opacity-45 disabled:cursor-not-allowed">
          {etapa === 'guardando' ? 'Guardando…' : 'Crear cliente'}
        </Button>
        {!valido && <p className="text-xs text-piedra">{esPif ? 'Se habilita cuando cargás el monto total.' : 'Se habilita cuando anticipo más cuotas suman exacto el monto acordado.'}</p>}
      </div>
    </form>
    </>
  );
};
