import { Product, Sale, StockMovement } from '../types';
import { getDaysUntil } from '../utils/formatters';
import { CalandriaKind } from './chain';

// Cotorra mira lo que ya está cargado en el sistema y propone las tareas que
// el kiosco repite siempre. No hace nada sola: cada propuesta espera el botón.
//
// Los minutos ahorrados son una estimación de cuánto lleva hacerlo a mano
// (se muestran como "estimado" en pantalla y en el registro).

export interface Suggestion {
  key: string; // cambia si cambia el contenido: lo descartado no tapa algo nuevo
  kind: Exclude<CalandriaKind, 'sistema'>;
  title: string;
  detail: string;
  lines: string[]; // vista previa de lo que va a hacer
  qty: number;
  minutes: number;
  // Datos para ejecutar la acción (se usan solo en memoria, no se guardan)
  payload:
    | { type: 'reposicion'; bySupplier: Array<{ supplier: string; items: Array<{ name: string; qty: number; unit?: string }> }> }
    | { type: 'ingreso_habitual'; productId: string; quantity: number }
    | { type: 'liquidacion'; updates: Array<{ id: string; newPrice: number }> }
    | { type: 'fiados'; items: Array<{ saleId: string; customer: string; total: number; days: number }> };
}

const DAY = 24 * 60 * 60 * 1000;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// Cuánto pedir: llegar al doble del mínimo (como mínimo, 1 caja chica).
function orderQty(p: Product): number {
  return Math.max(p.minStock * 2 - Math.max(p.stock, 0), 1);
}

function reposicion(products: Product[]): Suggestion | null {
  const low = products.filter((p) => p.stock <= p.minStock && p.minStock > 0);
  if (low.length === 0) return null;
  const groups = new Map<string, Product[]>();
  for (const p of low) {
    const s = p.supplier?.trim() || 'Sin proveedor';
    groups.set(s, [...(groups.get(s) || []), p]);
  }
  const bySupplier = [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([supplier, items]) => ({
      supplier,
      items: items.map((p) => ({ name: p.name, qty: orderQty(p), unit: p.unit })),
    }));
  return {
    key: `reposicion:${low.map((p) => `${p.id}=${p.stock}`).sort().join(',')}`,
    kind: 'reposicion',
    title: 'Armar el pedido a proveedores',
    detail: `${plural(low.length, 'producto está', 'productos están')} en el mínimo o sin stock. Te dejo el pedido armado por proveedor, listo para mandar.`,
    lines: bySupplier.map((g) => `${g.supplier}: ${g.items.map((i) => `${i.qty} × ${i.name}`).join(', ')}`),
    qty: low.length,
    minutes: Math.min(3 * bySupplier.length + low.length, 30),
    payload: { type: 'reposicion', bySupplier },
  };
}

// "Aprende" de los ingresos: si un producto entró 3 veces o más con la misma
// cantidad cada tantos días, cuando toca de nuevo propone cargarlo igual.
function ingresosHabituales(products: Product[], movements: StockMovement[], now: number): Suggestion[] {
  const byProduct = new Map<string, StockMovement[]>();
  for (const m of movements) {
    if (m.type !== 'ingreso' || m.quantityChange <= 0 || m.reason === 'Carga inicial de producto') continue;
    byProduct.set(m.productId, [...(byProduct.get(m.productId) || []), m]);
  }
  const out: Suggestion[] = [];
  for (const [productId, list] of byProduct) {
    const product = products.find((p) => p.id === productId);
    // Con 2 ingresos iguales ya alcanza para proponer (lo más rápido posible);
    // con 3 o más, además se pide que sean regulares.
    if (!product || list.length < 2) continue;
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const recent = sorted.slice(-3);
    const last = recent[recent.length - 1];
    const quantity = last.quantityChange;
    if (!recent.every((m) => m.quantityChange === quantity)) continue;
    const gaps = recent.slice(1).map((m, i) => new Date(m.date).getTime() - new Date(recent[i].date).getTime());
    const every = gaps.reduce((a, g) => a + g, 0) / gaps.length;
    if (every < DAY / 2) continue;
    if (gaps.length === 2 && Math.abs(gaps[0] - gaps[1]) > every * 0.35) continue; // no es regular
    const since = now - new Date(last.date).getTime();
    if (since < every * 0.85) continue; // todavía no toca
    const days = Math.round(every / DAY);
    out.push({
      key: `ingreso_habitual:${productId}:${last.id}`,
      kind: 'ingreso_habitual',
      title: `Cargar el ingreso habitual de ${product.name}`,
      detail: `Lo vi ${list.length} veces: cada ${plural(days, 'día', 'días')} entran ${quantity} ${(product.unit || 'u.').replace(/\.$/, '')}. Si ya llegó, lo cargo al stock con un toque.`,
      lines: [`${product.name}: ${product.stock} → ${product.stock + quantity} en stock`],
      qty: quantity,
      minutes: 2,
      payload: { type: 'ingreso_habitual', productId, quantity },
    });
  }
  return out;
}

