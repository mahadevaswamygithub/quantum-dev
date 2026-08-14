import React from 'react';

/**
 * Generic bordered content card. Generalizes the repeated
 * `bg-white dark:bg-slate-800 border ... rounded-xl` wrapper used across
 * every list/detail page. `hover` adds the subtle hover-border used on
 * clickable cards (e.g. OrganizationsList's card view).
 */
const Card = ({ children, hover = false, className = '', ...props }) => (
  <div
    className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl ${
      hover ? 'hover:border-slate-300 dark:hover:border-slate-600 transition-all' : ''
    } ${className}`}
    {...props}
  >
    {children}
  </div>
);

export default Card;
