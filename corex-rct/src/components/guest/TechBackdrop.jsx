import React from 'react';

const GRID = {
  backgroundImage:
    'linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)',
  backgroundSize: '56px 56px',
  maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
  WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
};

/**
 * Decorative layer for dark sections of the booking site: a faint grid and
 * soft green / blue / teal glows (same palette as the staff login). Purely visual - sits behind
 * the content (`pointer-events-none`, hidden from screen readers).
 */
const TechBackdrop = ({ grid = true, intensity = 'normal' }) => {
  const o = intensity === 'soft' ? 'opacity-50' : 'opacity-90';
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className={`absolute -top-40 -left-32 w-[36rem] h-[36rem] rounded-full bg-green-500/25 blur-[120px] ${o}`} />
      <div className={`absolute top-1/4 -right-40 w-[32rem] h-[32rem] rounded-full bg-blue-500/30 blur-[120px] ${o}`} />
      <div className={`absolute -bottom-48 left-1/3 w-[30rem] h-[30rem] rounded-full bg-teal-500/20 blur-[120px] ${o}`} />
      {grid && <div className="absolute inset-0" style={GRID} />}
    </div>
  );
};

export default TechBackdrop;
