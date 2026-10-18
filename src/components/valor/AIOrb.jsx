import { useMemo } from 'react';
import { motion } from 'framer-motion';

const STATE_COLORS = {
  idle: { core: '#22d3ee', glow: '#0891b2', ring: '#3b82f6' },
  listening: { core: '#67e8f9', glow: '#06b6d4', ring: '#22d3ee' },
  thinking: { core: '#a78bfa', glow: '#7c3aed', ring: '#8b5cf6' },
  speaking: { core: '#60a5fa', glow: '#2563eb', ring: '#22d3ee' },
  error: { core: '#fbbf24', glow: '#b45309', ring: '#f59e0b' }
};

const STATE_LABEL = {
  idle: 'Ready',
  listening: 'Listening…',
  thinking: 'Thinking…',
  speaking: 'Speaking…',
  error: 'Voice unavailable'
};

export default function AIOrb({ state = 'idle', size = 300, level = 0 }) {
  const colors = STATE_COLORS[state] || STATE_COLORS.idle;
  // Live voice activity drives the core while listening or speaking.
  const reactive = state === 'listening' || state === 'speaking';
  const reactiveScale = 1.05 + Math.max(0, Math.min(1, level)) * 0.25;

  const particles = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        id: i,
        angle: (i / 14) * 360,
        delay: (i * 0.35) % 3.5
      })),
    []
  );

  const breatheScale =
    state === 'listening'
      ? [1, 1.13, 1]
      : state === 'speaking'
      ? [1, 1.09, 0.97, 1.07, 1]
      : state === 'thinking'
      ? [1, 1.04, 1]
      : [1, 1.05, 1];
  const breatheDur =
    state === 'listening'
      ? 1.1
      : state === 'speaking'
      ? 0.55
      : state === 'thinking'
      ? 1.8
      : 4;

  return (
    <div
      className="relative flex flex-col items-center justify-center select-none"
      style={{ width: size, height: size + 28 }}
    >
      <div
        className="relative flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        {/* Outer ambient glow */}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: size,
            height: size,
            background: `radial-gradient(circle, ${colors.glow}66 0%, ${colors.glow}22 42%, transparent 70%)`,
            filter: 'blur(34px)'
          }}
          animate={{ scale: breatheScale, opacity: [0.55, 0.9, 0.55] }}
          transition={{ duration: breatheDur, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Energy rings */}
        <motion.div
          className="absolute rounded-full border-2"
          style={{
            width: size * 0.82,
            height: size * 0.82,
            borderColor: `${colors.ring}33`,
            borderTopColor: colors.ring,
            borderStyle: 'dashed'
          }}
          animate={{ rotate: 360 }}
          transition={{
            duration: state === 'thinking' ? 2.2 : 9,
            repeat: Infinity,
            ease: 'linear'
          }}
        />
        <motion.div
          className="absolute rounded-full border"
          style={{
            width: size * 0.66,
            height: size * 0.66,
            borderColor: `${colors.core}28`,
            borderBottomColor: colors.core
          }}
          animate={{ rotate: -360 }}
          transition={{
            duration: state === 'thinking' ? 3.2 : 13,
            repeat: Infinity,
            ease: 'linear'
          }}
        />

        {/* Core sphere */}
        <motion.div
          className="relative rounded-full"
          style={{
            width: size * 0.5,
            height: size * 0.5,
            background: `radial-gradient(circle at 35% 30%, ${colors.core}, ${colors.glow} 58%, ${colors.glow}99 100%)`,
            boxShadow: `0 0 70px ${colors.glow}, inset 0 0 45px ${colors.core}99`
          }}
          animate={{ scale: reactive ? reactiveScale : breatheScale }}
          transition={
            reactive
              ? { duration: 0.1, ease: 'easeOut' }
              : { duration: breatheDur, repeat: Infinity, ease: 'easeInOut' }
          }
        >
          <div
            className="absolute rounded-full"
            style={{
              top: '12%',
              left: '20%',
              width: '32%',
              height: '26%',
              background:
                'radial-gradient(circle, rgba(255,255,255,0.65), transparent 70%)',
              filter: 'blur(4px)'
            }}
          />
        </motion.div>

        {/* Particles */}
        {particles.map((p) => {
          const rad = (p.angle * Math.PI) / 180;
          const inner = size * 0.34;
          const outer = size * 0.47;
          return (
            <motion.div
              key={p.id}
              className="absolute rounded-full"
              style={{
                width: 4,
                height: 4,
                background: colors.core,
                boxShadow: `0 0 8px ${colors.core}`
              }}
              animate={{
                x: [Math.cos(rad) * inner, Math.cos(rad) * outer, Math.cos(rad) * inner],
                y: [Math.sin(rad) * inner, Math.sin(rad) * outer, Math.sin(rad) * inner],
                opacity: [0.15, 0.9, 0.15]
              }}
              transition={{
                duration: 3 + p.delay,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: p.delay
              }}
            />
          );
        })}
      </div>

      <div
        className="mt-1 text-xs font-medium tracking-[0.25em] uppercase"
        style={{ color: colors.core }}
      >
        {STATE_LABEL[state]}
      </div>
    </div>
  );
}