import React, { useState } from 'react';
import { ImageOff } from 'lucide-react';

/**
 * Thumbnail strip + main image. `images` is an array of {id, image (url)}
 * (matches RoomImageSerializer's shape). No lightbox/zoom — kept simple,
 * generic enough to reuse for any future gallery need.
 */
const ImageGallery = ({ images = [], alt = '', className = '' }) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const active = images[activeIdx];

  if (images.length === 0) {
    return (
      <div className={`aspect-video bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center ${className}`}>
        <ImageOff className="w-8 h-8 text-slate-400" />
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="aspect-video bg-slate-100 dark:bg-slate-700 rounded-xl overflow-hidden">
        <img src={active.image} alt={alt} className="w-full h-full object-cover" />
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 mt-2 overflow-x-auto">
          {images.map((img, idx) => (
            <button
              key={img.id ?? idx}
              onClick={() => setActiveIdx(idx)}
              className={`w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-colors ${
                idx === activeIdx ? 'border-green-500' : 'border-transparent'
              }`}
            >
              <img src={img.image} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ImageGallery;
