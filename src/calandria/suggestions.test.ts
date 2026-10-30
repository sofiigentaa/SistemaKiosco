import { describe, expect, it } from 'vitest';
import { buildSuggestions } from './suggestions';
import { Product, Sale } from '../types';

describe('buildSuggestions', () => {
  it('propone reposición cuando un producto está bajo el mínimo', () => {
    const products: Product[] = [
      {
        id: 'p1',
        barcode: '111',
        name: 'Leche',
        category: 'Lácteos',
        costPrice: 1200,
        salePrice: 1800,
        stock: 2,
        minStock: 5,
        supplier: 'Proveedor A',
        updatedAt: new Date().toISOString(),
      },
    ];

    const suggestions = buildSuggestions(products, [], [], Date.now());
    expect(suggestions.some((s) => s.kind === 'reposicion')).toBe(true);
  });

  it('propone liquidación para productos cercanos a vencer', () => {
    const productDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const products: Product[] = [
      {
        id: 'p2',
        barcode: '222',
        name: 'Queso',
        category: 'Lácteos',
        costPrice: 500,
        salePrice: 1000,
        stock: 4,
        minStock: 1,
        expirationDate: productDate,
        updatedAt: new Date().toISOString(),
      },
    ];

    const suggestions = buildSuggestions(products, [], [], Date.now());
    expect(suggestions.some((s) => s.kind === 'liquidacion')).toBe(true);
  });

  it('propone recordatorio para fiados vencidos', () => {
    const now = Date.now();
    const oldDate = new Date(now - 9 * 24 * 60 * 60 * 1000).toISOString();
    const sales: Sale[] = [
      {
        id: 'sale-1',
        date: oldDate,
        items: [],
        subtotal: 1000,
        discount: 0,
        total: 1000,
        totalCost: 700,
        totalProfit: 300,
        paymentMethod: 'Cuenta Corriente (Fiado)',
        customerName: 'Ana',
        status: 'completada',
      },
    ];

    const suggestions = buildSuggestions([], sales, [], now);
    expect(suggestions.some((s) => s.kind === 'fiados')).toBe(true);
  });
});
