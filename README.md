Gestión integral de kiosco/almacén: punto de venta, control de inventario y vencimientos con liquidación automática, arqueo de caja, historial de ventas y reportes de márgenes. Sincronización en tiempo real entre dispositivos con Supabase. Hecho con React, TypeScript, Vite y Tailwind — desarrollado inicialmente con Google AI Studio y refinado con Claude (Anthropic).

# Sistema de Gestión — Granja y Kiosco Don Ramón

**Documento funcional**

Este documento describe, de forma simple y en lenguaje claro, qué hace el sistema y para qué sirve cada una de sus funciones. Está pensado para que cualquier persona que use el sistema en el día a día — sin conocimientos técnicos — entienda cómo puede ayudarla en el kiosco.

## 1. ¿Qué es el sistema?

Es un sistema de gestión pensado para un kiosco o almacén. Permite vender de forma rápida, controlar el stock de mercadería, saber cuándo un producto está por vencerse, cerrar la caja al final del día y ver reportes de cómo va el negocio.

El sistema funciona desde el navegador (no hay que instalar nada) y puede usarse desde una computadora, tablet o celular. Si se usa en más de un dispositivo al mismo tiempo (por ejemplo, la caja y una tablet en el depósito), la información se actualiza automáticamente en todos: si se vende un producto en uno, el stock se descuenta en todos los demás al instante.

## 2. Funciones principales

### 2.1 Punto de venta (POS) — Vender rápido

Es la pantalla que se usa para cobrarle a un cliente en el mostrador. Está pensada para ser rápida, ya que es la que más se usa en el día a día.

- Buscar o seleccionar los productos que el cliente lleva.
- El sistema calcula el total a cobrar de manera automática.
- Registrar el pago y cerrar la venta.
- Cada venta descuenta el stock de forma automática, sin tener que actualizarlo a mano.

### 2.2 Inventario — Control de stock

Es donde se lleva el control de toda la mercadería del kiosco: qué productos hay, cuántas unidades quedan y a qué precio se venden.

- Cargar productos nuevos, con su precio y cantidad disponible.
- Modificar precios o cantidades cuando entra mercadería nueva.
- Consultar en cualquier momento cuánto stock queda de cada producto.

### 2.3 Alertas de stock bajo

El sistema avisa automáticamente cuando un producto se está por acabar, para que no falte mercadería en la góndola.

- Muestra un aviso cuando la cantidad disponible de un producto baja de cierto nivel.
- Ayuda a planificar la reposición antes de quedarse sin stock.

### 2.4 Vencimientos y liquidación automática

Pensado especialmente para productos de granja o almacén con fecha de vencimiento.

- Permite registrar la fecha de vencimiento de los productos.
- El sistema identifica los productos próximos a vencer.
- Aplica una liquidación (rebaja de precio) de forma automática para esos productos, ayudando a venderlos antes de que se pierdan.

### 2.5 Arqueo de caja

Es el cierre de caja: sirve para verificar, al final del turno o del día, que el dinero contado coincide con lo que el sistema registró en ventas.

- Registrar cuánto dinero hay físicamente en la caja.
- Compararlo con el total de ventas registradas por el sistema.
- Detectar fácilmente si sobra o falta dinero al cierre.

### 2.6 Historial de ventas

Guarda un registro de todas las ventas realizadas, para poder consultarlas cuando se necesite.

- Ver ventas anteriores por día, semana o el período que se necesite.
- Consultar el detalle de una venta puntual (productos, hora, total).

### 2.7 Reportes de márgenes

Muestra información sobre cómo está funcionando el negocio, comparando lo que cuesta la mercadería con lo que se vende.

- Ver la ganancia (margen) obtenida por producto o en general.
- Ayuda a identificar qué productos son más rentables para el kiosco.

## 3. ¿Para quién es cada función?

**Para quien atiende el mostrador**

- Punto de venta (POS): es la pantalla de uso diario para cobrar.
- Alertas de stock bajo: avisan qué reponer.

**Para quien administra el kiosco**

- Inventario: carga y actualización de productos y precios.
- Vencimientos: control de productos próximos a vencer.
- Arqueo de caja: cierre y control diario del dinero.
- Historial de ventas y Reportes de márgenes: seguimiento del negocio.

## 4. Cómo se accede al sistema

El sistema se usa desde el navegador web, ingresando a la dirección del sitio. No requiere instalación. Se recomienda contar con conexión a internet estable, ya que la información se sincroniza en tiempo real entre los dispositivos que estén usando el sistema.

## 5. Beneficios para el usuario

- Cobrar más rápido en el mostrador.
- Evitar quedarse sin stock de productos importantes.
- Reducir la pérdida de mercadería por vencimiento.
- Tener un cierre de caja más simple y confiable.
- Saber en todo momento cómo está funcionando el negocio.
