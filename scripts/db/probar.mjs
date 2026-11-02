/**
 * Corre todas las migraciones sobre un Postgres vacío en memoria (PGlite)
 * y después las pruebas de supabase/pruebas. No necesita Docker ni tocar
 * la base de producción.
 *
 *   npm run db:probar
 *
 * Cada prueba corre en su propia transacción, que se descarta al terminar.
 * Una prueba falla si lanza un error; pruebas.ok() lo lanza cuando la
 * condición no se cumple.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MIGRACIONES = path.join(raiz, 'supabase/migrations');
const PRUEBAS = path.join(raiz, 'supabase/pruebas');

// Ayudas para las pruebas. Se cargan después de las migraciones.
const AYUDAS = `
create schema pruebas;
grant usage on schema pruebas to anon, authenticated, service_role;

create function pruebas.ok(condicion boolean, mensaje text) returns void language plpgsql as $$
begin
  if condicion is not true then raise exception 'FALLÓ: %', mensaje; end if;
end;
$$;

-- Actúa como un usuario del portal. aal2 es con la verificación en dos pasos hecha.
create function pruebas.como(usuario uuid, aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', usuario, 'role', 'authenticated', 'aal', aal)::text, true);
  execute 'set local role authenticated';
end;
$$;

create function pruebas.como_anonimo() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
end;
$$;

-- Vuelve a postgres para preparar datos entre una comprobación y otra.
create function pruebas.como_postgres() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'reset role';
end;
$$;

grant execute on all functions in schema pruebas to anon, authenticated, service_role;
`;

async function archivosSql(dir) {
  return (await readdir(dir)).filter((f) => f.endsWith('.sql') && !f.startsWith('_')).sort();
}

const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(await readFile(path.join(PRUEBAS, '_supabase.sql'), 'utf8'));

for (const archivo of await archivosSql(MIGRACIONES)) {
  try {
    await db.exec(await readFile(path.join(MIGRACIONES, archivo), 'utf8'));
  } catch (e) {
    console.error(`✗ migración ${archivo}\n  ${e.message}`);
    process.exit(1);
  }
}
console.log('✓ migraciones aplicadas sobre una base vacía');

// Las variables fijas de los contratos están en api/_lib/variables.ts y,
// para que ningún negocio las pise, en variable_de_sistema(). Tienen que coincidir.
const variablesTs = [...(await readFile(path.join(raiz, 'api/_lib/variables.ts'), 'utf8')).matchAll(/^\s+\['([A-Z_]+)',/gm)].map((m) => m[1]);
const { rows } = await db.query(`select unnest($1::text[]) as clave`, [variablesTs]);
const sinReservar = [];
for (const { clave } of rows) {
  const r = await db.query('select public.variable_de_sistema($1) as ok', [clave]);
  if (!r.rows[0].ok) sinReservar.push(clave);
}
if (sinReservar.length || variablesTs.length === 0) {
  console.error(`✗ variable_de_sistema() no reserva: ${sinReservar.join(', ') || 'no se leyó variables.ts'}`);
  process.exit(1);
}
console.log(`✓ las ${variablesTs.length} variables fijas están reservadas`);

await db.exec(AYUDAS);

// Negocios y usuarios comunes, cargados al principio de cada prueba.
const datos = await readFile(path.join(PRUEBAS, '_datos.sql'), 'utf8');

let fallidas = 0;
for (const archivo of await archivosSql(PRUEBAS)) {
  const sql = await readFile(path.join(PRUEBAS, archivo), 'utf8');
  try {
    await db.exec(`begin;\n${datos}\n${sql}\nrollback;`);
    console.log(`✓ ${archivo}`);
  } catch (e) {
    await db.exec('rollback;').catch(() => undefined);
    console.error(`✗ ${archivo}\n  ${e.message}`);
    fallidas++;
  }
}

await db.close();
process.exit(fallidas ? 1 : 0);
