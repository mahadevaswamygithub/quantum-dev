import React from 'react';
import { X } from 'lucide-react';

/**
 * Shared modal overlay + header + close button shell, extracted from the
 * near-identical private `ModalWrapper` previously duplicated in
 * UserModals.js and OrganizationModals.jsx (byte-identical outer overlay
 * div in both; this keeps UserModals' slightly fuller version — `wide`
 * variant, scrollable body, sticky header — since it's a strict superset
 * and behaves identically to the plain version for content short enough
 * to never hit the 90vh cap, which covers every existing usage).
 *
 * NOTE: ForgotPasswordModal.js intentionally keeps its own distinct,
 * larger modal treatment (different padding/rounding/overlay opacity) —
 * not unified here since forcing it into this shape would be a visible
 * appearance change, not a pure de-dup.
 */
const Modal = ({ isOpen, onClose, title, wide = false, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className={`bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto ${wide ? 'max-w-2xl w-full' : 'max-w-md w-full'}`}>
        <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-800 z-10">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

export default Modal;
