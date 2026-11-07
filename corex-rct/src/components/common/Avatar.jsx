import React from 'react';

/**
 * Small image-with-fallback tile - shows an uploaded picture (user profile
 * picture or organization logo) when one exists, otherwise falls back to
 * initials or an icon on a background tile. Shared by Navbar, UsersList,
 * UserDetail, Settings (users, `rounded-full`) and OrganizationsList /
 * OrganizationDetail (org logos, `rounded-lg`).
 *
 * Sizing/shape (`className`) and the fallback background/text colors (`bg`,
 * `textClass`) are passed in as full literal strings rather than built from
 * a prop like `w-${size}` - Tailwind only picks up class names it can see
 * as literal text at build time, and interpolating them would silently
 * produce untracked, unstyled classes.
 */
const Avatar = ({
  src, initials, icon: Icon,
  className = 'w-10 h-10 rounded-full',
  bg = 'bg-gradient-to-br from-green-500 to-blue-500',
  textClass = 'text-white',
}) => (
  <div className={`${className} ${bg} ${textClass} flex items-center justify-center font-semibold overflow-hidden flex-shrink-0`}>
    {src
      ? <img src={src} alt={initials || 'avatar'} className="w-full h-full object-cover" />
      : Icon
        ? <Icon className="w-1/2 h-1/2" />
        : <span>{initials}</span>}
  </div>
);

export default Avatar;
