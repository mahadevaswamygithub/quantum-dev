import React, { useState } from 'react';
import { BedDouble, ChevronLeft, ChevronRight } from 'lucide-react';

const RoomGallery = ({ images = [], alt = '' }) => {
  const [idx, setIdx] = useState(0);

  if (images.length === 0) {
    return (
      <div className="h-64 sm:h-96 xl:h-[480px] rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
        <BedDouble className="w-12 h-12" />
      </div>
    );
  }

  const go = (d) => setIdx(i => (i + d + images.length) % images.length);
  const arrow = 'absolute top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-slate-800 shadow flex items-center justify-center';

  return (
    <div>
      <div className="relative h-64 sm:h-96 xl:h-[480px] rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800">
        <img src={images[idx].image} alt={alt} className="w-full h-full object-cover" />
        {images.length > 1 && (
          <>
            <button type="button" aria-label="Previous photo" onClick={() => go(-1)} className={`${arrow} left-3`}><ChevronLeft className="w-5 h-5" /></button>
            <button type="button" aria-label="Next photo" onClick={() => go(1)} className={`${arrow} right-3`}><ChevronRight className="w-5 h-5" /></button>
            <span className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full bg-slate-900/70 text-white text-xs font-medium">
              {idx + 1} / {images.length}
            </span>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={img.id ?? i}
              type="button"
              onClick={() => setIdx(i)}
              aria-label={`Photo ${i + 1}`}
              className={`w-20 h-14 flex-shrink-0 rounded-lg overflow-hidden ring-2 transition ${i === idx ? 'ring-green-500' : 'ring-transparent opacity-70 hover:opacity-100'}`}
            >
              <img src={img.image} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default RoomGallery;
