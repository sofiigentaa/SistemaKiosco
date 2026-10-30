import { describe, expect, it } from 'vitest';
import { formatCurrency, formatPercent, getDaysUntil } from './formatters';

describe('formatters', () => {
  it('formatea moneda en pesos argentinos', () => {
    expect(formatCurrency(1234).replace(/\s/g, '')).toBe('$1.234');
  });

  it('agrega el signo más para porcentajes positivos', () => {
    expect(formatPercent(12.5)).toBe('+12.5%');
  });

  it('calcula días restantes hasta una fecha', () => {
    const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const days = getDaysUntil(future.toISOString());
    expect(days).toBeGreaterThanOrEqual(2);
    expect(days).toBeLessThanOrEqual(2);
  });
});
