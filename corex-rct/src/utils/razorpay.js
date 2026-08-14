/**
 * Loads Razorpay's hosted Checkout script on demand — no npm package, same
 * zero-extra-dependency approach this project already uses for Nominatim
 * geocoding (see utils/geocode.js). Cached so repeat bookings don't
 * re-inject the script tag.
 */
let loadingPromise = null;

export const loadRazorpayScript = () => {
  if (window.Razorpay) return Promise.resolve(true);
  if (loadingPromise) return loadingPromise;
  loadingPromise = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
  return loadingPromise;
};
