import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const STORAGE_KEY = 'scroll-positions';

function getPositions() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
  } catch { return {}; }
}

function savePosition(path, y) {
  const positions = getPositions();
  positions[path] = y;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
}

export function clearScrollPositions() {
  sessionStorage.removeItem(STORAGE_KEY);
}

export default function useScrollRestoration(scrollRef) {
  const location = useLocation();
  const pathRef = useRef(location.pathname);
  const restoredRef = useRef(false);

  useEffect(() => {
    const container = scrollRef?.current;
    if (!container) return;

    const prevPath = pathRef.current;
    const currentPath = location.pathname;

    if (prevPath !== currentPath) {
      savePosition(prevPath, container.scrollTop);
      pathRef.current = currentPath;
      restoredRef.current = false;
    }

    if (!restoredRef.current) {
      const positions = getPositions();
      const savedY = positions[currentPath] || 0;
      requestAnimationFrame(() => {
        container.scrollTop = savedY;
      });
      restoredRef.current = true;
    }

    const handleScroll = () => {
      savePosition(currentPath, container.scrollTop);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [location.pathname, scrollRef]);
}
