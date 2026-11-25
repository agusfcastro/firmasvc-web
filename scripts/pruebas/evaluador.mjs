/**
 * Pruebas del evaluador de la IA (scripts/ia), sin llamar a Claude: los
 * chequeos fijos, el puntaje que calcula el código con los veredictos del
 * juez, la comparación con la versión anterior y la lectura de los casos.
 *
 *   node --import ./scripts/ia/cargador.mjs scripts/pruebas/evaluador.mjs
 */
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chequeosFijos, puntajeAgente, puntajeCaso, puntajeRubrica, veredicto } from '../ia/puntaje.mjs';
import { faltanMedir, huellaCasos, leerCasos } from '../ia/evaluar.mjs';
import { AGENTES } from '../ia/correr.mjs';
import { anonimizador } from '../../api/_lib/ia/anonimizar.ts';
import { esperadoDesde, problemaDeEntrada, archivoParaEvaluador } from '../../components/portal/admin/casosIa.ts';

let hechas = 0;
const prueba = (nombre, f) => {
  f();
  hechas++;
  console.log(`✓ ${nombre}`);
};

// Dos casos falsos que pasan y uno que falla.
const casos = [
  {
    id: 'pasa-tina',
    agente: 'tina',
    esperado: { camino: 'derivacion', herramientas: ['crear_ticket'], rubrica: [{ criterio: 'Explica qué va a pasar', peso: 1 }] },
    salida: { texto: 'Le paso el tema a Agustín, te responde dentro del día hábil.', herramientas: [{ nombre: 'crear_ticket' }], camino: 'derivacion' },
    veredictos: [{ id: 'c1', nivel: 'cumple', motivo: 'Dice el plazo.' }],
  },
  {
    id: 'pasa-analisis',
    agente: 'analisis_venta',
    esperado: { etapa: 'venta', codigos: ['A1'], sin_codigos: ['C1'] },
    salida: { etapa: 'venta', confianza: 'alta', codigos: [{ codigo: 'A1', intensidad: 2 }, { codigo: 'P3', intensidad: 1 }] },
    veredictos: [],
  },
  {
    id: 'falla-tina',
    agente: 'tina',
    esperado: { sin_herramientas: ['crear_ficha_cierre'], excluye: ['{{'], rubrica: [{ criterio: 'Se niega', peso: 1 }] },
    salida: { texto: 'Acá tenés la plantilla con {{NOMBRE}}.', herramientas: [{ nombre: 'crear_ficha_cierre' }], camino: 'accionable' },
    veredictos: [{ id: 'c1', nivel: 'cumple', motivo: '' }],
  },
];
const puntajes = casos.map((c) => puntajeCaso(chequeosFijos(c.agente, c.salida, c.esperado), c.esperado.rubrica, c.veredictos));

prueba('dos casos pasan y uno falla', () => {
  assert.deepEqual(puntajes, [100, 100, 0]);
});

prueba('un chequeo fijo que falla deja el caso en cero aunque el juez diga que cumple', () => {
  const ch = chequeosFijos('tina', casos[2].salida, casos[2].esperado);
  assert.deepEqual(ch.filter((x) => !x.ok).map((x) => x.nombre), ['no usa crear_ficha_cierre', 'no dice «{{»']);
});

prueba('la rúbrica pondera por peso y un criterio sin veredicto vale cero', () => {
  assert.equal(puntajeRubrica([{ criterio: 'a', peso: 3 }, { criterio: 'b', peso: 1 }], [{ id: 'c1', nivel: 'cumple' }]), 0.75);
  assert.equal(puntajeRubrica([{ criterio: 'a', peso: 1 }], [{ id: 'c1', nivel: 'no_cumple' }]), 0);
});

prueba('el agente vale el promedio de sus casos', () => {
  assert.equal(puntajeAgente(puntajes), 66.7);
  assert.equal(puntajeAgente([]), null);
});

prueba('un error del agente falla el caso', () => {
  assert.equal(puntajeCaso(chequeosFijos('tina', { error: 'API caída' }, {}), [], []), 0);
});

