/**
 * Evaluador de los agentes de IA del portal (auditoría de la IA, P1).
 *
 *   node --import ./scripts/ia/cargador.mjs scripts/ia/evaluar.mjs [opciones]
 *
 *   --agente tina            Solo esos agentes (se puede repetir o separar con comas)
 *   --actualizar-referencia  Si pasa, guarda el puntaje en scripts/ia/referencias.json
 *   --verificar-referencias  No llama a Claude: falla si un prompt cambió y su
 *                            referencia no (falta medirlo)
 *   --si-cambia              Solo los agentes cuyo prompt no coincide con su referencia
 *   --sin-base               Mide solo contra el umbral, sin la referencia
 *   --base origin/main       Vuelve a correr también la versión de esa base. Gasta
 *                            el doble y no hace falta: la referencia ya la midió
 *   --salida informe.json    Guarda el informe completo
 *   --casos carpeta          Otra carpeta de casos. Por defecto scripts/ia/casos
 *
 * Para cada agente con casos en scripts/ia/casos/*.json:
 *   1. Corre el agente una vez, con el prompt de esta carpeta.
 *   2. Chequeos fijos por código (formato, campos, etiquetas, herramientas).
 *   3. Si el caso tiene rúbrica, Claude como juez dice qué criterios se
 *      cumplen. El puntaje lo calcula el código (scripts/ia/puntaje.mjs).
 *   4. Falla si el puntaje baja más de 2 puntos contra la referencia (el último
 *      puntaje medido, en scripts/ia/referencias.json) o queda debajo del umbral
 *      del agente. Si los casos cambiaron desde la referencia, mide solo contra
 *      el umbral.
 *
 * Archivo de casos: { agente, umbral?, casos: [{ id, etiqueta, entrada, esperado, activo? }] }.
 * El formato de esperado está en components/portal/admin/casosIa.ts. Los
 * que salen de las correcciones de FIRMA se bajan desde Administración ›
 * Calidad de la IA › Casos de prueba.
 *
 * Necesita ANTHROPIC_API_KEY. No toca la base de datos.
 */
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { chequeosFijos, puntajeAgente, puntajeCaso, veredicto, TOLERANCIA } from './puntaje.mjs';
import { juzgar } from './juez.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../..');
const CARGADOR = pathToFileURL(path.join(AQUI, 'cargador.mjs')).href;
const CORRER = path.join(AQUI, 'correr.mjs');
const JUECES_EN_PARALELO = 3;
const REFERENCIAS = path.join(AQUI, 'referencias.json');

/** Qué archivos guían a cada agente. Si ninguno cambió, el prompt no cambió. */
const ARCHIVOS = {
  tina: ['docs/TINA_SYSTEM_PROMPT.md', 'api/_lib/tina/prompt.ts', 'api/_lib/tina/herramientas.ts'],
  analisis_clasificacion: ['docs/ANALIZADOR_VENTA.md', 'api/_lib/analisis/'],
  analisis_venta: ['docs/ANALIZADOR_VENTA.md', 'api/_lib/analisis/'],
};

function opciones(argv) {
  const o = { agentes: [], base: null, siCambia: false, sinBase: false, salida: null, casos: null, actualizar: false, verificar: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--agente') o.agentes.push(...argv[++i].split(','));
    else if (a === '--base') o.base = argv[++i];
    else if (a === '--si-cambia') o.siCambia = true;
    else if (a === '--sin-base') o.sinBase = true;
    else if (a === '--actualizar-referencia') o.actualizar = true;
    else if (a === '--verificar-referencias') o.verificar = true;
    else if (a === '--salida') o.salida = argv[++i];
    else if (a === '--casos') o.casos = path.resolve(argv[++i]);
    else throw new Error(`Opción desconocida: ${a}`);
  }
  return o;
}

