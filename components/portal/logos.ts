import { useEffect, useState } from 'react';
import { supabase } from './supabase';

/**
 * Logo de cada cliente de FIRMA. Se guarda en el bucket público `logos` y
 * la URL en organizaciones.logo_url. Se cachea por sesión para no pedirlo
 * en cada pantalla.
 */
export const BUCKET_LOGOS = 'logos';
export const TIPOS_LOGO = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
export const MAX_BYTES_LOGO = 2 * 1024 * 1024;

const cache = new Map<string, string | null>();
const oyentes = new Set<() => void>();

export function fijarLogo(orgId: string, url: string | null) {
  cache.set(orgId, url);
  oyentes.forEach((f) => f());
}

export function useLogoOrg(orgId: string | null | undefined): string | null {
  const [, refrescar] = useState(0);

  useEffect(() => {
    const f = () => refrescar((n) => n + 1);
    oyentes.add(f);
    return () => {
      oyentes.delete(f);
    };
  }, []);

  useEffect(() => {
    if (!supabase || !orgId || cache.has(orgId)) return;
    supabase
      .from('organizaciones')
      .select('logo_url')
      .eq('id', orgId)
      .maybeSingle()
      .then(({ data }) => fijarLogo(orgId, (data as { logo_url?: string | null } | null)?.logo_url ?? null));
  }, [orgId]);

  return orgId ? cache.get(orgId) ?? null : null;
}

/** Sube el logo y devuelve su URL pública. Reemplaza el anterior si lo había. */
export async function subirLogo(orgId: string, archivo: File, anterior: string | null): Promise<{ url?: string; error?: string }> {
  if (!supabase) return { error: 'Portal sin configurar.' };
  if (!TIPOS_LOGO.includes(archivo.type)) return { error: 'El logo tiene que ser PNG, JPG, WEBP o SVG.' };
  if (archivo.size > MAX_BYTES_LOGO) return { error: 'El logo no puede pesar más de 2 MB.' };
  const ext = archivo.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  // Nombre nuevo en cada subida, así el navegador no muestra el logo viejo cacheado.
  const ruta = `${orgId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET_LOGOS).upload(ruta, archivo, { contentType: archivo.type, upsert: false });
  if (error) return { error: error.message };
  const url = supabase.storage.from(BUCKET_LOGOS).getPublicUrl(ruta).data.publicUrl;
  await borrarArchivoLogo(anterior);
  return { url };
}

export async function borrarArchivoLogo(url: string | null) {
  if (!supabase || !url) return;
  const marca = `/${BUCKET_LOGOS}/`;
  const i = url.indexOf(marca);
  if (i < 0) return;
  await supabase.storage.from(BUCKET_LOGOS).remove([decodeURIComponent(url.slice(i + marca.length))]);
}
