import React, { useState } from 'react';
import { ArrowDown, ArrowUpRight, FileText, Play } from 'lucide-react';
import retrato from '../../assets/brand/retrato.jpg';
import { Enlace } from './ui';
import { fechaLarga, formatoDe } from './descargas';
import type { Documento } from './tipos';
import { VisorVideo, videoDe } from '../protocolos/Video';
import { presentacionDe } from '../protocolos/videos';

/**
 * Tarjeta de un protocolo con el diseño de los posteos de @agustin.legales: fondo tinta, volanta en
 * pastilla, título en Archivo pesada, firma de Agustín y un círculo grande que dice qué pasa al tocarla
 * (play para los videos, flecha para los documentos).
 */

export const TarjetaProtocolo: React.FC<{
  doc: Documento;
  areas: Record<string, string>;
  /** Descarga el archivo. Devuelve cuando terminó. */
  alDescargar: (d: Documento) => void;
  /** Se llama al abrir un video o un enlace, para la bitácora. */
  alAbrir: (d: Documento) => void;
  bajando: boolean;
}> = ({ doc, areas, alDescargar, alAbrir, bajando }) => {
  const [viendo, setViendo] = useState(false);
  const enSitio = Boolean(doc.url?.startsWith('/'));
  // Un protocolo del sitio con video de presentación cargado se ve como video y el protocolo se abre aparte.
  const presentacion = enSitio ? presentacionDe(doc.url) : null;
  const video = videoDe(doc.url) ?? videoDe(presentacion);
  const volanta = video ? 'Video' : doc.url ? formatoDe(doc) : 'Protocolo escrito';
  const accion = video ? `Ver el video ${doc.titulo}` : doc.archivo_ruta ? `Descargar ${doc.titulo}` : `Abrir ${doc.titulo}`;
  const nombresAreas = doc.areas.map((a) => areas[a] ?? a);

  const contenido = (
    <>
      {/* Franja diagonal más clara detrás del círculo, como en la tarjeta del posteo */}
      <span aria-hidden="true" className="absolute inset-y-0 right-0 w-[34%] bg-grafito/70 [clip-path:polygon(28%_0,100%_0,100%_100%,0_100%)]" />
      <span className="relative flex flex-col gap-4 min-w-0 flex-1 p-6 desk:p-7">
        <span className="self-start inline-flex items-center h-7 px-3 rounded-pastilla bg-marfil text-tinta text-[11px] font-semibold uppercase tracking-[0.16em] [font-stretch:125%]">{volanta}</span>
        <span className="text-[22px] desk:text-[26px] leading-[1.08] font-extrabold tracking-[-0.035em] text-marfil text-left">{doc.titulo}</span>
        {doc.descripcion && <span className="text-[14px] leading-[1.5] text-calido text-left line-clamp-2">{doc.descripcion}</span>}
        <span className="mt-auto pt-2 flex items-center gap-3">
          <img src={retrato} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
          <span className="flex flex-col leading-tight text-left">
            <span className="text-[14px] font-bold text-marfil">Agustín Castro</span>
            <span className="text-[13px] text-calido">Abogado · firma</span>
          </span>
        </span>
      </span>
      <span className="relative shrink-0 self-center mr-6 desk:mr-8 w-[72px] h-[72px] desk:w-[96px] desk:h-[96px] rounded-full bg-marfil text-tinta grid place-items-center transition-transform duration-200 group-hover:scale-105">
        {video ? (
          <Play size={30} fill="currentColor" strokeWidth={0} aria-hidden="true" className="ml-1" />
        ) : doc.archivo_ruta ? (
          <ArrowDown size={30} strokeWidth={2} aria-hidden="true" />
        ) : doc.url ? (
          <ArrowUpRight size={30} strokeWidth={2} aria-hidden="true" />
        ) : (
          <FileText size={28} strokeWidth={1.75} aria-hidden="true" />
        )}
      </span>
    </>
  );

  const clase = 'group relative w-full flex-1 min-h-[240px] flex items-stretch overflow-hidden rounded-[24px] bg-tinta text-marfil shadow-relieve transition-transform duration-200 hover:-translate-y-0.5 disabled:opacity-70';

  return (
    <article className="flex flex-col gap-3 h-full">
      {video ? (
        <button
          type="button"
          className={clase}
          aria-label={accion}
          onClick={() => {
            setViendo(true);
            alAbrir(doc);
          }}
        >
          {contenido}
        </button>
      ) : doc.archivo_ruta ? (
        <button type="button" className={clase} aria-label={accion} onClick={() => alDescargar(doc)} disabled={bajando}>
          {contenido}
        </button>
      ) : doc.url && enSitio ? (
        <Enlace a={doc.url} className={clase} aria-label={accion} onClick={() => alAbrir(doc)}>
          {contenido}
        </Enlace>
      ) : doc.url ? (
        <a href={doc.url} target="_blank" rel="noopener noreferrer" className={clase} aria-label={accion} onClick={() => alAbrir(doc)}>
          {contenido}
        </a>
      ) : (
        <div className={clase}>{contenido}</div>
      )}
      {presentacion && video && doc.url && (
        <Enlace a={doc.url} className="self-start inline-flex items-center gap-1.5 px-1 text-[14px] font-semibold text-tinta underline-offset-4 hover:underline" onClick={() => alAbrir(doc)}>
          Abrir el protocolo
          <ArrowUpRight size={16} aria-hidden="true" />
        </Enlace>
      )}
      <p className="px-1 text-[13px] text-piedra">
        {bajando ? 'Preparando la descarga…' : [nombresAreas.length ? `Para ${nombresAreas.join(' y ')}` : 'Para todo el equipo', `actualizado el ${fechaLarga(doc.actualizado_en)}`].join(' · ')}
      </p>
      {viendo && video && <VisorVideo titulo={doc.titulo} video={video} alCerrar={() => setViendo(false)} />}
    </article>
  );
};
