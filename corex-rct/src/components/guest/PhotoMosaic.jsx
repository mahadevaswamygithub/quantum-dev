import React, { useCallback, useEffect, useState } from 'react';
import { BedDouble, ChevronLeft, ChevronRight, Images, X } from 'lucide-react';

/** Full-screen photo viewer with arrows, keyboard and a thumbnail strip. */
const Lightbox = ({ photos, start, alt, onClose }) => {
  const [idx, setIdx] = useState(start);
  const go = useCallback((d) => setIdx(i => (i + d + photos.length) % photos.length), [photos.length]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [go, onClose]);

  const arrow = 'absolute top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white flex items-center justify-center backdrop-blur';
  return (
    <div role="dialog" aria-modal="true" aria-label="Photos" className="fixed inset-0 z-[60] bg-slate-950/95 flex flex-col animate-pop-in motion-reduce:animate-none">
      <div className="flex items-center justify-between px-5 py-4 text-white">
        <p className="text-sm font-semibold">{idx + 1} / {photos.length}</p>
        <button type="button" onClick={onClose} aria-label="Close photos" className="p-2 rounded-full hover:bg-white/10"><X className="w-6 h-6" /></button>
      </div>
      <div className="relative flex-1 min-h-0 flex items-center justify-center px-4 sm:px-20">
        <img src={photos[idx]} alt={alt} className="max-h-full max-w-full object-contain rounded-xl" />
        {photos.length > 1 && (
          <>
            <button type="button" aria-label="Previous photo" onClick={() => go(-1)} className={`${arrow} left-4`}><ChevronLeft className="w-6 h-6" /></button>
            <button type="button" aria-label="Next photo" onClick={() => go(1)} className={`${arrow} right-4`}><ChevronRight className="w-6 h-6" /></button>
          </>
        )}
      </div>
      {photos.length > 1 && (
        <div className="flex gap-2 justify-center overflow-x-auto px-4 py-4">
          {photos.map((src, i) => (
            <button key={src} type="button" onClick={() => setIdx(i)} aria-label={`Photo ${i + 1}`}
              className={`flex-shrink-0 w-20 h-14 rounded-lg overflow-hidden ring-2 transition ${i === idx ? 'ring-green-400' : 'ring-transparent opacity-50 hover:opacity-100'}`}>
              <img src={src} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Photo mosaic: one large photo plus up to four tiles; "View all" opens the
 * full-screen viewer. Falls back gracefully to fewer photos.
 */
const PhotoMosaic = ({ photos = [], alt = '' }) => {
  const [open, setOpen] = useState(null);
  const tile = 'relative overflow-hidden bg-slate-200 dark:bg-slate-800 group';
  const img = 'absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500';

  if (!photos.length) {
    return (
      <div className="h-72 sm:h-[440px] rounded-3xl bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center gap-2 text-slate-400">
        <BedDouble className="w-12 h-12" /><span className="text-sm">Photos coming soon</span>
      </div>
    );
  }

  const side = photos.slice(1, 5);
  return (
    <>
      <div className={`grid gap-2 h-72 sm:h-[440px] rounded-3xl overflow-hidden ${side.length ? 'sm:grid-cols-[1.6fr_1fr]' : ''}`}>
        <button type="button" onClick={() => setOpen(0)} className={tile} aria-label="Open photos">
          <img src={photos[0]} alt={alt} className={img} />
        </button>
        {side.length > 0 && (
          <div className={`hidden sm:grid gap-2 ${side.length > 1 ? 'grid-cols-2' : ''} ${side.length > 2 ? 'grid-rows-2' : ''}`}>
            {side.map((src, i) => (
              <button key={src} type="button" onClick={() => setOpen(i + 1)} aria-label={`Open photo ${i + 2}`}
                className={`${tile} ${side.length === 3 && i === 0 ? 'row-span-2' : ''}`}>
                <img src={src} alt="" className={img} />
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="relative">
        <button type="button" onClick={() => setOpen(0)}
          className="absolute -top-14 right-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/95 dark:bg-slate-900/90 text-sm font-semibold text-slate-900 dark:text-white shadow-lg hover:bg-white">
          <Images className="w-4 h-4" /> View all {photos.length > 1 ? `(${photos.length})` : ''}
        </button>
      </div>
      {open !== null && <Lightbox photos={photos} start={open} alt={alt} onClose={() => setOpen(null)} />}
    </>
  );
};

export default PhotoMosaic;
