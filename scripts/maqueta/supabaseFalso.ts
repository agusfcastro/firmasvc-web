/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Cliente de Supabase de la maqueta: responde con datos.ts y no sale a internet.
 * Entiende los filtros que usa el portal (eq, neq, in, is, not, gte, lt…) y para el
 * resto devuelve todo. Escribir no hace nada.
 */
import { DATOS, PERFIL } from './datos';

type Fila = Record<string, any>;

class Consulta implements PromiseLike<{ data: any; error: null; count: number }> {
  private filtros: ((f: Fila) => boolean)[] = [];
  private uno = false;
  private soloCuenta = false;
  private tope: number | null = null;
  constructor(private tabla: string) {}
  select(_c?: string, o?: { count?: string; head?: boolean }) {
    this.soloCuenta = Boolean(o?.head);
    return this;
  }
  eq(c: string, v: unknown) {
    this.filtros.push((f) => f[c] === v);
    return this;
  }
  neq(c: string, v: unknown) {
    this.filtros.push((f) => f[c] !== v);
    return this;
  }
  in(c: string, vs: unknown[]) {
    this.filtros.push((f) => vs.includes(f[c]));
    return this;
  }
  is(c: string, v: unknown) {
    this.filtros.push((f) => (f[c] ?? null) === v);
    return this;
  }
  not(c: string, op: string, v: unknown) {
    if (op === 'is') this.filtros.push((f) => (f[c] ?? null) !== v);
    return this;
  }
  gte(c: string, v: string) {
    this.filtros.push((f) => String(f[c] ?? '') >= v);
    return this;
  }
  gt(c: string, v: string) {
    this.filtros.push((f) => String(f[c] ?? '') > v);
    return this;
  }
  lt(c: string, v: string) {
    this.filtros.push((f) => String(f[c] ?? '') < v);
    return this;
  }
  lte(c: string, v: string) {
    this.filtros.push((f) => String(f[c] ?? '') <= v);
    return this;
  }
  /** campo.op.valor separados por coma, con and(...) adentro, como los usa el portal. */
  or(expr: string) {
    const partes = (t: string): string[] => {
      const out: string[] = [];
      let nivel = 0;
      let desde = 0;
      for (let i = 0; i < t.length; i++) {
        if (t[i] === '(') nivel++;
        else if (t[i] === ')') nivel--;
        else if (t[i] === ',' && nivel === 0) {
          out.push(t.slice(desde, i));
          desde = i + 1;
        }
      }
      out.push(t.slice(desde));
      return out;
    };
    const prueba = (t: string): ((f: any) => boolean) => {
      if (t.startsWith('and(')) {
        const ps = partes(t.slice(4, -1)).map(prueba);
        return (f) => ps.every((p) => p(f));
      }
      const [c, op, ...resto] = t.split('.');
      const v = resto.join('.');
      return (f) => {
        const x = f[c] == null ? null : String(f[c]);
        if (op === 'is') return v === 'null' ? x === null : x === v;
        if (x === null) return false;
        return op === 'eq' ? x === v : op === 'neq' ? x !== v : op === 'lt' ? x < v : op === 'lte' ? x <= v : op === 'gt' ? x > v : op === 'gte' ? x >= v : true;
      };
    };
    const ps = partes(expr).map(prueba);
    this.filtros.push((f) => ps.some((p) => p(f)));
    return this;
  }
  ilike() {
    return this;
  }
  order() {
    return this;
  }
  range() {
    return this;
  }
  limit(n: number) {
    this.tope = n;
    return this;
  }
  maybeSingle() {
    this.uno = true;
    return this;
  }
  single() {
    this.uno = true;
    return this;
  }
  insert() {
    return this;
  }
  update() {
    return this;
  }
  delete() {
    return this;
  }
  upsert() {
    return this;
  }
  then<A = { data: any; error: null; count: number }, B = never>(ok?: ((v: { data: any; error: null; count: number }) => A | PromiseLike<A>) | null, mal?: ((e: unknown) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    const filas = (DATOS[this.tabla] ?? []).filter((f) => this.filtros.every((g) => g(f)));
    const cortadas = this.tope ? filas.slice(0, this.tope) : filas;
    const data = this.soloCuenta ? null : this.uno ? (cortadas[0] ?? null) : cortadas;
    return Promise.resolve({ data, error: null, count: filas.length }).then(ok, mal);
  }
}

const sesion = { user: { id: PERFIL.id, email: PERFIL.email }, access_token: 'maqueta' };

export const supabase: any = {
  from: (t: string) => new Consulta(t),
  rpc: async () => ({ data: null, error: null }),
  auth: {
    getSession: async () => ({ data: { session: sesion } }),
    getUser: async () => ({ data: { user: sesion.user } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: async () => ({ error: null }),
    mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: 'aal2', nextLevel: 'aal2' } }) },
  },
  storage: {
    from: () => ({
      getPublicUrl: () => ({ data: { publicUrl: '' } }),
      createSignedUrl: async () => ({ data: null, error: null }),
      download: async () => ({ data: null, error: null }),
    }),
  },
  channel: () => ({ on() { return this; }, subscribe() { return this; } }),
  removeChannel: () => undefined,
};
