import { useSyncExternalStore } from 'react';

/**
 * Whether the staff side menu is open as a drawer on phones. The ☰ button
 * (Navbar) and the menu (Sidebar) are siblings rendered by every page, so
 * they share this tiny store instead of each page passing props.
 */
let open = false;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

export const mobileNav = {
  toggle: () => { open = !open; emit(); },
  close: () => { if (open) { open = false; emit(); } },
};

const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export const useMobileNavOpen = () => useSyncExternalStore(subscribe, () => open, () => false);