function liquidacion(products: Product[]): Suggestion | null {
  const soon = products.filter((p) => {
    if (!p.expirationDate || p.liquidationApplied || p.stock <= 0) return false;
    const d = getDaysUntil(p.expirationDate);
    return d !== null && d >= 0 && d <= 3;
  });
  if (soon.length === 0) return null;
  const updates = soon.map((p) => ({
    id: p.id,
    name: p.name,
    old: p.salePrice,
    newPrice: Math.max(Math.round((p.salePrice * 0.8) / 10) * 10, p.costPrice),
  }));
  return {
    key: `liquidacion:${soon.map((p) => p.id).sort().join(',')}`,
    kind: 'liquidacion',
    title: 'Bajar el precio de lo que vence',
    detail: `${plural(soon.length, 'producto vence', 'productos vencen')} en 3 días o menos. Propongo 20% menos (nunca por debajo del costo) para que no se pierda.`,
    lines: updates.map((u) => `${u.name}: $${u.old.toLocaleString('es-AR')} → $${u.newPrice.toLocaleString('es-AR')}`),
    qty: soon.length,
    minutes: 2 * soon.length,
    payload: { type: 'liquidacion', updates: updates.map(({ id, newPrice }) => ({ id, newPrice })) },
  };
}

function fiados(sales: Sale[], now: number): Suggestion | null {
  const pending = sales.filter(
    (s) => s.status === 'completada' && s.paymentMethod === 'Cuenta Corriente (Fiado)' && !s.fiadoPaidAt && now - new Date(s.date).getTime() >= 7 * DAY
  );
  if (pending.length === 0) return null;
  const items = pending
    .map((s) => ({ saleId: s.id, customer: s.customerName || 'Cliente', total: s.total, days: Math.floor((now - new Date(s.date).getTime()) / DAY) }))
    .sort((a, b) => b.days - a.days);
  const people = new Set(items.map((i) => i.customer)).size;
  return {
    key: `fiados:${items.map((i) => i.saleId).sort().join(',')}`,
    kind: 'fiados',
    title: 'Preparar los recordatorios de fiado',
    detail: `Hay ${plural(people, 'cliente', 'clientes')} con fiados de hace más de una semana. Te dejo un mensaje amable para cada uno; vos elegís si lo mandás.`,
    lines: items.map((i) => `${i.customer}: $${i.total.toLocaleString('es-AR')} (hace ${i.days} días)`),
    qty: people,
    minutes: 2 * people,
    payload: { type: 'fiados', items },
  };
}

export function buildSuggestions(products: Product[], sales: Sale[], movements: StockMovement[], now = Date.now()): Suggestion[] {
  return [
    ...ingresosHabituales(products, movements, now),
    liquidacion(products),
    reposicion(products),
    fiados(sales, now),
  ].filter((s): s is Suggestion => s !== null);
}
