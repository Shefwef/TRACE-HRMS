'use client';

import { useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

/**
 * Animated aurora backdrop used on the sign-in / sign-up brand side.
 * Reacts subtly to pointer position to add depth without being distracting.
 */
export default function AuthBackground() {
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const smx = useSpring(mx, { stiffness: 60, damping: 20 });
  const smy = useSpring(my, { stiffness: 60, damping: 20 });

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      mx.set(e.clientX / w);
      my.set(e.clientY / h);
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [mx, my]);

  const blob1X = useTransform(smx, (v) => `${(v - 0.5) * -40}px`);
  const blob1Y = useTransform(smy, (v) => `${(v - 0.5) * -30}px`);
  const blob2X = useTransform(smx, (v) => `${(v - 0.5) * 30}px`);
  const blob2Y = useTransform(smy, (v) => `${(v - 0.5) * 40}px`);

  return (
    <div className="auth-bg" aria-hidden>
      <div className="auth-bg-mesh" />
      <div className="auth-bg-grid" />
      <motion.span
        className="auth-blob auth-blob-1"
        style={{ x: blob1X, y: blob1Y }}
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.span
        className="auth-blob auth-blob-2"
        style={{ x: blob2X, y: blob2Y }}
        animate={{ scale: [1, 1.12, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
      />
      <motion.span
        className="auth-blob auth-blob-3"
        animate={{ x: [0, 30, -20, 0], y: [0, -20, 20, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}
