/**
 * Corre los agentes del portal sobre casos de prueba, con el código y los
 * prompts de la carpeta donde se lo llama (process.cwd()). El evaluador lo
 * usa dos veces: con la versión nueva y con la anterior, en una copia del
 * repo en ese commit. Así cada versión corre con su propio prompt.
 *
 *   node --import ./scripts/ia/cargador.mjs scripts/ia/correr.mjs versiones
 *   node --import ./scripts/ia/cargador.mjs scripts/ia/correr.mjs casos < pedido.json
 *     pedido   { agente, casos: [{ id, entrada }] }
 *     salida   { resultados: [{ id, salida }] } por stdout
 *
 * Tina no toca la base: cada herramienta devuelve lo que trae el caso en
 * entrada.herramientas o, si no trae nada, una respuesta simulada.
 */
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const RAIZ = process.cwd();
const cargar = (archivo) => import(pathToFileURL(path.join(RAIZ, archivo)).href);

/** Igual que api/tina/chat.ts. */
const MODELO_TINA = 'claude-opus-5-5';
const VUELTAS_TINA = 4;
const EN_PARALELO = 3;
const ROTULO_ROL = { titular: 'titular', csm: 'account manager', miembro: 'account manager', closer: 'closer', setter: 'setter' };

function simulada(nombre, entrada) {
  switch (nombre) {
    case 'buscar_recurso':
      return JSON.stringify({ resultados: [], nota: 'No hay material cargado sobre esto.' });
    case 'consultar_contrato':
      return JSON.stringify({ resultados: [], nota: 'Los contratos cargados no tienen una cláusula sobre esto.' });
    case 'crear_ficha_cierre': {
      if (entrada?.confirmado) return JSON.stringify({ guardado: true, codigo: 'EV-001', enlace: 'https://www.firmasvc.com/portal/crm/ev-001' });
      const faltan = ['email', 'telefono', 'dni', 'domicilio', 'servicio', 'monto_total', 'fecha_onboarding'].filter((k) => entrada?.[k] === undefined);
      return JSON.stringify({ guardado: false, resumen: entrada, faltan });
    }
    case 'registrar_evento':
      return JSON.stringify({ registrado: true });
    case 'crear_ticket':
      return JSON.stringify({ ticket: 'T-EV-1', responsable: 'Agustín', telefono: '+54 9 11 0000-0000', respuesta: 'dentro del día hábil' });
    default:
      return JSON.stringify({ error: `La herramienta ${nombre} no existe.` });
  }
}

async function tina(api, entrada) {
  const { armarPrompt } = await cargar('api/_lib/tina/prompt.ts');
  const { definiciones, CAMINO_DE } = await cargar('api/_lib/tina/herramientas.ts');
  const plan = entrada.plan === 'starter' ? 'starter' : 'eminent';
  const c = entrada.contexto ?? {};
  const prompt = armarPrompt({
    plan: plan === 'eminent' ? 'Eminent' : 'Starter',
    telefonoResponsable: '+54 9 11 0000-0000',
    clienteNombre: c.cliente_nombre ?? '[empresa]',
    empresa: c.empresa ?? '[empresa]',
    pais: c.pais ?? 'AR',
    tipoSocietario: c.tipo_societario ?? 'sin dato',
    usuarioNombre: '[usuario]',
    usuarioRol: ROTULO_ROL[entrada.rol] ?? 'titular',
    fechaHoraLocal: c.fecha_hora_local ?? 'lunes, 1 de diciembre de 2026, 10:00',
    responsableNombre: 'Agustín',
    casosAbiertos: c.casos_abiertos ?? 'Ninguno.',
    eventosHoy: c.eventos_hoy ?? 'Ninguno.',
    listaContratos: c.lista_contratos ?? '- Contrato de servicios del programa',
  });
  const system = [
    { type: 'text', text: prompt.estatico, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: prompt.contexto },
  ];
  const tools = definiciones(plan);
  const messages = (entrada.mensajes ?? []).map((m) => ({ role: m.autor === 'usuario' ? 'user' : 'assistant', content: m.contenido }));
  const usadas = [];
  let texto = '';
  let camino = 'accionable';
  let modelo = MODELO_TINA;
  for (let vuelta = 0; vuelta < VUELTAS_TINA; vuelta++) {
    const final = await api.beta.messages
      .stream({ model: MODELO_TINA, max_tokens: 16000, output_config: { effort: 'low' }, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default', system, tools, messages })
      .finalMessage();
    modelo = final.model;
    const delTurno = final.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
    texto += delTurno;
    if (final.stop_reason === 'refusal') break;
    if (final.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: final.content });
      continue;
    }
    const pedidas = final.content.filter((b) => b.type === 'tool_use');
    if (!pedidas.length) break;
    messages.push({ role: 'assistant', content: final.content });
    messages.push({
      role: 'user',
      content: pedidas.map((t) => {
        const r = entrada.herramientas?.[t.name] ?? simulada(t.name, t.input);
        if (CAMINO_DE[t.name] && camino !== 'derivacion') camino = CAMINO_DE[t.name];
        usadas.push({ nombre: t.name, entrada: t.input, resultado: r });
        return { type: 'tool_result', tool_use_id: t.id, content: r };
      }),
    });
    if (texto && !texto.endsWith('\n')) texto += '\n\n';
  }
  return { texto: texto.trim(), herramientas: usadas, camino, modelo };
}

