import React, { useMemo, useState } from 'react';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import { Globe2 } from 'lucide-react';
import worldTopology from 'world-atlas/countries-110m.json';
import { useTheme } from '../context/ThemeContext';
import { orgTypeLabel } from '../constants/orgTypes';

// Marker colors - validated with the dataviz skill's palette checker
// (CVD-safe adjacent pair + normal-vision floor + contrast, both themes,
// against these exact map surfaces): `node scripts/validate_palette.js
// "#16a34a,#a855f7" --mode light --surface "#f8fafc"` and `--mode dark
// --surface "#1e293b"` - both ALL CHECKS PASS. Same two hexes serve both
// themes; only the map chrome (land/border/ocean) swaps with theme.
const MARKER_COLORS = { MSP: '#16a34a', STP: '#a855f7' };

const MAP_CHROME = {
  light: { land: '#e2e8f0', landHover: '#cbd5e1', border: '#f8fafc', ring: '#ffffff' },
  dark: { land: '#334155', landHover: '#475569', border: '#1e293b', ring: '#1e293b' },
};

/**
 * World map plotting organizations by latitude/longitude (set via
 * Add/Edit Organization). Uses a bundled low-resolution topojson
 * (world-atlas, ~105KB) so there's no runtime tile-server/CDN dependency -
 * fully self-contained and free, per the org's "free map" requirement.
 */
const WorldMap = ({ organizations = [] }) => {
  const { theme } = useTheme();
  const chrome = MAP_CHROME[theme] || MAP_CHROME.light;
  const [hovered, setHovered] = useState(null); // { org, x, y }

  const located = useMemo(
    () => organizations.filter(o => o.latitude != null && o.longitude != null),
    [organizations]
  );

  const handleEnter = (org, e) => {
    const rect = e.currentTarget.closest('.cx-map-container')?.getBoundingClientRect();
    setHovered({
      org,
      x: rect ? e.clientX - rect.left : 0,
      y: rect ? e.clientY - rect.top : 0,
    });
  };
  const handleMove = (e) => {
    if (!hovered) return;
    const rect = e.currentTarget.closest('.cx-map-container')?.getBoundingClientRect();
    setHovered(h => h && ({ ...h, x: rect ? e.clientX - rect.left : h.x, y: rect ? e.clientY - rect.top : h.y }));
  };

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-900 dark:text-white">Organization Locations</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {located.length} of {organizations.length} organizations have a location set
          </p>
        </div>
        {/* Legend - two categorical series, always shown per dataviz rules */}
        <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: MARKER_COLORS.MSP }} />
            MSP
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: MARKER_COLORS.STP }} />
            STP
          </span>
        </div>
      </div>

      <div className="cx-map-container relative" onMouseLeave={() => setHovered(null)}>
        <ComposableMap
          projectionConfig={{ scale: 140 }}
          width={800}
          height={380}
          style={{ width: '100%', height: 'auto', display: 'block' }}
        >
          <Geographies geography={worldTopology}>
            {({ geographies }) =>
              geographies.map(geo => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={chrome.land}
                  stroke={chrome.border}
                  strokeWidth={0.5}
                  style={{
                    default: { outline: 'none' },
                    hover: { outline: 'none', fill: chrome.landHover },
                    pressed: { outline: 'none' },
                  }}
                />
              ))
            }
          </Geographies>

          {located.map(org => (
            <Marker
              key={org.id}
              coordinates={[Number(org.longitude), Number(org.latitude)]}
              onMouseEnter={e => handleEnter(org, e)}
              onMouseMove={handleMove}
              onFocus={e => handleEnter(org, e)}
              onBlur={() => setHovered(null)}
              tabIndex={0}
              style={{ default: { outline: 'none' }, hover: { outline: 'none' }, pressed: { outline: 'none' } }}
            >
              <title>{org.name}</title>
              {/* bigger transparent hit target than the painted mark, per interaction spec */}
              <circle r={12} fill="transparent" />
              <circle
                r={5}
                fill={MARKER_COLORS[org.tenant_type] || MARKER_COLORS.STP}
                stroke={chrome.ring}
                strokeWidth={2}
              />
            </Marker>
          ))}
        </ComposableMap>

        {hovered && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs shadow-lg"
            style={{ left: hovered.x, top: hovered.y - 10 }}
          >
            <p className="font-semibold text-slate-900 dark:text-white">{hovered.org.name}</p>
            <p className="text-slate-500 dark:text-slate-400 mt-0.5">
              {hovered.org.tenant_type}{hovered.org.org_type ? ` · ${orgTypeLabel(hovered.org.org_type)}` : ''}
            </p>
          </div>
        )}

        {organizations.length > 0 && located.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-slate-800/70">
            <div className="text-center px-6">
              <Globe2 className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No organizations have a location yet - add one from Edit Organization.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorldMap;
