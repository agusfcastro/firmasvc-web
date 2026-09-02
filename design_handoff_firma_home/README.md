# Handoff: Firma — Home (rebrand)

Repo destino: **agusfcastro/firmasvc-web** (main). Vite + React + TypeScript + Tailwind. Componentes en `components/`, assets en `assets/`.

## Overview
Rediseño del home de firmasvc.com aplicando la identidad nueva de Firma (Castro & Company · Legal Consulting). La **estructura y el copy** son los del sitio actual (Header → Hero → Video → Services → Process → Testimonials/Clientes → Carta → Contact → Footer); cambian identidad visual, tipografía, paleta, logos y algunos textos indicados abajo. Tono: rioplatense, "vos", sin promesas de resultados.

## About the Design Files
`Firma Home v2.dc.html` (+ `support.js`) es una **referencia de diseño en HTML**, no código para copiar. La tarea es recrearlo en los componentes React/Tailwind existentes del repo, manteniendo sus patrones (Reveal, Button, openCalendly, marquee). Abrirlo en el navegador para ver el resultado esperado; leer su `<style>` y los estilos inline para valores exactos.

## Fidelity
**Hi-fi.** Colores, tipografías, espaciados y estados son finales. Hero variante B (acento verde) es la elegida; A (monocromo) queda como opción: solo cambia el color de los CTAs primarios y del texto acentuado.

## Design Tokens
Colores
- Marfil `#F5F3EC` fondo dominante (body, header, secciones claras)
- Marfil oscuro `#EDEBE2` superficies secundarias
- Carbón `#2B2B2B` secciones de contraste (Services, footer, tarjeta de agenda)
- Tinta `#1B1F1B` texto principal, botón oscuro, tarjetas dentro de Services
- Gris piedra `#6B6553` texto secundario sobre claro
- Gris cálido `#A9A79E` texto secundario sobre carbón
- Verde bosque `#173A2F` único acento: CTAs primarios (hover `#12302a`), palabra acentuada del h1 y del título de contacto, cifras del hero, hover del icon-box
- Filetes: `rgba(27,31,27,0.15)` sobre claro · `rgba(245,243,236,0.16)` sobre carbón
- Prohibido: degradados, sombras decorativas, dorados, azules, radios grandes. Radio 0 en todo salvo los círculos del proceso.

Tipografía (Google Fonts: Archivo 400/500/600, Bitter 700/900)
- h1: Bitter 900, clamp(36px,7vw,72px), lh 1.02, ls -0.02em
- h2: Bitter 900, clamp(28px,4.5vw,44px), lh 1.08, ls -0.015em
- h3: Bitter 700, clamp(20px,2.4vw,24px), lh 1.2
- Body: Archivo 400, 15–17px, lh 1.55–1.6
- Eyebrow: Archivo 500, 12px, uppercase, ls 0.2em
- Botón: Archivo 500, 15px, alto 52px (56px en hero, 40px en header), padding 0 24px, radio 0, white-space nowrap

Layout: contenedor max 1200px, padding 20px (≥900px: 48px). Secciones padding 72px vertical (≥900px: 112px).

