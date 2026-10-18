import { useEffect, useId, useRef, type ReactNode } from 'react';
import styles from './overlay.module.css';

interface Props {
  title: string;
  closeLabel: string;
  onClose(): void;
  children: ReactNode;
}

/** Diálogo modal: Escape y clic en el fondo cierran; el foco vuelve a quien lo abrió (library-spec 22). */
export function Overlay({ title, closeLabel, onClose, children }: Props) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>('button, input, [tabindex]')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus?.();
    };
  }, [onClose]);
  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={panel} className={styles.panel} role="dialog" aria-modal="true" aria-labelledby={id}>
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
