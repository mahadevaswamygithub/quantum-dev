import React, { useEffect, useRef, useState } from 'react';
import { HelpCircle } from 'lucide-react';

const Tooltip = ({
  content,
  children,
  position = 'top',
  align = 'left',
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const rootRef = useRef(null);

  // Touch devices have no hover/mouseleave, so close on a tap outside or Escape.
  useEffect(() => {
    if (!isVisible) return undefined;
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setIsVisible(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setIsVisible(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isVisible]);

  if (!content) return null;

  const getPositionClass = () => {
    if (position === 'left') return 'right-full top-1/2 -translate-y-1/2 mr-2';
    if (position === 'right') return 'left-full top-1/2 -translate-y-1/2 ml-2';

    const y = position === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2';
    if (align === 'center') return `${y} left-1/2 -translate-x-1/2`;
    if (align === 'right') return `${y} -right-2`;
    return `${y} -left-2`; // default align left prevents clipping against left modal edges
  };

  const getArrowClass = () => {
    if (position === 'left') {
      return 'left-full top-1/2 -translate-y-1/2 border-l-slate-900 dark:border-l-slate-800 border-y-transparent border-r-transparent';
    }
    if (position === 'right') {
      return 'right-full top-1/2 -translate-y-1/2 border-r-slate-900 dark:border-r-slate-800 border-y-transparent border-l-transparent';
    }

    const yBorder = position === 'bottom'
      ? 'bottom-full border-b-slate-900 dark:border-b-slate-800 border-x-transparent border-t-transparent'
      : 'top-full border-t-slate-900 dark:border-t-slate-800 border-x-transparent border-b-transparent';

    if (align === 'center') return `${yBorder} left-1/2 -translate-x-1/2`;
    if (align === 'right') return `${yBorder} right-[14px] translate-x-1/2`;
    return `${yBorder} left-[14px] -translate-x-1/2`;
  };

  // onClick is open-only (not a toggle): a tap/click also fires focus or
  // mouseenter first, so toggling would immediately hide what was just shown.
  return (
    <span
      ref={rootRef}
      className={`relative inline-flex items-center align-middle ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
      onClick={() => setIsVisible(true)}
    >
      {children || (
        <button
          type="button"
          aria-label="More information"
          className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors cursor-help inline-flex items-center rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      )}

      {isVisible && (
        <span
          role="tooltip"
          className={`absolute z-50 block ${getPositionClass()} w-max max-w-[280px] sm:max-w-xs px-2.5 py-1.5 text-xs text-white bg-slate-900/95 dark:bg-slate-800 dark:text-slate-100 rounded-md shadow-xl border border-slate-800 dark:border-slate-700/80 backdrop-blur-sm pointer-events-none transition-all duration-150 animate-in fade-in-0 zoom-in-95`}
        >
          <span className="block leading-snug text-left font-normal whitespace-normal break-words">{content}</span>
          <span
            className={`absolute block border-4 ${getArrowClass()}`}
            aria-hidden="true"
          />
        </span>
      )}
    </span>
  );
};

export default Tooltip;
