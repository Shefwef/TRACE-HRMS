import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import './Modal.css';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  widthOverride?: number | string;
  hideHeader?: boolean;
  /**
   * Stack depth for nested modals. Default 0 (top-level). Pass 1 when this
   * modal opens on top of another modal so its overlay + dialog paint above
   * the parent (parent gets dimmed + blurred behind the new overlay).
   */
  stackLevel?: number;
}

export function Modal({
  open, onClose, title, children, footer,
  size = 'md', widthOverride, hideHeader, stackLevel = 0,
}: Props) {
  const widths: Record<string, number | string> = {
    sm: 360, md: 480, lg: 640, xl: 780,
    full: 'min(1200px, calc(100vw - 48px))',
  };
  const finalWidth = widthOverride ?? widths[size];
  // Nested modals bump their overlay + dialog above the parent's dialog
  // (base overlay 70 / dialog 71) so the parent gets covered and blurred.
  const overlayZ = 70 + stackLevel * 10;
  const wrapZ    = 71 + stackLevel * 10;
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="modal-overlay"
            style={{ zIndex: overlayZ }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />
          <div className="modal-wrap" style={{ zIndex: wrapZ }} onClick={onClose}>
            <motion.div
              className={`modal${size === 'full' ? ' modal--full' : ''}`}
              style={{ width: finalWidth }}
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              {!hideHeader && (
                <header className="modal-header">
                  <h3>{title}</h3>
                  <button className="modal-close" onClick={onClose} aria-label="Close">
                    <X size={18} />
                  </button>
                </header>
              )}
              <div className="modal-body">{children}</div>
              {footer && <footer className="modal-footer">{footer}</footer>}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
