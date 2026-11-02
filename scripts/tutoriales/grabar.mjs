// Graba los tutoriales del portal sobre la empresa demo, con el titular.
// Uso: PORTAL_URL=https://www.firmasvc.com DEMO_MAIL=... DEMO_CLAVE=... node grabar.mjs [clave ...]
// Deja <clave>.mp4 y <clave>.jpg en ./salida, listos para public/tutoriales.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GUIONES } from './guiones.mjs';
import { fuentesLocales } from './fuentes.mjs';

const BASE = process.env.PORTAL_URL ?? 'https://www.firmasvc.com';
const { DEMO_MAIL, DEMO_CLAVE } = process.env;
const ANCHO = 1440, ALTO = 900;
const SALIDA = './salida', CRUDO = './crudo';
mkdirSync(SALIDA, { recursive: true });

// Cursor visible y rótulos de paso, inyectados en cada página.
const OVERLAY = `
(() => {
  if (window.__tuto) return;
  const css = document.createElement('style');
  css.textContent = \`
    #tuto-cursor{position:fixed;z-index:2147483647;width:22px;height:22px;margin:-3px 0 0 -3px;pointer-events:none;transition:left .55s cubic-bezier(.4,0,.2,1),top .55s cubic-bezier(.4,0,.2,1)}
    #tuto-cursor svg{filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))}
    .tuto-onda{position:fixed;z-index:2147483646;width:36px;height:36px;margin:-18px 0 0 -18px;border-radius:50%;background:rgba(46,74,58,.35);pointer-events:none;animation:tuto-onda .5s ease-out forwards}
    @keyframes tuto-onda{from{transform:scale(.3);opacity:1}to{transform:scale(1.4);opacity:0}}
    #tuto-rotulo{position:fixed;z-index:2147483645;left:50%;bottom:30px;transform:translateX(-50%);max-width:920px;background:#f5f3ec;color:#1b1f1b;border:1px solid rgba(27,31,27,.18);border-left:5px solid #173a2f;box-shadow:0 10px 30px rgba(0,0,0,.22);font:500 19px/1.45 Archivo,system-ui,sans-serif;padding:15px 24px;opacity:0;transition:opacity .3s;pointer-events:none;text-align:left}
    #tuto-rotulo.ver{opacity:1}
    #tuto-rotulo b{color:#173a2f;font-weight:600;margin-right:10px;text-transform:uppercase;letter-spacing:.12em;font-size:14px}\`;
  document.documentElement.appendChild(css);
  const c = document.createElement('div'); c.id='tuto-cursor';
  c.innerHTML='<svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 2l16 9.5-7 1.6-3.6 6.9z" fill="#1b1f1b" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  c.style.left=(innerWidth/2)+'px'; c.style.top=(innerHeight/2)+'px';
  document.documentElement.appendChild(c);
  const r = document.createElement('div'); r.id='tuto-rotulo'; document.documentElement.appendChild(r);
  window.__tuto = {
    mover(x,y){ c.style.left=x+'px'; c.style.top=y+'px'; },
    onda(x,y){ const o=document.createElement('div'); o.className='tuto-onda'; o.style.left=x+'px'; o.style.top=y+'px'; document.documentElement.appendChild(o); setTimeout(()=>o.remove(),600); },
    rotulo(paso, txt){ r.innerHTML = txt ? (paso?'<b>'+paso+'</b>':'')+txt : ''; r.classList.toggle('ver', !!txt); },
    pos(){ return [parseFloat(c.style.left), parseFloat(c.style.top)]; }
  };
})();`;

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

