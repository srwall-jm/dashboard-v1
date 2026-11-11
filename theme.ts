// One source for the colours and labels that carry meaning across the product.
// Chosen to pass contrast on white, to stay apart for colour-blind viewers and in greyscale print.

import type { RecAction, Pressure } from './recommendations';

// Data series. Organic is always blue, paid always orange, totals near black.
export const SERIES = {
  organic: '#1D4ED8',
  paid: '#D97706',
  total: '#0F172A',
  context: '#94A3B8', // other channels, non-brand, background series. Never for text.
  grid: '#E2E8F0',
} as const;

// Previous period: the same colour as the series, thinner and dashed. Dashes mean "previous" and nothing else.
export const PREVIOUS_LINE = { strokeWidth: 1.5, strokeDasharray: '6 4' } as const;

export const AXIS_TICK = { fontSize: 12, fontWeight: 600, fill: '#475569' } as const;

// Recommendation actions: tinted badge, dark text, always with an icon and the word.
export const ACTION_STYLE: Record<RecAction, { label: string; badge: string; text: string }> = {
  REDUCE: { label: 'Reduce', badge: 'bg-[#CCFBF1] text-[#0F766E]', text: 'text-[#0F766E]' },
  INCREASE: { label: 'Increase', badge: 'bg-[#F5F3FF] text-[#6D28D9]', text: 'text-[#6D28D9]' },
  HOLD: { label: 'Keep as is', badge: 'bg-slate-100 text-slate-600', text: 'text-slate-600' },
  NO_DATA: { label: 'Too few clicks', badge: 'bg-white text-slate-500 border border-dashed border-slate-400', text: 'text-slate-500' },
};

// Competitor pressure: low is neutral, so colour is only spent on what needs attention.
export const PRESSURE_STYLE: Record<Pressure, { label: string; badge: string; bars: number }> = {
  low: { label: 'Low', badge: 'bg-slate-100 text-slate-600', bars: 1 },
  medium: { label: 'Medium', badge: 'bg-[#FEF3C7] text-[#B45309]', bars: 2 },
  high: { label: 'High', badge: 'bg-[#FEE2E2] text-[#B91C1C]', bars: 3 },
  unknown: { label: 'Unknown', badge: 'bg-white text-slate-500 border border-dashed border-slate-400', bars: 0 },
};

export const PRESSURE_HELP = "How often competitors' ads outrank yours on this keyword. The higher it is, the less we cut.";

// Change versus the previous period.
export const DELTA = { up: 'text-[#047857]', down: 'text-[#BE123C]', flat: 'text-slate-600' } as const;
