'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export default function MobileExperience({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const touchStart = useRef(null);
  const refreshing = useRef(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshingState, setRefreshingState] = useState(false);

  useEffect(() => {
    if (!('ontouchstart' in window)) return undefined;
    const start = (event) => {
      if (window.scrollY > 0 || event.touches.length !== 1) return;
      const target = event.target;
      if (target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"], .reader-content, .study-content, .editor-dialog, .media-preview-dialog, .subject-dropdown, .site-navbar-content')) return;
      touchStart.current = { y: event.touches[0].clientY, x: event.touches[0].clientX };
    };
    const move = (event) => {
      if (!touchStart.current || refreshing.current || window.scrollY > 0 || event.touches.length !== 1) return;
      const dy = event.touches[0].clientY - touchStart.current.y;
      const dx = event.touches[0].clientX - touchStart.current.x;
      if (dy <= 0 || Math.abs(dx) > Math.abs(dy) * 0.8) {
        if (dy < 0 || Math.abs(dx) > Math.abs(dy) * 0.8) { touchStart.current = null; setPullDistance(0); }
        return;
      }
      setPullDistance(Math.min(84, dy * 0.48));
    };
    const end = () => {
      if (pullDistance >= 58 && !refreshing.current) {
        refreshing.current = true;
        setRefreshingState(true);
        setPullDistance(58);
        router.refresh();
        window.setTimeout(() => {
          refreshing.current = false;
          setRefreshingState(false);
          setPullDistance(0);
        }, 850);
      } else setPullDistance(0);
      touchStart.current = null;
    };
    window.addEventListener('touchstart', start, { passive: true });
    window.addEventListener('touchmove', move, { passive: true });
    window.addEventListener('touchend', end, { passive: true });
    window.addEventListener('touchcancel', end, { passive: true });
    return () => {
      window.removeEventListener('touchstart', start);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', end);
      window.removeEventListener('touchcancel', end);
    };
  }, [pullDistance, router]);

  useEffect(() => {
    document.documentElement.dataset.route = pathname || '/';
  }, [pathname]);

  return (
    <>
      <div className={'ios-pull-indicator' + (refreshingState ? ' is-refreshing' : '')} style={{ transform: `translate(-50%, ${Math.max(0, pullDistance)}px)`, opacity: pullDistance > 4 || refreshingState ? 1 : 0 }} aria-live="polite" aria-label={refreshingState ? 'Refreshing page' : 'Pull down to refresh'}>
        <span className="ios-pull-spinner" />
        <span>{refreshingState ? 'Refreshing…' : pullDistance >= 58 ? 'Release to refresh' : 'Pull to refresh'}</span>
      </div>
      <div className="ios-route-stage" key={pathname || '/'}>{children}</div>
    </>
  );
}
