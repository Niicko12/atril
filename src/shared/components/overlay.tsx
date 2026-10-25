import { useEffect, useId, useRef, type ReactNode } from 'react';
import styles from './overlay.module.css';

interface Props {
  wide?: boolean;
  title: string;
  closeLabel: string;
  onClose(): void;
  children: ReactNode;
}

const FOCUSABLE = 'button, a[href], input, select, textarea, summary, [tabindex]';
function focusables(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => {
    const closed = el.closest('details:not([open])');
    const hiddenDetail = closed && !(el.tagName === 'SUMMARY' && el.parentElement === closed);
    return (
      el.tabIndex >= 0 &&
      !el.matches(':disabled, [type="hidden"]') &&
      !el.closest('[hidden], [inert], [aria-hidden="true"]') &&
      !hiddenDetail
    );
  });
}
function trapFocus(e: KeyboardEvent, panel: HTMLElement): void {
  if (e.key !== 'Tab') return;
  e.preventDefault();
  const items = focusables(panel);
  if (!items.length) {
    panel.focus();
    return;
  }
  const index = items.indexOf(document.activeElement as HTMLElement);
  const next =
    index < 0 ? (e.shiftKey ? items.length - 1 : 0) : (index + (e.shiftKey ? -1 : 1) + items.length) % items.length;
  items[next]?.focus();
}
/** Escape, foco atrapado y restaurado al cerrar, fondo sin desplazamiento (library-spec 22). */
export function Overlay({ title, closeLabel, onClose, children, wide = false }: Props) {
  const id = useId(),
    panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const el = panel.current;
    if (el) (focusables(el)[0] ?? el).focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (el) trapFocus(e, el);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) opener.focus();
    };
  }, [onClose]);
  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={panel}
        className={`${styles.panel} ${wide ? styles.wide : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        tabIndex={-1}
      >
        <div className={styles.head}>
          <h2 id={id}>{title}</h2>
          <button type="button" className={styles.btn} onClick={onClose}>
            {closeLabel}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const buttonStyles = styles;
