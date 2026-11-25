/**
 * Evaluador de los agentes de IA del portal (auditoría de la IA, P1).
 *
 *   node --import ./scripts/ia/cargador.mjs scripts/ia/evaluar.mjs [opciones]
 *
 *   --agente tina         Solo esos agentes (se puede repetir o separar con comas)
 *   --base origin/main    Contra qué versión comparar. Por defecto origin/main
 *   --si-cambia           Solo los agentes cuyo prompt cambió desde la base
 *   --sin-base            No corre la versión anterior: mide contra el umbral
 *   --salida informe.json Guarda el informe completo
 *   --casos carpeta       Otra carpeta de casos. Por defecto scripts/ia/casos
 *
 * Para cada agente con casos en scripts/ia/casos/*.json:
 *   1. Corre el agente con la versión nueva (esta carpeta) y con la anterior
 *      (una copia del repo en la base), cada una con su propio prompt.
 *   2. Chequeos fijos por código (formato, campos, etiquetas, herramientas).
 *   3. Si el caso tiene rúbrica, Claude como juez dice qué criterios se
 *      cumplen. El puntaje lo calcula el código (scripts/ia/puntaje.mjs).
 *   4. Falla si el puntaje nuevo baja más de 2 puntos contra el anterior o
 *      queda debajo del umbral del agente, si el archivo de casos lo fija.
 *
 * Archivo de casos: { agente, umbral?, casos: [{ id, etiqueta, entrada, esperado, activo? }] }.
 * El formato de esperado está en components/portal/admin/casosIa.ts. Los
 * que salen de las correcciones de FIRMA se bajan desde Administración ›
 * Calidad de la IA › Casos de prueba.
 *
 * Necesita ANTHROPIC_API_KEY. No toca la base de datos.
 */
import { spawn, execFileSync } from 'node:child_process';
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

/** Qué archivos guían a cada agente. Si ninguno cambió, el prompt no cambió. */
const ARCHIVOS = {
  tina: ['docs/TINA_SYSTEM_PROMPT.md', 'api/_lib/tina/prompt.ts', 'api/_lib/tina/herramientas.ts'],
  analisis_clasificacion: ['docs/ANALIZADOR_VENTA.md', 'api/_lib/analisis/'],
  analisis_venta: ['docs/ANALIZADOR_VENTA.md', 'api/_lib/analisis/'],
  borradores_comentarios: ['api/_lib/tina/borradores.ts'],
};

function opciones(argv) {
  const o = { agentes: [], base: null, siCambia: false, sinBase: false, salida: null, casos: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--agente') o.agentes.push(...argv[++i].split(','));
    else if (a === '--base') o.base = argv[++i];
    else if (a === '--si-cambia') o.siCambia = true;
    else if (a === '--sin-base') o.sinBase = true;
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
    `| ${a.agente} | ${a.version_nueva ?? '·'} | ${a.casos} | ${a.anterior?.puntaje ?? '·'} | ${a.nueva?.puntaje ?? '·'} | ${a.umbral ?? '·'} | ${a.ok ? 'Pasa' : 'No pasa'} |`,
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
    '| Agente | Versión | Casos | Anterior | Nueva | Umbral | Resultado |',
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

  let baseSha = null;
  if (!o.sinBase || o.siCambia) {
    const ref = o.base ?? 'origin/main';
    try {
      baseSha = git('merge-base', ref, 'HEAD');
    } catch {
      throw new Error(`No encuentro la base ${ref}. Pasá --base o --sin-base.`);
    }
  }

  const nuevas = (await correrEn(RAIZ, 'versiones')).versiones ?? {};
  let copia = null;
  let anteriores = null;
  if (baseSha) {
    copia = copiaDeLaBase(baseSha);
    const borrar = copia;
    process.on('exit', () => rmSync(borrar, { recursive: true, force: true }));
    anteriores = await correrEn(copia, 'versiones').then((r) => r.versiones, () => null);
  }

  if (o.siCambia) {
    const cambiados = new Set([...git('diff', '--name-only', `${baseSha}...HEAD`).split('\n'), ...git('diff', '--name-only', 'HEAD').split('\n')].filter(Boolean));
    agentes = agentes.filter((a) => {
      const tocado = (ARCHIVOS[a] ?? []).some((p) => [...cambiados].some((f) => (p.endsWith('/') ? f.startsWith(p) : f === p)));
      const misma = anteriores?.[a] && nuevas[a] && anteriores[a] === nuevas[a];
      return tocado && !misma;
    });
  }

  const informe = { fecha: new Date().toISOString(), base: baseSha, agentes: [] };
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
      const v = veredicto({ nuevo: nueva.puntaje, anterior: anterior?.puntaje ?? null, umbral: g.umbral });
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
        tolerancia: TOLERANCIA,
        ok: v.ok,
        motivos: v.motivos,
        nueva,
        anterior,
      });
      console.log(`  anterior ${anterior?.puntaje ?? '·'} · nueva ${nueva.puntaje} · ${v.ok ? 'pasa' : 'no pasa'}${v.motivos.length ? ` · ${v.motivos.join(' ')}` : ''}`);
    }
  }

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
