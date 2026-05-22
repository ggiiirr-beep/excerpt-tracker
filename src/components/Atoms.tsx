import type { ReactNode } from 'react';

export function Star({ filled, size = 14 }: { filled: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M8 1.5l1.95 4.04 4.45.62-3.22 3.1.78 4.42L8 11.6l-3.96 2.08.78-4.42L1.6 6.16l4.45-.62z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span className={rating === 0 ? 'stars stars-unrated' : 'stars'} aria-label={rating === 0 ? 'No star rating' : `${rating} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} filled={n <= rating} size={size} />
      ))}
    </span>
  );
}

export function StarPicker({
  value,
  onChange,
  size = 28,
}: {
  value: number;
  onChange: (value: 1 | 2 | 3 | 4 | 5) => void;
  size?: number;
}) {
  return (
    <div className="star-picker">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n as 1 | 2 | 3 | 4 | 5)} aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`}>
          <Star filled={n <= value} size={size} />
        </button>
      ))}
    </div>
  );
}

export function Dot() {
  return <span className="focus-dot" aria-hidden="true" />;
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="field-label">{children}</label>;
}

export function confidenceLabel(value: number) {
  return ['not rated', 'needs work', 'shaky', 'coming along', 'solid', 'audition-ready'][value] || 'tap a star to rate';
}

export function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}