## Screens
### Header (sticky, fondo marfil, borde inferior 1px filete)
- Alto 112px. Izquierda: `brand/lockup-claro.png` alto 72px (max-width 62vw en mobile).
- Nav desktop (≥900px): Nosotros(#about) · Servicios(#services) · Recursos(YouTube) · Clientes(#testimonials) · botón "Agenda" verde 40px → openCalendly.
- Mobile: solo lockup + botón "Agenda".

### Hero (centrado, padding 80px 0 64px, overflow hidden)
- Fondo: `brand/simbolo-claro.png` (rúbrica) absoluta, centrada en left 50% / top 38%, ancho min(140vw,1400px), opacity 0.06. Reemplaza la cuadrícula del sitio actual.
- h1 en dos líneas: "blindamos legalmente" / "**tu negocio digital**" (segunda línea en verde).
- Botones: "Agendar auditoría →" (verde, 56px) · "Conocer servicios" (ghost: borde 1px tinta, hover invierte).
- Debajo: párrafo Archivo clamp(17px,2vw,22px) color piedra, max-width 26em, text-wrap balance → dos líneas: "Soluciones estratégicas que evitan que reembolsos, morosos y tu equipo se coman tu facturación."
- Cifras: grid 3 col, max 720px, borde superior filete, separadores verticales. Número Bitter 900 clamp(28px,4vw,40px) verde; label eyebrow 11px piedra. +55 Contratos · +20 Marcas registradas · +10 Sociedades constituidas.
- Se eliminaron: badge "Seguridad jurídica…", tagline "porque cada acuerdo…", blobs y grid azul.

### Video (#about, padding 0 0 88px, contenedor max 960px)
- `<video controls preload="metadata" playsinline poster="og.png" src="assets/video/presentacion.mp4">` 16:9, fondo carbón, sin radio. Reemplaza el iframe de Loom. MP4 pendiente de subir.
- Caption debajo: "Conocé a Agustín, fundador de firma" (13px piedra) · eyebrow 11px "Resultados reales. Más allá de la formalidad."

### Services (#services, fondo carbón, texto marfil)
- Cabecera centrada: eyebrow "Nuestros servicios" (#A9A79E) · h2 "Soluciones de alto valor" · párrafo actual.
- 4 tarjetas (1/2/4 columnas a 0/720/1000px, gap 20px): fondo `#1B1F1B`, borde 1px rgba(245,243,236,0.12), padding 32px, radio 0. Hover: translateY(-4px), borde a 0.4 alpha (300ms).
  - Número watermark: Bitter 900 88px, top -10px right 2px, color rgba(245,243,236,0.06) → 0.12 en hover.
  - Icon box 56×56 marfil con ícono lucide 28px tinta; hover: fondo verde, ícono marfil. Íconos: Building2, FileText, ScrollText, PenTool.
  - h3 + descripción (15px, #A9A79E). Copy igual al actual ("Olvídate" → "Olvidate").
- Animación Reveal: opacity 0 / translateY 24px → visible, 700ms ease, delay 0/100/200/300ms (usar el componente Reveal existente).

### Process (#process, fondo marfil)
- Cabecera centrada: eyebrow "Cómo trabajamos" · h2 **"¿Cómo ayudamos a nuestros clientes?"** · párrafo actual.
- 4 pasos centrados (grid 4 col ≥900px, gap 24px; mobile 1 col gap 48px). Línea punteada horizontal a top 48px entre 12.5% y 87.5%: repeating-linear-gradient rgba(27,31,27,0.35) 6px / 14px.
- Badge 96×96: número watermark Bitter 900 84px rgba(27,31,27,0.07) detrás; círculo 96px borde 2px tinta, fondo marfil, ícono lucide 32px tinta (Search, Target, Cog, LifeBuoy).
- Eyebrow "Paso 0N" · h3 · descripción 15px piedra max 30ch. Reveal con delay 0/120/240/360ms.
- CTA centrado "Agendar auditoría" verde.

### Clientes (#testimonials, borde superior filete)
- Cabecera centrada: eyebrow "Negocios que confían en nosotros" · h2 "Clientes de la firma".
- Marquee infinito (track ×3, translateX -33.33%, 40s linear, pausa en hover), máscara de fade 10% en los bordes. Tiles 192×88, padding 18px 24px, **sin fondo ni borde**. Logos monocromo tinta con opacity 0.85 → 1 en hover.
- Usar los PNG de `assets/clients/mono/` (ya recortados, tinta #1B1F1B sobre transparente). Orden y URLs iguales a Testimonials.tsx actual.

### Carta a futuros clientes (#quien, borde superior filete)
- Grid 5fr/7fr ≥900px, gap 64px. Izquierda: retrato 4:5 fondo carbón, `brand/retrato.png` grayscale(1) contrast(1.05), max 420px, franja inferior carbón "Retrato provisorio · Sesión pendiente" (quitar cuando haya foto final).
- Derecha: eyebrow "Carta a futuros clientes" · h2 "Hola, soy Agustín Castro." · dos párrafos 17px (ver HTML) · cierre Bitter 700 clamp(20px,2.2vw,26px): "Construiste algo que vale la pena defender. Hagamos que crezca sin que nadie te lo pueda discutir." · "— Agustín" 14px piedra · links subrayados @agustin.legales, LinkedIn, YouTube.

### Contact (#contact, borde superior filete)
- Grid 7fr/5fr ≥900px. Izquierda: h2 en dos líneas "Poner orden en tu negocio" / "está a una **firma** de distancia." (≥900px: font clamp(26px,3.2vw,40px), nowrap); párrafo actual; mail y WhatsApp como links subrayados.
- Derecha: tarjeta carbón padding 40px 32px, `brand/simbolo-oscuro.png` 22px, h3 "Agendá tu llamada", texto #A9A79E, botón verde full-width "Ver disponibilidad" → openCalendly. Sin radio ni sombra.

### Footer (carbón)
- `brand/lockup-oscuro.png` 48px. 4 columnas 14px #A9A79E (hover marfil): membrete (Agustín Castro / Abogado (UBA) / Buenos Aires, Argentina) · navegación · contacto · redes (Instagram @agustin.legales, LinkedIn, YouTube).
- Barra inferior 12px: © 2026 Firma · Política de Privacidad.
- Mantener WhatsAppButton flotante si se conserva; recolorear a tinta/verde (sin #25D366).

## Interactions
- Todos los CTAs "Agendar / Agenda / Ver disponibilidad" → openCalendly() (https://calendly.com/agustinlegales/30min). Actualizar `lib/calendly.ts`: primaryColor `173A2F`, textColor `1B1F1B`, backgroundColor `F5F3EC`.
- Transiciones de botón 150ms background/color. Cards 300ms. Reveal 700ms.
- Header: eliminar el cambio a blur/sombra al scrollear; queda sticky marfil con borde.

## Assets (incluidos en este paquete)
- `brand/`: lockup claro/oscuro, wordmark claro/oscuro, símbolo claro/oscuro, og (1200×630), retrato provisorio.
- `assets/clients/mono/`: 7 logos monocromo.
- Fuentes: Google Fonts Archivo + Bitter (agregar <link> en index.html y a tailwind fontFamily: heading Bitter, sans Archivo).
- Pendientes: `assets/video/presentacion.mp4`, retrato definitivo.

## Files
- `Firma Home v2.dc.html` + `support.js` — referencia (abrir en navegador).
- `github.md` — mapa de pantallas → archivos del repo.
