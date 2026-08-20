import { useEffect, useRef, useState } from 'react';
import { FileDown, ChevronDown } from 'lucide-react';

/**
 * Bouton "Exporter" avec menu déroulant dont la position est calculée en JS
 * (et contrainte à la largeur de l'écran) plutôt que positionnée en pur CSS.
 * Evite que le menu sorte de l'écran quand le bouton est près d'un bord,
 * ce qui arrive souvent sur mobile (grilles de boutons, headers empilés...).
 */
export default function ExportMenu({ label, items, buttonClassName, menuWidth = 176, wrapperClassName = 'relative inline-block' }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);

  const toggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const margin = 8;
      const left = Math.min(
        Math.max(rect.right - menuWidth, margin),
        window.innerWidth - menuWidth - margin
      );
      setPos({ top: rect.bottom + 4, left });
    }
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  return (
    <div className={wrapperClassName}>
      <button
        ref={btnRef}
        onClick={toggle}
        className={buttonClassName || "w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-800 px-3 py-2 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"}
      >
        <FileDown className="h-3.5 w-3.5 shrink-0" /> {label} <ChevronDown className="h-3 w-3 shrink-0" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            style={{ top: pos.top, left: pos.left, width: menuWidth }}
            className="fixed z-20 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl overflow-hidden max-h-64 overflow-y-auto"
          >
            {items.map((item, i) => (
              <button
                key={i}
                onClick={() => { item.onClick(); setOpen(false); }}
                className={`w-full text-left px-3 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${item.bold ? 'font-medium' : ''}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
