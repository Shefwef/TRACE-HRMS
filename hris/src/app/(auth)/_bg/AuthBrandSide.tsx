'use client';

import { motion } from 'framer-motion';
import AuthBackground from './AuthBackground';

const easeOut = [0.16, 1, 0.3, 1] as const;

export default function AuthBrandSide() {
  return (
    <div className="auth-left">
      <AuthBackground />

      <motion.div
        className="auth-brand"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: easeOut }}
      >
        <img
          src="/TRACE%20HRMS%20Transparent%20White.png"
          alt="TRACE HRMS"
          className="auth-brand-logo"
        />
      </motion.div>

      <motion.div
        className="auth-hero"
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.1, delayChildren: 0.15 } },
        }}
      >
        <motion.h1
          variants={{
            hidden: { opacity: 0, y: 20 },
            show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: easeOut } },
          }}
        >
          Every leave. Every hour.
          <br />
          <span className="auth-hero-quiet">Everyone.</span>
        </motion.h1>

        <motion.p
          variants={{
            hidden: { opacity: 0, y: 20 },
            show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: easeOut } },
          }}
        >
          A calmer way to run people operations, with dashboards you can actually
          read and approvals that take seconds.
        </motion.p>
      </motion.div>
    </div>
  );
}
