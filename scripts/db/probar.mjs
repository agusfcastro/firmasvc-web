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

await db.exec(AYUDAS);

let fallidas = 0;
for (const archivo of await archivosSql(PRUEBAS)) {
  const sql = await readFile(path.join(PRUEBAS, archivo), 'utf8');
  try {
    await db.exec(`begin;\n${sql}\nrollback;`);
    console.log(`✓ ${archivo}`);
  } catch (e) {
    await db.exec('rollback;').catch(() => undefined);
    console.error(`✗ ${archivo}\n  ${e.message}`);
    fallidas++;
  }
}

await db.close();
process.exit(fallidas ? 1 : 0);