const git = (...args) => execFileSync('git', args, { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

/** Casos activos por agente, de todos los archivos de scripts/ia/casos. */
export function leerCasos(carpeta = path.join(AQUI, 'casos')) {
  const porAgente = new Map();
  if (!existsSync(carpeta)) return porAgente;
  for (const nombre of readdirSync(carpeta).filter((n) => n.endsWith('.json')).sort()) {
    const archivo = JSON.parse(readFileSync(path.join(carpeta, nombre), 'utf8'));
    if (!archivo?.agente || !Array.isArray(archivo.casos)) throw new Error(`${nombre} no tiene agente y casos.`);
    const g = porAgente.get(archivo.agente) ?? { umbral: null, casos: [] };
    if (typeof archivo.umbral === 'number') g.umbral = Math.max(g.umbral ?? 0, archivo.umbral);
    for (const c of archivo.casos) {
      if (c.activo === false) continue;
      if (!c.id || !c.entrada || typeof c.esperado !== 'object') throw new Error(`${nombre}: el caso ${c.id ?? '(sin id)'} no tiene id, entrada o esperado.`);
      if (g.casos.some((x) => x.id === c.id)) throw new Error(`${nombre}: el caso ${c.id} está repetido.`);
      g.casos.push(c);
    }
    porAgente.set(archivo.agente, g);
  }
  return porAgente;
}

/**
 * Último puntaje medido de cada agente: { agente: { version, puntaje, casos, n, fecha } }.
 * `version` es la huella del prompt y `casos` la de los casos activos con que se midió.
 */
export function leerReferencias(archivo = REFERENCIAS) {
  if (!existsSync(archivo)) return {};
  return JSON.parse(readFileSync(archivo, 'utf8'));
}

/** Huella de los casos activos de un agente, sin importar el orden de los archivos. */
export function huellaCasos(casos) {
  const orden = [...casos].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return createHash('sha256').update(JSON.stringify(orden.map(({ id, entrada, esperado }) => ({ id, entrada, esperado })))).digest('hex').slice(0, 12);
}

/** Agentes con casos cuyo prompt cambió y no tiene referencia medida. No llama a Claude. */
export function faltanMedir({ agentes, todos, versiones, referencias }) {
  const faltan = [];
  for (const agente of agentes) {
    if (!todos.get(agente)?.casos.length || !versiones[agente]) continue;
    const r = referencias[agente];
    if (!r) faltan.push({ agente, motivo: 'no tiene referencia medida.' });
    else if (r.version !== versiones[agente]) faltan.push({ agente, motivo: `el prompt cambió (${r.version} → ${versiones[agente]}) y no está medido.` });
  }
  return faltan;
}

/** Corre correr.mjs en una carpeta y devuelve lo que escribe. */
function correrEn(cwd, modo, pedido) {
  return new Promise((resolver, rechazar) => {
    const hijo = spawn(process.execPath, ['--import', CARGADOR, CORRER, modo], { cwd, env: process.env, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    hijo.stdout.on('data', (d) => (out += d));
    hijo.stderr.on('data', (d) => (err += d));
    hijo.on('close', (codigo) => {
      if (codigo !== 0) return rechazar(new Error(err.trim().split('\n').slice(-3).join(' ') || `Salió con ${codigo}.`));
      try {
        resolver(JSON.parse(out));
      } catch {
        rechazar(new Error('La corrida no devolvió un JSON.'));
      }
    });
    hijo.stdin.end(pedido ? JSON.stringify(pedido) : '');
  });
}

/** Una copia del repo en la base, con los node_modules de acá. */
function copiaDeLaBase(sha) {
  const dir = mkdtempSync(path.join(tmpdir(), 'firma-ia-base-'));
  const tar = execFileSync('git', ['archive', '--format=tar', sha, 'api', 'docs', 'components', 'lib', 'types.ts', 'package.json'], { cwd: RAIZ, maxBuffer: 512 * 1024 * 1024 });
  execFileSync('tar', ['-x', '-C', dir], { input: tar });
  symlinkSync(path.join(RAIZ, 'node_modules'), path.join(dir, 'node_modules'), 'dir');
  return dir;
}

async function enParalelo(items, cuantos, f) {
  const r = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(cuantos, items.length) }, async () => {
    while (i < items.length) {
      const k = i++;
      r[k] = await f(items[k], k);
    }
  }));
  return r;
}

/** Puntúa las salidas de una versión. */
async function puntuar(api, agente, casos, resultados) {
  const porId = new Map(resultados.map((r) => [r.id, r]));
  const filas = await enParalelo(casos, JUECES_EN_PARALELO, async (c) => {
    const salida = porId.get(c.id)?.salida ?? { error: 'No corrió.' };
    const chequeos = chequeosFijos(agente, salida, c.esperado);
    const rubrica = c.esperado?.rubrica ?? [];
    let veredictos = [];
    let errorJuez = null;
    if (rubrica.length && chequeos.every((x) => x.ok)) {
      try {
        veredictos = await juzgar(api, { agente, entrada: c.entrada, salida, rubrica });
      } catch (e) {
        errorJuez = e instanceof Error ? e.message : String(e);
      }
    }
    return { id: c.id, etiqueta: c.etiqueta, puntaje: puntajeCaso(chequeos, rubrica, veredictos), chequeos, veredictos, errorJuez, salida };
  });
  return { puntaje: puntajeAgente(filas.map((f) => f.puntaje)), casos: filas };
}

function tablaMarkdown(informe) {
  const filas = informe.agentes.map((a) =>
    `| ${a.agente} | ${a.version_nueva ?? '·'} | ${a.casos} | ${a.anterior?.puntaje ?? a.referencia_puntaje ?? '·'} | ${a.nueva?.puntaje ?? '·'} | ${a.umbral ?? '·'} | ${a.ok ? 'Pasa' : 'No pasa'} |`,
  );
  const detalle = informe.agentes.flatMap((a) => [
    ...(a.motivos ?? []).map((m) => `- **${a.agente}**: ${m}`),
    ...(a.nueva?.casos ?? [])
      .filter((c) => c.puntaje < 100)
      .slice(0, 15)
      .map((c) => {
        const fallas = [...c.chequeos.filter((x) => !x.ok).map((x) => `${x.nombre} (${x.detalle ?? 'falla'})`), ...c.veredictos.filter((v) => v.nivel !== 'cumple').map((v) => `${v.id} ${v.nivel}: ${v.motivo}`)];
        return `- ${a.agente} · ${c.id} · ${c.puntaje}: ${fallas.join('; ') || c.errorJuez || 'sin detalle'}`;
      }),
  ]);
  return [
    '## Evaluación de prompts',
    '',
    '| Agente | Versión | Casos | Referencia | Nueva | Umbral | Resultado |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...filas,
    '',
    ...(detalle.length ? ['### Lo que bajó', '', ...detalle] : []),
    '',
  ].join('\n');
}

async function principal() {
  const o = opciones(process.argv.slice(2));
  const todos = o.casos ? leerCasos(o.casos) : leerCasos();
  let agentes = o.agentes.length ? o.agentes : [...todos.keys()];

  const referencias = leerReferencias();
  const nuevas = (await correrEn(RAIZ, 'versiones')).versiones ?? {};

  if (o.verificar) {
    const faltan = faltanMedir({ agentes, todos, versiones: nuevas, referencias });
    if (!faltan.length) {
      console.log('Cada prompt con casos coincide con su referencia medida.');
      return 0;
    }
    const lineas = [...faltan.map((f) => `${f.agente}: ${f.motivo}`), 'Corré GitHub › Actions › Medir IA en esta rama. Si pasa, guarda la referencia nueva y este chequeo pasa.'];
    for (const l of lineas) console.log(l);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Falta medir\n\n${lineas.map((l) => `- ${l}`).join('\n')}\n`);
    return 1;
  }

  // Volver a correr la versión anterior solo si se pide con --base: gasta el doble.
  let baseSha = null;
  if (o.base && !o.sinBase) {
    try {
      baseSha = git('merge-base', o.base, 'HEAD');
    } catch {
      throw new Error(`No encuentro la base ${o.base}.`);
    }
  }
  let copia = null;
  let anteriores = null;
  if (baseSha) {
    copia = copiaDeLaBase(baseSha);
    const borrar = copia;
    process.on('exit', () => rmSync(borrar, { recursive: true, force: true }));
    anteriores = await correrEn(copia, 'versiones').then((r) => r.versiones, () => null);
  }

  if (o.siCambia) agentes = agentes.filter((a) => nuevas[a] && referencias[a]?.version !== nuevas[a]);

  const informe = { fecha: new Date().toISOString(), base: baseSha, agentes: [] };
  let cambioReferencia = false;
  if (!agentes.length) {
    console.log('Ningún prompt cambió. No hay nada para evaluar.');
  } else {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('Falta ANTHROPIC_API_KEY. En GitHub va en Settings › Secrets and variables › Actions.');
    const api = new Anthropic({ maxRetries: 4 });
    for (const agente of agentes) {
      const g = todos.get(agente);
      if (!g?.casos.length) {
        console.log(`${agente}: sin casos de prueba, no se puede medir.`);
        informe.agentes.push({ agente, casos: 0, ok: true, motivos: ['Sin casos de prueba.'] });
        continue;
      }
      const pedido = { agente, casos: g.casos.map((c) => ({ id: c.id, entrada: c.entrada })) };
      console.log(`${agente}: ${g.casos.length} casos, versión ${nuevas[agente] ?? '?'}${copia && !o.sinBase ? ` contra ${anteriores?.[agente] ?? 'la anterior'}` : ''}.`);
      const [corridaNueva, corridaAnterior] = await Promise.all([
        correrEn(RAIZ, 'casos', pedido),
        copia && !o.sinBase ? correrEn(copia, 'casos', pedido).catch((e) => ({ error: e.message })) : Promise.resolve(null),
      ]);
      const nueva = await puntuar(api, agente, g.casos, corridaNueva.resultados);
      const anterior = corridaAnterior?.resultados ? await puntuar(api, agente, g.casos, corridaAnterior.resultados) : null;
      // Contra qué se compara: la versión anterior si se corrió con --base, si no la referencia guardada.
      const ref = referencias[agente] ?? null;
      const huella = huellaCasos(g.casos);
      const refVale = !anterior && !o.sinBase && ref && ref.casos === huella;
      const v = veredicto({ nuevo: nueva.puntaje, anterior: anterior?.puntaje ?? (refVale ? ref.puntaje : null), umbral: g.umbral });
      if (!anterior && !o.sinBase && ref && !refVale) v.motivos.push(`Los casos cambiaron desde la referencia (${ref.puntaje}, ${ref.fecha}). Se compara solo con el umbral.`);
      if (!anterior && !o.sinBase && !ref) v.motivos.push('Sin referencia guardada. Se compara solo con el umbral.');
      if (corridaAnterior?.error) v.motivos.push(`La versión anterior no corrió (${corridaAnterior.error}). Se mide solo contra el umbral.`);
      // Si no se pudo medir, no pasa: un 0 contra 0 por una caída de la API no prueba nada.
      const errores = nueva.casos.filter((c) => c.salida?.error);
      if (errores.length === nueva.casos.length) {
        v.ok = false;
        v.motivos.push(`Ningún caso corrió (${errores[0].salida.error}). Volvé a correrlo.`);
      }
      const sinJuez = [...nueva.casos, ...(anterior?.casos ?? [])].filter((c) => c.errorJuez);
      if (sinJuez.length) {
        v.ok = false;
        v.motivos.push(`El juez no respondió en ${sinJuez.length} casos (${sinJuez[0].errorJuez}). Volvé a correrlo.`);
      }
      informe.agentes.push({
        agente,
        version_nueva: nuevas[agente] ?? null,
        version_anterior: anteriores?.[agente] ?? null,
        casos: g.casos.length,
        umbral: g.umbral,
        referencia_puntaje: refVale ? ref.puntaje : null,
        tolerancia: TOLERANCIA,
        ok: v.ok,
        motivos: v.motivos,
        nueva,
        anterior,
      });
      console.log(`  ${anterior ? 'anterior' : 'referencia'} ${anterior?.puntaje ?? (refVale ? ref.puntaje : '·')} · nueva ${nueva.puntaje} · ${v.ok ? 'pasa' : 'no pasa'}${v.motivos.length ? ` · ${v.motivos.join(' ')}` : ''}`);
      if (o.actualizar && v.ok && nuevas[agente] && (!ref || ref.version !== nuevas[agente] || ref.casos !== huella)) {
        referencias[agente] = { version: nuevas[agente], puntaje: nueva.puntaje, casos: huella, n: g.casos.length, fecha: new Date().toISOString().slice(0, 10) };
        cambioReferencia = true;
        console.log(`  referencia nueva de ${agente}: ${nueva.puntaje}`);
      }
    }
  }

  if (cambioReferencia) writeFileSync(REFERENCIAS, `${JSON.stringify(Object.fromEntries(Object.entries(referencias).sort(([a], [b]) => a.localeCompare(b))), null, 2)}\n`);
  if (o.salida) writeFileSync(o.salida, `${JSON.stringify(informe, null, 2)}\n`);
  if (process.env.GITHUB_STEP_SUMMARY && informe.agentes.length) appendFileSync(process.env.GITHUB_STEP_SUMMARY, tablaMarkdown(informe));
  return informe.agentes.every((a) => a.ok) ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  principal().then(
    (codigo) => process.exit(codigo),
    (e) => {
      console.error(e instanceof Error ? e.message : String(e));
      process.exit(2);
    },
  );
}