async function analisis(_api, entrada) {
  const { analizarLlamada } = await cargar('api/_lib/analisis/analizar.ts');
  const r = await analizarLlamada({
    analisis_id: 'evaluador',
    version: entrada.version ?? 'venta-1.1',
    forzar_venta: Boolean(entrada.forzar_venta),
    titulo: entrada.titulo ?? 'Llamada',
    ocurrida_en: entrada.ocurrida_en ?? '2026-12-01T13:00:00Z',
    duracion_seg: entrada.duracion_seg ?? null,
    fuente: entrada.fuente ?? 'manual',
    contenido: entrada.contenido ?? {},
    equipo: entrada.equipo ?? [],
  });
  const d = r.detalle ?? {};
  return {
    etapa: r.etapa,
    confianza: r.confianza,
    codigos: r.codigos,
    modelo: r.modelo,
    lectura: d.lectura ?? d.etapa_motivo ?? '',
    indicadores: (d.indicadores ?? []).map(({ codigo, intensidad, cita, justificacion }) => ({ codigo, intensidad, cita, justificacion })),
    protectores: (d.protectores ?? []).map(({ codigo, intensidad, cita }) => ({ codigo, intensidad, cita })),
    descartes: d.descartes ?? [],
    pautas: d.pautas ?? [],
  };
}

async function borradores(api, entrada) {
  const m = await cargar('api/_lib/tina/borradores.ts');
  if (typeof m.pedirBorradores !== 'function') throw new Error('Esta versión no expone pedirBorradores.');
  const documento = entrada.documento ? { type: 'text', text: `<documento>\n${entrada.documento}\n</documento>` } : null;
  const lista = await m.pedirBorradores(api, documento, entrada.hilos ?? []);
  return { borradores: lista, hilos: (entrada.hilos ?? []).map((h) => ({ id: h.id })) };
}

export const AGENTES = { tina, analisis_clasificacion: analisis, analisis_venta: analisis, borradores_comentarios: borradores };

export async function versiones() {
  if (!existsSync(path.join(RAIZ, 'api/_lib/ia/versiones.ts'))) return null;
  const v = await cargar('api/_lib/ia/versiones.ts');
  const analizador = v.versionAnalizador('venta-1.1');
  return { tina: v.versionTina(), analisis_clasificacion: analizador, analisis_venta: analizador, borradores_comentarios: v.versionBorradores() };
}

async function casos(pedido) {
  const correrUno = AGENTES[pedido.agente];
  if (!correrUno) throw new Error(`No sé correr ${pedido.agente}.`);
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('Falta ANTHROPIC_API_KEY.');
  const api = new Anthropic({ maxRetries: 4 });
  const resultados = new Array(pedido.casos.length);
  let siguiente = 0;
  async function trabajador() {
    while (siguiente < pedido.casos.length) {
      const i = siguiente++;
      const c = pedido.casos[i];
      const inicio = Date.now();
      try {
        resultados[i] = { id: c.id, salida: await correrUno(api, c.entrada), ms: Date.now() - inicio };
      } catch (e) {
        resultados[i] = { id: c.id, salida: { error: e instanceof Error ? e.message : String(e) }, ms: Date.now() - inicio };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(EN_PARALELO, pedido.casos.length) }, trabajador));
  return { resultados };
}

async function leerEntrada() {
  let t = '';
  for await (const parte of process.stdin) t += parte;
  return JSON.parse(t);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // stdout es solo para el resultado: lo que el código del portal escriba en la consola va a stderr.
  console.log = (...x) => console.error(...x);
  const modo = process.argv[2];
  try {
    const r = modo === 'versiones' ? { versiones: await versiones() } : modo === 'casos' ? await casos(await leerEntrada()) : null;
    if (!r) throw new Error('Modo desconocido. Usá versiones o casos.');
    process.stdout.write(JSON.stringify(r));
  } catch (e) {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  }
}