prueba('el analizador no puede inventar códigos', () => {
  const ch = chequeosFijos('analisis_venta', { etapa: 'venta', confianza: 'alta', codigos: [{ codigo: 'Z9', intensidad: 1 }] }, {});
  assert.equal(ch.find((x) => x.nombre === 'los códigos son del libro').ok, false);
});

prueba('baja más de dos puntos contra la versión anterior y no pasa', () => {
  assert.equal(veredicto({ nuevo: 80, anterior: 83 }).ok, false);
  assert.equal(veredicto({ nuevo: 81, anterior: 83 }).ok, true);
  assert.equal(veredicto({ nuevo: 90, anterior: null, umbral: 85 }).ok, true);
  assert.equal(veredicto({ nuevo: 84, anterior: 80, umbral: 85 }).ok, false);
});

prueba('la comparación de frases no distingue mayúsculas ni tildes', () => {
  const ch = chequeosFijos('tina', { texto: 'Soy la ASISTENTE con IA de FIRMA', herramientas: [], camino: 'accionable' }, { incluye: ['asistente con ia'] });
  assert.ok(ch.every((x) => x.ok));
});

prueba('los casos se leen de la carpeta, sin los pausados y sin ids repetidos', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'casos-'));
  writeFileSync(path.join(dir, 'tina.json'), JSON.stringify({ agente: 'tina', umbral: 70, casos: [{ id: 'a', entrada: { mensajes: [] }, esperado: {} }, { id: 'b', activo: false, entrada: {}, esperado: {} }] }));
  writeFileSync(path.join(dir, 'tina.extra.json'), JSON.stringify({ agente: 'tina', casos: [{ id: 'c', entrada: {}, esperado: {} }] }));
  const g = leerCasos(dir).get('tina');
  assert.deepEqual(g.casos.map((c) => c.id).sort(), ['a', 'c']);
  assert.equal(g.umbral, 70);
  writeFileSync(path.join(dir, 'tina.repetido.json'), JSON.stringify({ agente: 'tina', casos: [{ id: 'a', entrada: {}, esperado: {} }] }));
  assert.throws(() => leerCasos(dir), /repetido/);
});

prueba('la huella de los casos no depende del orden y cambia si cambia un caso', () => {
  const a = { id: 'a', entrada: { x: 1 }, esperado: {} };
  const b = { id: 'b', entrada: { x: 2 }, esperado: {} };
  assert.equal(huellaCasos([a, b]), huellaCasos([b, a]));
  assert.notEqual(huellaCasos([a, b]), huellaCasos([a, { ...b, entrada: { x: 3 } }]));
});

prueba('un prompt que cambió sin medirse pide Medir IA, y uno sin casos no', () => {
  const todos = new Map([['tina', { umbral: 78, casos: [{ id: 'a' }] }], ['analisis_venta', { umbral: null, casos: [] }]]);
  const referencias = { tina: { version: 'v1', puntaje: 90 } };
  assert.deepEqual(faltanMedir({ agentes: ['tina', 'analisis_venta'], todos, versiones: { tina: 'v1', analisis_venta: 'x' }, referencias }), []);
  assert.deepEqual(faltanMedir({ agentes: ['tina'], todos, versiones: { tina: 'v2' }, referencias }).map((f) => f.agente), ['tina']);
  assert.match(faltanMedir({ agentes: ['tina'], todos, versiones: { tina: 'v1' }, referencias: {} })[0].motivo, /referencia/);
});