function ayudantes(page) {
  const asegurar = () => page.evaluate(OVERLAY);
  const h = {
    linea: [],
    page,
    pausa,
    async ir(ruta) { await page.goto(BASE + ruta, { waitUntil: 'networkidle' }); await asegurar(); await pausa(900); },
    async rotulo(paso, txt, ms = 2600) { if (!h.inicio && txt) h.inicio = Date.now(); await asegurar(); if (txt) h.linea.push({ t: Date.now(), paso, txt }); await page.evaluate(([p, t]) => window.__tuto.rotulo(p, t), [paso, txt]); if (ms) await pausa(ms); },
    async limpiarRotulo() { await page.evaluate(() => window.__tuto?.rotulo('', '')); },
    async apuntar(loc) {
      await asegurar();
      const el = typeof loc === 'string' ? page.locator(loc).first() : loc.first();
      await el.scrollIntoViewIfNeeded(); await pausa(250);
      const b = await el.boundingBox(); if (!b) throw new Error('Sin caja para ' + loc);
      const x = b.x + Math.min(b.width / 2, 60), y = b.y + b.height / 2;
      await page.evaluate(([x, y]) => window.__tuto.mover(x, y), [x, y]);
      await page.mouse.move(x, y, { steps: 12 });
      await pausa(650);
      return { el, x, y };
    },
    async clic(loc, espera = 1100) {
      const { el, x, y } = await h.apuntar(loc);
      await page.evaluate(([x, y]) => window.__tuto.onda(x, y), [x, y]);
      await el.click(); await page.waitForLoadState('networkidle').catch(() => {});
      await asegurar(); await pausa(espera);
    },
    async escribir(loc, texto) {
      const { el } = await h.apuntar(loc); await el.click();
      await el.pressSequentially(texto, { delay: 55 }); await pausa(500);
    },
    async elegir(loc, valor) { const { el } = await h.apuntar(loc); await el.selectOption(valor); await pausa(800); },
    async desplazar(px, ms = 1400) {
      await page.evaluate((px) => window.scrollBy({ top: px, behavior: 'smooth' }), px); await pausa(ms);
    },
  };
  return h;
}

async function ingresar(context) {
  const page = await context.newPage();
  await page.goto(BASE + '/portal/ingresar', { waitUntil: 'networkidle' });
  await page.locator('input[type=email]').fill(DEMO_MAIL);
  await page.locator('input[type=password]').fill(DEMO_CLAVE);
  await page.locator('button[type=submit]').click();
  await page.waitForURL((u) => !u.pathname.endsWith('/ingresar'), { timeout: 20000 });
  await page.waitForLoadState('networkidle');
  await page.close();
}

const navegador = await chromium.launch({ args: ['--lang=es-AR'], env: { ...process.env, LANG: 'es_AR.UTF-8', LANGUAGE: 'es_AR' } });
// Sesión sin grabar, para guardar la cookie y no mostrar el login en cada video.
const base = await navegador.newContext({ viewport: { width: ANCHO, height: ALTO }, locale: 'es-AR', timezoneId: 'America/Argentina/Buenos_Aires' });
await fuentesLocales(base);
await ingresar(base);
const estado = await base.storageState();
await base.close();

const pedidos = process.argv.slice(2);
for (const [clave, guion] of Object.entries(GUIONES)) {
  if (pedidos.length && !pedidos.includes(clave)) continue;
  rmSync(CRUDO, { recursive: true, force: true });
  const ctx = await navegador.newContext({
    viewport: { width: ANCHO, height: ALTO }, deviceScaleFactor: 1, storageState: estado, locale: 'es-AR',
    timezoneId: 'America/Argentina/Buenos_Aires', recordVideo: { dir: CRUDO, size: { width: ANCHO, height: ALTO } },
  });
  await fuentesLocales(ctx);
  const t0 = Date.now();
  const page = await ctx.newPage();
  const h = ayudantes(page);
  try { await guion(h); console.log('ok', clave, ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  catch (e) { console.error('FALLÓ', clave, e.message); await page.screenshot({ path: join(SALIDA, clave + '-error.png') }); }
  await h.limpiarRotulo().catch(() => {}); await pausa(600);
  await ctx.close();
  const webm = join(CRUDO, readdirSync(CRUDO).find((f) => f.endsWith('.webm')));
  // Recorta el primer segundo en blanco de la carga.
  const ss = Math.max(0.5, ((h.inicio ?? t0) - t0) / 1000 - 0.4);
  writeFileSync(join(SALIDA, clave + '.json'), JSON.stringify(h.linea.map((l) => ({ t: +(((l.t - t0) / 1000) - ss).toFixed(2), paso: l.paso, txt: l.txt })), null, 1));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(ss), '-i', webm, '-vf', 'scale=1280:-2,fps=30', '-c:v', 'libx264', '-preset', 'slow', '-crf', '26', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', join(SALIDA, clave + '.mp4')]);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '2.5', '-i', join(SALIDA, clave + '.mp4'), '-frames:v', '1', '-q:v', '4', join(SALIDA, clave + '.jpg')]);
}
await navegador.close();
