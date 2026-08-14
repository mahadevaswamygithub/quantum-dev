import React from 'react';

/**
 * ₹-formatted amount — matches the currency_symbol default already used
 * for payroll (SalarySettings). `suffix` is for things like "/ night".
 */
const PriceTag = ({ amount, suffix = '', className = '' }) => {
  const value = Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <span className={className}>
      ₹{value}{suffix && <span className="text-slate-400 dark:text-slate-500 text-sm font-normal"> {suffix}</span>}
    </span>
  );
};

export default PriceTag;
