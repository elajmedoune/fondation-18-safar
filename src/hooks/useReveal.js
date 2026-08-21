import { useEffect, useRef, useState } from 'react';

/**
 * Retourne un ref à poser sur un élément et un booléen `visible` qui passe à
 * true la première fois que l'élément entre dans le viewport (scroll-reveal).
 * Se déclenche une seule fois — pas de va-et-vient si on re-scrolle dessus.
 */
export default function useReveal(options) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Si l'API n'est pas dispo (très vieux navigateur), on affiche direct.
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px', ...options }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, visible];
}