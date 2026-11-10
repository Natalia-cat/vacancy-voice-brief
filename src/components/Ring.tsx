import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

// Кольцо прогресса — SPEC §6. 4 сектора × 18 делений, зазор в одно деление.
// Состояние деления: off / off-active / live (уровень min) / filled (medium) / gap.

export type Sector = { filled: number; live: number; gap: number }

export const TICKS = 18
const SLOTS = 76 // 4 × 18 + 4 зазора
const SIZE = 300
const R = 132
const W = 4
const H = 20

type TickState = 'off' | 'off-active' | 'live' | 'filled' | 'gap'

export function tickState(sector: Sector, i: number, active: boolean): TickState {
  if (i < sector.filled) return 'filled'
  if (i < sector.filled + sector.live) return 'live'
  if (sector.gap && i >= TICKS - sector.gap) return 'gap'
  return active ? 'off-active' : 'off'
}

export const percent = (sectors: Sector[]) =>
  Math.round((sectors.reduce((s, x) => s + x.filled, 0) / (TICKS * sectors.length)) * 100)

type Props = {
  sectors: Sector[]
  active: number | null
  complete?: boolean
  label: string
  children?: ReactNode
}

export function Ring({ sectors, active, complete, label, children }: Props) {
  const value = percent(sectors)
  return (
    <div className="ring-wrap">
      <div className="ring-glow" style={{ opacity: complete ? 1 : 0.55 }} />
      <svg
        className="ring-svg"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-valuetext={`${label}, заполнено ${value}%`}
      >
        {sectors.map((sector, k) =>
          Array.from({ length: TICKS }, (_, i) => {
            const slot = k * (TICKS + 1) + i + 1
            const angle = (slot / SLOTS) * 360
            const state = complete ? 'filled' : tickState(sector, i, active === k)
            return (
              <rect
                key={`${k}-${i}`}
                className={`tick tick--${state}`}
                x={SIZE / 2 - W / 2}
                y={SIZE / 2 - R - H / 2}
                width={W}
                height={H}
                rx={2}
                transform={`rotate(${angle} ${SIZE / 2} ${SIZE / 2})`}
                // волна: деления заполняются по очереди, 12 мс на деление (SPEC §11)
                style={{ transitionDelay: state === 'filled' ? `${i * 12}ms` : '0ms' }}
              />
            )
          }),
        )}
      </svg>
      <div className="ring-center">
        {complete ? (
          <motion.svg
            width="56"
            height="56"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 22 }}
            aria-hidden="true"
          >
            <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: 0.15 }} />
          </motion.svg>
        ) : (
          children
        )}
      </div>
    </div>
  )
}
