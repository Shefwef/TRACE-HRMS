'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform, useScroll } from 'framer-motion';
import {
  ArrowRight,
  LogIn,
  ShieldCheck,
  Users,
  Calendar,
  Timer,
  Sparkles,
  BarChart3,
  Clock,
  FileCheck2,
  Fingerprint,
} from 'lucide-react';

/* ── Motion primitives ─────────────────────────────────────────────── */

const easeOut = [0.16, 1, 0.3, 1] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.05 * i, duration: 0.7, ease: easeOut },
  }),
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

/* ── Mouse-follow spotlight ────────────────────────────────────────── */

function Spotlight() {
  const x = useMotionValue(-500);
  const y = useMotionValue(-500);
  const sx = useSpring(x, { stiffness: 60, damping: 20, mass: 0.6 });
  const sy = useSpring(y, { stiffness: 60, damping: 20, mass: 0.6 });

  useEffect(() => {
    const move = (e: MouseEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    window.addEventListener('pointermove', move);
    return () => window.removeEventListener('pointermove', move);
  }, [x, y]);

  const background = useTransform(
    [sx, sy] as any,
    ([lx, ly]: number[]) =>
      `radial-gradient(600px circle at ${lx}px ${ly}px, rgba(99, 179, 237, 0.18), transparent 60%)`,
  );

  return <motion.div className="landing-spotlight" style={{ background }} aria-hidden />;
}

/* ── Aurora / blobs / grid ─────────────────────────────────────────── */

function AuroraBackdrop() {
  return (
    <div className="landing-backdrop" aria-hidden>
      <div className="landing-grid" />
      <motion.span
        className="landing-blob landing-blob-a"
        animate={{ x: [0, 40, -20, 0], y: [0, -30, 20, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.span
        className="landing-blob landing-blob-b"
        animate={{ x: [0, -50, 30, 0], y: [0, 40, -10, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.span
        className="landing-blob landing-blob-c"
        animate={{ x: [0, 25, -40, 0], y: [0, -25, 15, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

/* ── Magnetic button ───────────────────────────────────────────────── */

function Magnetic({ children, className, href }: { children: React.ReactNode; className?: string; href: string }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 300, damping: 20 });
  const sy = useSpring(y, { stiffness: 300, damping: 20 });

  const onMove = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * 0.25);
    y.set((e.clientY - (r.top + r.height / 2)) * 0.25);
  };
  const reset = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.a
      ref={ref}
      href={href}
      className={className}
      onPointerMove={onMove}
      onPointerLeave={reset}
      style={{ x: sx, y: sy }}
    >
      {children}
    </motion.a>
  );
}

/* ── Rotating word ─────────────────────────────────────────────────── */

const ROTATING = ['leave.', 'hour.', 'shift.', 'approval.'];

function RotatingWord() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % ROTATING.length), 2200);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="landing-rotator" aria-live="polite">
      {ROTATING.map((w, idx) => (
        <motion.span
          key={w}
          className="landing-rotator-word"
          initial={{ y: '110%', opacity: 0 }}
          animate={i === idx ? { y: '0%', opacity: 1 } : { y: '-110%', opacity: 0 }}
          transition={{ duration: 0.55, ease: easeOut }}
        >
          {w}
        </motion.span>
      ))}
      <span className="landing-rotator-ghost" aria-hidden>
        approval.
      </span>
    </span>
  );
}

/* ── Feature card ──────────────────────────────────────────────────── */

type Feature = {
  icon: React.ReactNode;
  title: string;
  body: string;
  bg: string;
  fg: string;
};

function FeatureCard({ f, i }: { f: Feature; i: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 180, damping: 18 });
  const sry = useSpring(ry, { stiffness: 180, damping: 18 });

  const onMove = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    ry.set(px * 8);
    rx.set(-py * 8);
  };
  const reset = () => {
    rx.set(0);
    ry.set(0);
  };

  return (
    <motion.div
      ref={ref}
      className="landing-card"
      variants={fadeUp}
      custom={i}
      onPointerMove={onMove}
      onPointerLeave={reset}
      style={{ rotateX: srx, rotateY: sry, transformPerspective: 900 }}
    >
      <div className="landing-card-glow" aria-hidden />
      <div className="landing-card-icon" style={{ background: f.bg, color: f.fg }}>
        {f.icon}
      </div>
      <h3>{f.title}</h3>
      <p>{f.body}</p>
    </motion.div>
  );
}

/* ── Live-mockup panel ─────────────────────────────────────────────── */

function MockupPanel() {
  return (
    <motion.div
      className="landing-mockup"
      initial={{ opacity: 0, y: 30, rotateX: 6 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.9, ease: easeOut, delay: 0.3 }}
    >
      <div className="landing-mockup-glow" aria-hidden />
      <div className="landing-mockup-head">
        <span className="landing-dot landing-dot-r" />
        <span className="landing-dot landing-dot-y" />
        <span className="landing-dot landing-dot-g" />
        <span className="landing-mockup-title">Today · Overview</span>
      </div>
      <div className="landing-mockup-body">
        <div className="landing-mock-stat">
          <div className="landing-mock-stat-label">Present</div>
          <div className="landing-mock-stat-value">
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9, duration: 0.6 }}
            >
              42
            </motion.span>
            <span className="landing-mock-stat-suffix">/ 48</span>
          </div>
          <div className="landing-bar">
            <motion.span
              initial={{ width: 0 }}
              animate={{ width: '87%' }}
              transition={{ delay: 1.0, duration: 1.1, ease: easeOut }}
            />
          </div>
        </div>
        <div className="landing-mock-row">
          <div className="landing-mock-pill landing-mock-pill-info">
            <Clock size={14} /> On leave · 4
          </div>
          <div className="landing-mock-pill landing-mock-pill-warn">
            <FileCheck2 size={14} /> Awaiting approval · 2
          </div>
        </div>
        <div className="landing-mock-list">
          {[
            { name: 'Nadia R.', tag: 'Casual', day: 'Today' },
            { name: 'Adib H.', tag: 'Replacement', day: 'Wed' },
            { name: 'Farah I.', tag: 'Sick', day: 'Thu' },
          ].map((row, idx) => (
            <motion.div
              key={row.name}
              className="landing-mock-item"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.1 + idx * 0.12, duration: 0.5, ease: easeOut }}
            >
              <div className="landing-mock-avatar">{row.name.charAt(0)}</div>
              <div className="landing-mock-item-main">
                <div className="landing-mock-item-name">{row.name}</div>
                <div className={`landing-mock-tag tag-${row.tag.toLowerCase()}`}>{row.tag}</div>
              </div>
              <div className="landing-mock-item-day">{row.day}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Marquee strip ─────────────────────────────────────────────────── */

function Marquee() {
  const items = [
    'Casual leave',
    'Sick leave',
    'Replacement leave',
    'Attendance',
    'Approvals',
    'Payroll-ready exports',
    'Analytics',
    'Biometric sync',
    'Team calendar',
  ];
  const strip = [...items, ...items];
  return (
    <div className="landing-marquee" aria-hidden>
      <motion.div
        className="landing-marquee-track"
        animate={{ x: ['0%', '-50%'] }}
        transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
      >
        {strip.map((t, i) => (
          <span key={i} className="landing-marquee-item">
            <Sparkles size={12} /> {t}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

/* ── Main ──────────────────────────────────────────────────────────── */

const features: Feature[] = [
  {
    icon: <Calendar size={20} />,
    title: 'Leave management',
    body: 'Apply, approve, and track casual, sick and replacement leaves - with partial-day and time-range support.',
    bg: 'var(--color-info-light)',
    fg: 'var(--color-brand-primary)',
  },
  {
    icon: <Timer size={20} />,
    title: 'Attendance tracking',
    body: 'Live clock-in / clock-out with breaks. Weekend extra work automatically becomes replacement leave.',
    bg: 'var(--color-leave-replacement-light)',
    fg: 'var(--color-leave-replacement)',
  },
  {
    icon: <Users size={20} />,
    title: 'Team overview',
    body: 'HR and leadership see the whole team at a glance - who’s in, who’s out, and what’s coming up.',
    bg: 'var(--color-leave-holiday-light)',
    fg: 'var(--color-brand-primary)',
  },
  {
    icon: <BarChart3 size={20} />,
    title: 'Analytics that read themselves',
    body: 'Balances, trends and utilisation in dashboards you can actually understand at a glance.',
    bg: 'var(--color-leave-casual-light)',
    fg: 'var(--color-leave-casual)',
  },
  {
    icon: <Fingerprint size={20} />,
    title: 'Biometric-ready',
    body: 'Bring your ZKBioTime device data in and reconcile it against approved leave automatically.',
    bg: 'var(--color-leave-sick-light)',
    fg: 'var(--color-leave-sick)',
  },
  {
    icon: <ShieldCheck size={20} />,
    title: 'Role-aware access',
    body: 'Admins, HR, line managers and employees each see exactly what they should - nothing more.',
    bg: 'var(--color-success-light)',
    fg: 'var(--color-success)',
  },
];

export default function LandingClient() {
  const { scrollYProgress } = useScroll();
  const progress = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

  return (
    <div className="landing">
      <AuroraBackdrop />
      <Spotlight />
      <motion.div className="landing-progress" style={{ scaleX: scrollYProgress }} />

      <header className="landing-nav">
        <motion.div
          className="landing-brand"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: easeOut }}
        >
          <img
            src="/Trace%20Consulting%20Logo%20Dark.png"
            alt="TRACE HRMS"
            className="landing-brand-logo"
          />
        </motion.div>
        <motion.nav
          className="landing-nav-actions"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: easeOut, delay: 0.1 }}
        >
          <a href="#features" className="landing-nav-link">
            Features
          </a>
          <a href="#preview" className="landing-nav-link">
            Preview
          </a>
          <Link href="/sign-in" className="landing-nav-cta">
            <LogIn size={16} />
            Sign in
          </Link>
        </motion.nav>
      </header>

      <main className="landing-hero">
        <motion.div
          className="landing-hero-inner"
          variants={stagger}
          initial="hidden"
          animate="show"
        >
          <div className="landing-hero-text">
            <motion.div className="landing-eyebrow" variants={fadeUp}>
              <span className="landing-eyebrow-dot" /> TRACE Consulting · Internal HRMS
            </motion.div>

            <motion.h1 variants={fadeUp} custom={1}>
              Every <RotatingWord /> <br />
              <span className="landing-h1-quiet">Everyone. Everywhere.</span>
            </motion.h1>

            <motion.p variants={fadeUp} custom={2}>
              A calmer way to run your people operations - balances that always add
              up, dashboards you can actually read, and approvals that take seconds,
              not screens.
            </motion.p>

            <motion.div className="landing-actions" variants={fadeUp} custom={3}>
              <Magnetic href="/sign-in" className="landing-btn landing-btn-primary">
                Sign in to your account
                <ArrowRight size={16} />
              </Magnetic>
              <Magnetic href="/sign-up" className="landing-btn landing-btn-ghost">
                Create an account
              </Magnetic>
            </motion.div>

            <motion.div className="landing-note" variants={fadeUp} custom={4}>
              <ShieldCheck size={14} />
              Invite-only for TRACE Consulting staff. Reach out to HR for access.
            </motion.div>
          </div>

          <div id="preview" className="landing-hero-visual">
            <MockupPanel />
          </div>
        </motion.div>
      </main>

      <Marquee />

      <section id="features" className="landing-features">
        <motion.div
          className="landing-features-head"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: easeOut }}
        >
          <div className="landing-eyebrow">
            <span className="landing-eyebrow-dot" /> What’s inside
          </div>
          <h2>Built for calm, run for scale.</h2>
          <p>
            A tight, opinionated set of tools that covers the whole leave &amp; attendance
            lifecycle - without the enterprise bloat.
          </p>
        </motion.div>

        <motion.div
          className="landing-cards"
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
        >
          {features.map((f, i) => (
            <FeatureCard key={f.title} f={f} i={i} />
          ))}
        </motion.div>
      </section>

      <section className="landing-cta">
        <motion.div
          className="landing-cta-card"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: easeOut }}
        >
          <div className="landing-cta-glow" aria-hidden />
          <h2>Ready to run people ops the calm way?</h2>
          <p>Sign in with your TRACE email and pick up where the team left off.</p>
          <div className="landing-actions">
            <Magnetic href="/sign-in" className="landing-btn landing-btn-primary">
              Sign in <ArrowRight size={16} />
            </Magnetic>
            <Magnetic href="/sign-up" className="landing-btn landing-btn-ghost">
              Create an account
            </Magnetic>
          </div>
        </motion.div>
      </section>

      <footer className="landing-footer">
        <span>© {new Date().getFullYear()} TRACE Consulting</span>
        <span className="landing-footer-mid">Powered by HRMS</span>
        <span className="landing-footer-links">
          <Link href="/sign-in">Sign in</Link>
          <span>·</span>
          <Link href="/sign-up">Sign up</Link>
        </span>
      </footer>
    </div>
  );
}
