/**
 * Vanta.js + Three.js client-side background controller
 * - Warm Cream color scheme
 * - Graceful fallback on WebGL failure or reduced motion
 * - Server-side safe (runs strictly in browser)
 */
document.addEventListener('DOMContentLoaded', () => {
  const heroElement = document.getElementById('vanta-hero-canvas');
  if (!heroElement) return;

  // Check prefers-reduced-motion
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    console.log('[VANTA] prefers-reduced-motion enabled, using static CSS fallback.');
    return;
  }

  // Ensure Three and Vanta are loaded
  if (typeof THREE === 'undefined' || typeof VANTA === 'undefined' || !VANTA.FOG) {
    console.warn('[VANTA] Libraries not loaded or WebGL not available. Using CSS fallback.');
    return;
  }

  let vantaEffect = null;
  try {
    vantaEffect = VANTA.FOG({
      el: '#vanta-hero-canvas',
      mouseControls: true,
      touchControls: true,
      gyroControls: false,
      minHeight: 200.00,
      minWidth: 200.00,
      highlightColor: 0xB86F45, // Terracotta accent
      midtoneColor: 0x354B35,   // Olive Green
      lowlightColor: 0xE9E0D2,  // Sand
      baseColor: 0xFAF5EC,      // Warm Cream
      blurFactor: 0.6,
      zoom: 0.8,
      speed: 1.0
    });

    window.addEventListener('beforeunload', () => {
      if (vantaEffect) {
        vantaEffect.destroy();
      }
    });
  } catch (err) {
    console.warn('[VANTA INITIALIZATION ERROR]:', err.message);
  }
});
