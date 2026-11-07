import React from 'react';

/**
 * Shared page background for the auth-style screens (Login, Register,
 * CustomerLogin, CustomerRegister) - soft, blurred brand-color blobs over
 * the existing slate gradient so these screens read as less flat, without
 * needing an actual uploaded image. Purely decorative (pointer-events-none
 * so it never intercepts clicks) and themed for both light and dark.
 */
const AuthBackground = ({ children }) => (
  <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center p-4">
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-green-400/20 dark:bg-green-500/10 blur-3xl" />
      <div className="absolute -bottom-32 -right-32 w-[28rem] h-[28rem] rounded-full bg-blue-400/20 dark:bg-blue-500/10 blur-3xl" />
      <div className="absolute top-1/3 right-1/4 w-72 h-72 rounded-full bg-emerald-300/15 dark:bg-emerald-500/10 blur-3xl" />
    </div>
    <div className="relative z-10 w-full flex items-center justify-center">
      {children}
    </div>
  </div>
);

export default AuthBackground;
