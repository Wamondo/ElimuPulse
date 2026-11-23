import React from 'react';

export const MATH_SYMBOLS: Array<{ label: string; insert: string; title: string }> = [
  { label: '÷', insert: ' ÷ ', title: 'Division' },
  { label: '×', insert: ' × ', title: 'Multiplication' },
  { label: '±', insert: ' ± ', title: 'Plus-minus' },
  { label: '√()', insert: '√(', title: 'Square root' },
  { label: 'x²', insert: '²', title: 'Squared' },
  { label: 'x³', insert: '³', title: 'Cubed' },
  { label: 'xⁿ', insert: '^{n}', title: 'Power / Exponent' },
  { label: 'a/b', insert: '\\frac{a}{b}', title: 'Fraction' },
  { label: 'π', insert: 'π', title: 'Pi' },
  { label: 'θ', insert: 'θ', title: 'Theta' },
  { label: '∠', insert: '∠', title: 'Angle' },
  { label: '△', insert: '△', title: 'Triangle' },
  { label: '⊥', insert: ' ⊥ ', title: 'Perpendicular' },
  { label: '∥', insert: ' ∥ ', title: 'Parallel' },
  { label: '°', insert: '°', title: 'Degrees' },
  { label: '≤', insert: ' ≤ ', title: 'Less than or equal' },
  { label: '≥', insert: ' ≥ ', title: 'Greater than or equal' },
  { label: '≠', insert: ' ≠ ', title: 'Not equal' },
  { label: '≈', insert: ' ≈ ', title: 'Approximately equal' },
];

function renderToken(token: string, keyPrefix: string): React.ReactNode {
  // Match \frac{num}{den}
  const fracMatch = token.match(/^\\frac\{([^{}]+)\}\{([^{}]+)\}$/);
  if (fracMatch) {
    return (
      <span
        key={keyPrefix}
        className="inline-flex flex-col items-center align-middle mx-1 leading-none text-[11px] font-mono"
      >
        <span className="border-b border-current px-1 pb-0.5">{fracMatch[1]}</span>
        <span className="pt-0.5">{fracMatch[2]}</span>
      </span>
    );
  }

  // Match \sqrt{expr}
  const sqrtMatch = token.match(/^\\sqrt\{([^{}]+)\}$/);
  if (sqrtMatch) {
    return (
      <span key={keyPrefix} className="inline-flex items-center mx-0.5 font-mono">
        <span>√</span>
        <span className="border-t border-current px-0.5 leading-tight">{sqrtMatch[1]}</span>
      </span>
    );
  }

  // Match base^{exp} or base^digit
  const supBraceMatch = token.match(/^([A-Za-z0-9πθ)]+)\^\{([^{}]+)\}$/);
  if (supBraceMatch) {
    return (
      <span key={keyPrefix} className="font-mono">
        {supBraceMatch[1]}
        <sup className="text-[0.75em] ml-0.5">{supBraceMatch[2]}</sup>
      </span>
    );
  }

  const supSimpleMatch = token.match(/^([A-Za-z0-9πθ)]+)\^([A-Za-z0-9]+)$/);
  if (supSimpleMatch) {
    return (
      <span key={keyPrefix} className="font-mono">
        {supSimpleMatch[1]}
        <sup className="text-[0.75em] ml-0.5">{supSimpleMatch[2]}</sup>
      </span>
    );
  }

  return <span key={keyPrefix}>{token}</span>;
}

export const MathText: React.FC<{ text: string; className?: string }> = ({ text, className = '' }) => {
  if (!text) return null;
  const cleaned = text.replace(/^\$\$|\$\$$/g, '').replace(/^\$|\$$/g, '');
  const parts = cleaned.split(/(\\frac\{[^{}]+\}\{[^{}]+\}|\\sqrt\{[^{}]+\}|[A-Za-z0-9πθ)]+\^\{[^{}]+\}|[A-Za-z0-9πθ)]+\^[A-Za-z0-9]+)/g);

  return (
    <span className={className}>
      {parts.filter(Boolean).map((part, i) => renderToken(part, `m-${i}`))}
    </span>
  );
};
