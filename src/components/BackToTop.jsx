import { useEffect, useState } from 'react';

/**
 * Floating button that appears after scrolling down; clicking smoothly
 * scrolls the page back to the top. Placed fixed in the bottom-right so
 * it stays out of the way of the main content and dashboard toolbars.
 */
export default function BackToTop({ threshold = 240 }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      const y = window.pageYOffset || document.documentElement.scrollTop || 0;
      setVisible(y > threshold);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="回到頂端"
      title="回到頂端"
      className="fixed bottom-6 right-6 w-11 h-11 rounded-full shadow-lg flex items-center justify-center text-white transition-opacity hover:opacity-90"
      style={{ background: '#2A5598', zIndex: 50 }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="18 15 12 9 6 15" />
      </svg>
    </button>
  );
}
