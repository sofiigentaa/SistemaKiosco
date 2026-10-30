import { describe, expect, it } from 'vitest';
import { sealEntry, verifyChain } from './chain';

describe('chain', () => {
  it('verifica una cadena válida de eventos', () => {
    const first = sealEntry(undefined, {
      at: new Date('2025-01-01T10:00:00Z').toISOString(),
      kind: 'reposicion',
      action: 'aprobada',
      qty: 3,
      minutes: 4,
    });

    const second = sealEntry(first, {
      at: new Date('2025-01-01T11:00:00Z').toISOString(),
      kind: 'liquidacion',
      action: 'descartada',
      qty: 1,
      minutes: 2,
    });

    expect(verifyChain([first, second])).toMatchObject({ ok: true, count: 2 });
  });

  it('detecta manipulación en la cadena', () => {
    const first = sealEntry(undefined, {
      at: new Date('2025-01-01T10:00:00Z').toISOString(),
      kind: 'reposicion',
      action: 'aprobada',
      qty: 3,
      minutes: 4,
    });

    const second = sealEntry(first, {
      at: new Date('2025-01-01T11:00:00Z').toISOString(),
      kind: 'liquidacion',
      action: 'descartada',
      qty: 1,
      minutes: 2,
    });

    const broken = { ...second, minutes: 999 };
    expect(verifyChain([first, broken]).ok).toBe(false);
  });
});