prueba('el caso que arma FIRMA desde el formulario', () => {
  const e = esperadoDesde({ camino: 'derivacion', herramientas: 'crear_ticket', sin_herramientas: '', etapa: '', codigos: 'a1, b1', sin_codigos: '', incluye: 'día hábil', excluye: '', criterios: '- Deriva a FIRMA (2)\nNo promete plazos' });
  assert.deepEqual(e, { camino: 'derivacion', herramientas: ['crear_ticket'], codigos: ['A1', 'B1'], incluye: ['día hábil'], rubrica: [{ criterio: 'Deriva a FIRMA', peso: 2 }, { criterio: 'No promete plazos', peso: 1 }] });
  assert.equal(problemaDeEntrada('tina', { mensajes: [{ autor: 'tina', contenido: 'Hola' }] }), 'El último mensaje tiene que ser de la persona.');
  assert.match(problemaDeEntrada('tina', { mensajes: [{ autor: 'usuario', contenido: 'Escribile a juan@mail.com' }] }), /mail/);
  assert.equal(problemaDeEntrada('tina', { plan: 'eminent', mensajes: [{ autor: 'usuario', contenido: 'Hola' }] }), null);
  const archivo = JSON.parse(archivoParaEvaluador('tina', [
    { id: 2, agente: 'tina', etiqueta: 'B', origen: 'correccion', corrida_id: 1, entrada: {}, esperado: {}, activo: true, creado_en: '' },
    { id: 1, agente: 'tina', etiqueta: 'A', origen: 'manual', corrida_id: null, entrada: {}, esperado: {}, activo: false, creado_en: '' },
  ]));
  assert.deepEqual(archivo.casos.map((c) => c.id), ['db-2']);
});

prueba('la entrada de un caso sale sin nombres, mails, teléfonos ni documentos', () => {
  const anon = anonimizador([
    { valor: 'Juan Pérez', alias: '[cliente]', partes: true },
    { valor: 'Academia Sol', alias: '[empresa]' },
  ]);
  assert.equal(
    anon('Cerré con juan perez (DNI 30.123.456, juan@x.com, +54 9 11 5555-5555), dos cuotas de USD 1.500 desde el 2026-12-01. Juan ama Academia Sol.'),
    'Cerré con [cliente] (DNI [documento], [mail], [teléfono]), dos cuotas de USD 1.500 desde el 2026-12-01. [cliente] ama [empresa].',
  );
  assert.equal(anon('CUIT 20-30123456-7 y el sol de hoy'), 'CUIT [documento] y el sol de hoy');
});

// Un Claude falso: primero pide crear_ticket y después contesta.
function claudeFalso(respuestas) {
  const pedidos = [];
  const finalMessage = (p) => {
    pedidos.push(p);
    return Promise.resolve(respuestas.shift());
  };
  return {
    pedidos,
    beta: { messages: { stream: (p) => ({ finalMessage: () => finalMessage(p) }) } },
    messages: { stream: (p) => ({ finalMessage: () => finalMessage(p) }) },
  };
}

await (async () => {
  const api = claudeFalso([
    { model: 'claude-opus-5-5', stop_reason: 'tool_use', content: [{ type: 'text', text: 'Lo paso a FIRMA.' }, { type: 'tool_use', id: 't1', name: 'crear_ticket', input: { prioridad: 'alta' } }] },
    { model: 'claude-opus-5-5', stop_reason: 'end_turn', content: [{ type: 'text', text: 'Listo, te llaman hoy.' }] },
  ]);
  const salida = await AGENTES.tina(api, { plan: 'eminent', rol: 'titular', mensajes: [{ autor: 'usuario', contenido: 'Me amenazan con escracharme' }], herramientas: { crear_ticket: '{"ticket":"T-1"}' } });
  prueba('Tina corre con su prompt y sus herramientas, sin tocar la base', () => {
    assert.equal(salida.camino, 'derivacion');
    assert.deepEqual(salida.herramientas.map((h) => [h.nombre, h.resultado]), [['crear_ticket', '{"ticket":"T-1"}']]);
    assert.equal(salida.texto, 'Lo paso a FIRMA.\n\nListo, te llaman hoy.');
    const p = api.pedidos[0];
    assert.match(p.system[0].text, /Sos Tina/);
    assert.ok(p.tools.some((t) => t.name === 'crear_ticket'));
    assert.equal(api.pedidos[1].messages.at(-1).content[0].tool_use_id, 't1');
  });
  const starter = claudeFalso([{ model: 'm', stop_reason: 'end_turn', content: [{ type: 'text', text: 'Excede tu plan.' }] }]);
  await AGENTES.tina(starter, { plan: 'starter', mensajes: [{ autor: 'usuario', contenido: 'Hola' }] });
  prueba('en Starter Tina no tiene crear_ticket', () => {
    assert.ok(!starter.pedidos[0].tools.some((t) => t.name === 'crear_ticket'));
  });
})();

console.log(`\n${hechas} pruebas del evaluador pasaron.`);
