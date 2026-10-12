import React from 'react';
import { useKiosk } from '../context/KioskContext';
import { useCalandria } from '../calandria/CalandriaContext';
import { formatCurrency, getDaysUntil } from '../utils/formatters';
import { AsistenteChat, normalizar, Tema } from './AsistenteChat';
import { BRAND } from '../config/brand';

// Soporte de tecnoros.ar (se puede cambiar con VITE_SOPORTE_WHATSAPP).
const SOPORTE = (import.meta.env.VITE_SOPORTE_WHATSAPP || '5493413130336').replace(/\D/g, '');
const DAY = 86400000;
const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
// "2 sin stock y 3 en el mínimo" sin decir "0 de algo".
const unir = (partes: Array<[number, string]>) => {
  const p = partes.filter(([n]) => n > 0).map(([n, t]) => `${n} ${t}`);
  return p.length > 1 ? `${p.slice(0, -1).join(', ')} y ${p[p.length - 1]}` : p[0] || '';
};

export const AsistenteKiosco: React.FC<{ onOpenCash: () => void; antesDeAccion?: () => void; posicion?: string }> = ({ onOpenCash, antesDeAccion, posicion }) => {
  const k = useKiosk();
  const cal = useCalandria();
  const ir = (tab: Parameters<typeof k.setActiveTab>[0]) => () => k.setActiveTab(tab);

  const fiadosPendientes = () =>
    k.sales.filter((s) => s.status === 'completada' && s.paymentMethod === 'Cuenta Corriente (Fiado)' && !s.fiadoPaidAt);

  // Busca productos nombrados en la pregunta ("¿cuánto sale la coca?").
  const productosEn = (q: string) => {
    const palabras = q.split(' ').filter((w) => w.length >= 4 && !['cuanto', 'cuesta', 'precio', 'queda', 'quedan', 'tengo', 'sale', 'stock', 'hay'].includes(w));
    if (palabras.length === 0) return [];
    return k.products.filter((p) => {
      const n = normalizar(p.name);
      return palabras.some((w) => n.includes(w));
    });
  };

  const temas: Tema[] = [
    {
      id: 'precio',
      palabras: ['precio', 'cuesta', 'cuanto sale', 'cuanto vale', 'cuanto queda', 'cuantos quedan', 'cuantas quedan', 'hay de', 'tengo de'],
      responder: (q) => {
        const encontrados = productosEn(q).slice(0, 6);
        if (encontrados.length === 0) return null;
        return {
          texto: encontrados.length === 1 ? 'Esto es lo que tengo cargado:' : 'Encontré estos productos:',
          lineas: encontrados.map((p) => `${p.name}: ${formatCurrency(p.salePrice)} · stock ${p.stock}`),
          accion: { etiqueta: 'Ver en inventario', hacer: ir('inventory') },
        };
      },
    },
    {
      id: 'ventas',
      chip: '¿Cuánto vendí hoy?',
      palabras: ['vend', 'venta', 'recaud', 'factur', 'gane', 'ganancia', 'hoy'],
      responder: () => ({
        texto:
          k.todaySalesCount === 0
            ? 'Hoy todavía no hay ventas registradas.'
            : `Hoy llevás ${k.todaySalesCount} ${k.todaySalesCount === 1 ? 'venta' : 'ventas'} por ${formatCurrency(k.todaySalesTotal)}, con ${formatCurrency(k.todayProfitTotal)} de ganancia.`,
        accion: { etiqueta: 'Ver historial de ventas', hacer: ir('sales') },
      }),
    },
    {
      id: 'caja',
      chip: '¿Cuánto hay en la caja?',
      palabras: ['caja', 'cajon', 'efectivo', 'arqueo', 'turno', 'plata'],
      responder: () => {
        const sh = k.currentShift;
        if (!sh || !sh.isOpen) {
          return { texto: 'La caja está cerrada. Para empezar el día, abrila desde "Arqueo de Caja" con el fondo inicial.', accion: { etiqueta: 'Abrir arqueo de caja', hacer: onOpenCash } };
        }
        const desde = new Date(sh.openedAt).getTime();
        const enTurno = k.sales.filter((s) => s.status === 'completada' && new Date(s.date).getTime() >= desde);
        const efectivo = enTurno.filter((s) => s.paymentMethod === 'Efectivo').reduce((a, s) => a + s.total, 0);
        const fiadosCobrados = k.sales
          .filter((s) => s.fiadoPaidMethod === 'Efectivo' && s.fiadoPaidAt && new Date(s.fiadoPaidAt).getTime() >= desde)
          .reduce((a, s) => a + s.total, 0);
        return {
          texto: `La caja está abierta desde las ${hora(sh.openedAt)}. En el cajón tendría que haber ${formatCurrency(sh.initialCash + efectivo + fiadosCobrados)}.`,
          lineas: [
            `Fondo inicial: ${formatCurrency(sh.initialCash)}`,
            `Ventas en efectivo: ${formatCurrency(efectivo)}`,
            ...(fiadosCobrados ? [`Fiados cobrados en efectivo: ${formatCurrency(fiadosCobrados)}`] : []),
          ],
          accion: { etiqueta: 'Abrir arqueo de caja', hacer: onOpenCash },
        };
      },
    },
    {
      id: 'reponer',
      chip: '¿Qué tengo que reponer?',
      palabras: ['repon', 'falta', 'faltan', 'sin stock', 'agot', 'pedido', 'proveedor', 'comprar', 'stock'],
      responder: () => {
        const sin = k.outOfStockProducts;
        const poco = k.lowStockProducts;
        if (sin.length + poco.length === 0) return { texto: 'Está todo bien de stock: ningún producto está en el mínimo.' };
        return {
          texto: `Hay ${unir([[sin.length, 'sin stock'], [poco.length, 'en el mínimo']])}. Calandria te arma el pedido por proveedor.`,
          lineas: [...sin.map((p) => `${p.name}: sin stock`), ...poco.map((p) => `${p.name}: quedan ${p.stock} (mínimo ${p.minStock})`)].slice(0, 8),
          accion: { etiqueta: 'Ver alertas', hacer: ir('alerts') },
        };
      },
    },
    {
      id: 'vence',
      chip: '¿Qué se vence?',
      palabras: ['venc', 'caduc', 'por vencer'],
      responder: () => {
        const lista = [...k.expiredProducts, ...k.expiringProducts];
        if (lista.length === 0) return { texto: 'No hay nada vencido ni por vencer en los próximos 7 días.' };
        return {
          texto: `Hay ${unir([[k.expiredProducts.length, k.expiredProducts.length === 1 ? 'vencido' : 'vencidos'], [k.expiringProducts.length, k.expiringProducts.length === 1 ? 'que vence en 7 días o menos' : 'que vencen en 7 días o menos']])}.`,
          lineas: lista.slice(0, 8).map((p) => {
            const d = getDaysUntil(p.expirationDate) ?? 0;
            return `${p.name}: ${d < 0 ? 'vencido' : d === 0 ? 'vence hoy' : `vence en ${d} ${d === 1 ? 'día' : 'días'}`}`;
          }),
          accion: { etiqueta: 'Ver alertas', hacer: ir('alerts') },
        };
      },
    },
    {
      id: 'fiados',
      chip: '¿Quién me debe?',
      palabras: ['fiad', 'debe', 'deben', 'deuda', 'cuenta corriente', 'cobrar'],
      responder: (q) => {
        if (q.includes('como')) return null; // "¿cómo vendo fiado?" lo responde otro tema
        const lista = fiadosPendientes();
        if (lista.length === 0) return { texto: 'Nadie te debe: no hay fiados sin cobrar.' };
        const porCliente = new Map<string, number>();
        lista.forEach((s) => porCliente.set(s.customerName || 'Sin nombre', (porCliente.get(s.customerName || 'Sin nombre') || 0) + s.total));
        const total = lista.reduce((a, s) => a + s.total, 0);
        return {
          texto: `Te deben ${formatCurrency(total)} entre ${porCliente.size} ${porCliente.size === 1 ? 'cliente' : 'clientes'}.`,
          lineas: [...porCliente.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n, t]) => `${n}: ${formatCurrency(t)}`),
          accion: { etiqueta: 'Ver fiados', hacer: ir('sales') },
        };
      },
    },
    {
      id: 'top',
      chip: '¿Qué es lo que más se vende?',
      palabras: ['mas vend', 'mas se vend', 'vende mas', 'mas sale', 'top', 'ranking', 'popular'],
      responder: () => {
        const desde = Date.now() - 7 * DAY;
        const cant = new Map<string, number>();
        k.sales
          .filter((s) => s.status === 'completada' && new Date(s.date).getTime() >= desde)
          .forEach((s) => s.items.forEach((i) => cant.set(i.productName, (cant.get(i.productName) || 0) + i.quantity)));
        if (cant.size === 0) return { texto: 'En los últimos 7 días no hay ventas para comparar.' };
        return {
          texto: 'Lo más vendido de los últimos 7 días:',
          lineas: [...cant.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n, q]) => `${n}: ${q} u.`),
          accion: { etiqueta: 'Ver reportes', hacer: ir('reports') },
        };
      },
    },
    {
      id: 'como_vender',
      palabras: ['vend', 'cobr', 'escane', 'codigo', 'venta'],
      requiere: ['como', 'donde'],
      responder: () => ({
        texto: 'Para vender:',
        lineas: [
          'En "Venta (POS)" tocá el producto o escaneá el código (también con la cámara del celular).',
          'Tocá "Cobrar (F4)", elegí cómo paga y cuánto te da: el vuelto sale solo.',
          'Tocá "Registrar venta". El stock se descuenta solo.',
        ],
        accion: { etiqueta: 'Ir a vender', hacer: ir('pos') },
      }),
    },
    {
      id: 'como_fiado',
      palabras: ['fiad', 'fiado', 'cuenta corriente', 'anotar'],
      requiere: ['como', 'donde'],
      responder: () => ({
        texto: 'Para vender fiado:',
        lineas: [
          'Cargá la venta como siempre y tocá "Cobrar".',
          'Elegí "Fiado / Cta." y escribí el nombre del cliente.',
          'Cuando te paga: "Historial Ventas" → filtro "Fiados sin cobrar" → "Cobrar en…".',
        ],
        accion: { etiqueta: 'Ver fiados', hacer: ir('sales') },
      }),
    },
    {
      id: 'como_producto',
      palabras: ['producto', 'cargar', 'agregar', 'alta', 'mercaderia', 'ingreso'],
      requiere: ['como', 'donde'],
      responder: () => ({
        texto: 'Para cargar productos:',
        lineas: [
          'Andá a "Inventario" y tocá "Nuevo producto": nombre, código, costo, precio y stock.',
          'Si llegó mercadería de algo que ya tenés, usá "Reponer" en ese producto.',
          'Para subir precios de toda una categoría, usá "Ajuste de precios".',
        ],
        accion: { etiqueta: 'Ir a inventario', hacer: ir('inventory') },
      }),
    },
    {
      id: 'como_descuento',
      palabras: ['descuento', 'liquid', 'rebaj', 'bajar precio', 'oferta'],
      requiere: ['como', 'donde'],
      responder: () => ({
        texto: 'Para liquidar lo que vence:',
        lineas: [
          'En "Alertas" están los productos por vencer, con un botón para aplicar descuento.',
          'Calandria también te lo propone sola: 20 % menos, nunca por debajo del costo.',
        ],
        accion: { etiqueta: 'Ver alertas', hacer: ir('alerts') },
      }),
    },
    {
      id: 'como_caja',
      palabras: ['caja', 'turno', 'arqueo', 'cierre', 'cerrar', 'abrir'],
      requiere: ['como', 'donde'],
      responder: () => ({
        texto: 'Para la caja:',
        lineas: [
          'Al empezar el día: "Arqueo de Caja" → abrir turno con el fondo inicial.',
          'Al cerrar: contá el efectivo del cajón y cargalo. El sistema te dice si sobra o falta.',
        ],
        accion: { etiqueta: 'Abrir arqueo de caja', hacer: onOpenCash },
      }),
    },
    {
      id: 'calandria',
      chip: '¿Qué hace Calandria?',
      palabras: ['calandria', 'boton', 'automat', 'luz'],
      responder: () => ({
        texto: `Calandria mira el stock, los vencimientos y los fiados y te propone las tareas de siempre. Vos aprobás con un botón (o F9).${
          cal.suggestions.length ? `\nAhora tiene ${cal.suggestions.length} ${cal.suggestions.length === 1 ? 'tarea lista' : 'tareas listas'}.` : '\nAhora no tiene nada pendiente.'
        }`,
        accion: { etiqueta: 'Abrir Calandria', hacer: () => cal.setPanelOpen(true), enLugar: true },
      }),
    },
    {
      id: 'saludo',
      palabras: ['hola', 'buen dia', 'buenas', 'gracias', 'que podes hacer', 'ayudame'],
      responder: (q) => ({
        texto: q.includes('gracias')
          ? '¡De nada! Cualquier cosa, acá estoy.'
          : 'Puedo decirte cómo vas y explicarte cómo se hace algo. Probá con "¿Cuánto vendí hoy?", "¿Qué tengo que reponer?" o "¿Cómo vendo fiado?", o tocá uno de los botones de abajo.',
      }),
    },
    {
      id: 'soporte',
      chip: 'Hablar con una persona',
      palabras: ['soporte', 'persona', 'humano', 'ayuda', 'problema', 'error', 'no anda', 'no funciona', 'falla'],
      responder: () => ({
        texto: 'Te atiende el equipo de tecnoros.ar por WhatsApp. Contanos qué pasó y en qué pantalla.',
        accion: {
          enLugar: true,
          etiqueta: 'Escribir a soporte',
          hacer: () => window.open(`https://wa.me/${SOPORTE}?text=${encodeURIComponent(`Hola tecnoros.ar, necesito ayuda con el sistema de ${BRAND.first} ${BRAND.second}.`)}`, '_blank', 'noopener'),
        },
      }),
    },
  ];

  return (
    <AsistenteChat
      temas={temas}
      saludo="¡Hola! Soy el asistente de Calandria. Preguntame cómo vas hoy o cómo se hace algo en el sistema."
      soporteWhatsapp={SOPORTE}
      soporteMensaje={`Hola tecnoros.ar, necesito ayuda con el sistema de ${BRAND.first} ${BRAND.second}.`}
      colorBoton="bg-slate-900 hover:bg-slate-800 text-white ring-2 ring-cyan-400/60"
      posicion={posicion || "bottom-20 right-4 lg:bottom-14 lg:right-6"}
      antesDeAccion={antesDeAccion}
    />
  );
};
