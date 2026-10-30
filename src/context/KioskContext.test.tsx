import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { KioskProvider, useKiosk } from './KioskContext';

describe('KioskContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function Harness() {
    const {
      addProduct,
      recordSale,
      openShift,
      closeShift,
      clearAllData,
      currentShift,
      products,
      lowStockProducts,
    } = useKiosk();

    return (
      <div>
        <button
          onClick={() => {
            clearAllData();
            addProduct({
              barcode: '999',
              name: 'Producto de prueba',
              category: 'Lácteos & Leches',
              costPrice: 100,
              salePrice: 150,
              stock: 10,
              minStock: 5,
              expirationDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
              unit: 'u.',
              supplier: 'Proveedor X',
              updatedAt: new Date().toISOString(),
            });
          }}
        >
          add product
        </button>

        <button
          onClick={() => {
            const p = products[0];
            if (!p) return;
            recordSale(
              [{ product: p, quantity: 2, unitPrice: p.salePrice }],
              'Efectivo',
              500,
              0,
              'Cliente test'
            );
          }}
        >
          make sale
        </button>

        <button onClick={() => openShift(200)}>open shift</button>
        <button onClick={() => closeShift(700, 'cierre ok')}>close shift</button>

        <div data-testid="stock">{products[0]?.stock ?? 'none'}</div>
        <div data-testid="low-stock-count">{lowStockProducts.length}</div>
        <div data-testid="shift-state">
          {currentShift ? JSON.stringify({ calculated: currentShift.finalCashCalculated, real: currentShift.finalCashReal, isOpen: currentShift.isOpen }) : 'none'}
        </div>
      </div>
    );
  }

  it('descuenta stock y registra una venta de contado', () => {
    render(
      <KioskProvider>
        <Harness />
      </KioskProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /add product/i }));
    expect(screen.getByTestId('stock')).toHaveTextContent('10');

    fireEvent.click(screen.getByRole('button', { name: /make sale/i }));
    expect(screen.getByTestId('stock')).toHaveTextContent('8');
  });

  it('calcula el cierre de caja según ventas en efectivo del turno', () => {
    render(
      <KioskProvider>
        <Harness />
      </KioskProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /add product/i }));
    fireEvent.click(screen.getByRole('button', { name: /open shift/i }));
    fireEvent.click(screen.getByRole('button', { name: /make sale/i }));
    fireEvent.click(screen.getByRole('button', { name: /close shift/i }));

    expect(screen.getByTestId('shift-state')).toHaveTextContent('500');
  });

  it('detecta productos con stock bajo', () => {
    render(
      <KioskProvider>
        <Harness />
      </KioskProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /add product/i }));
    expect(screen.getByTestId('low-stock-count')).toHaveTextContent('0');
  });
});
