export type ProductCategory = string;

export type PaymentMethod = 'Efectivo' | 'Tarjeta de Débito' | 'Tarjeta de Crédito' | 'Transferencia / MP' | 'Cuenta Corriente (Fiado)';

export interface Product {
  id: string;
  barcode: string;
  name: string;
  category: ProductCategory;
  costPrice: number; // Precio de compra al proveedor
  salePrice: number; // Precio al público
  stock: number; // Stock actual
  minStock: number; // Punto de reorden / alerta de stock bajo
  expirationDate?: string; // Formato YYYY-MM-DD
  unit?: string; // u., kg, pack
  supplier?: string;
  notes?: string;
  liquidationApplied?: boolean; // true once a discount was applied for its upcoming expiration
  updatedAt: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
}

export interface SaleItem {
  productId: string;
  productName: string;
  category: ProductCategory;
  quantity: number;
  unitCost: number;
  unitPrice: number;
  total: number;
  profit: number;
}

export interface Sale {
  id: string;
  date: string; // ISO string
  items: SaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  totalCost: number;
  totalProfit: number;
  paymentMethod: PaymentMethod;
  cashReceived?: number;
  change?: number;
  customerName?: string;
  status: 'completada' | 'anulada';
  note?: string;
}

export interface StockMovement {
  id: string;
  date: string;
  productId: string;
  productName: string;
  type: 'venta' | 'ingreso' | 'ajuste' | 'anulacion_venta' | 'vencimiento';
  quantityChange: number; // positive or negative
  previousStock: number;
  newStock: number;
  reason?: string;
  costPrice?: number;
}

export interface CashRegisterShift {
  id: string;
  openedAt: string;
  closedAt?: string;
  initialCash: number;
  finalCashCalculated?: number;
  finalCashReal?: number;
  notes?: string;
  isOpen: boolean;
}
