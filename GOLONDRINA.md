# Golondrina en el Kiosco

Golondrina mira lo que ya está cargado en el sistema y **propone** las tareas que el
kiosco repite siempre. No hace nada sola: cada propuesta espera que la apruebes.

## Qué propone

| Propuesta | Cuándo aparece | Qué hace al aprobar | Tiempo estimado |
|---|---|---|---|
| Ingreso habitual | Un producto entró 3 veces o más con la misma cantidad y cada los mismos días, y ya toca de nuevo | Suma esa cantidad al stock | 2 min |
| Precio de lo que vence | Productos con stock que vencen en 3 días o menos | Baja 20 % (nunca por debajo del costo) | 2 min por producto |
| Pedido a proveedores | Productos en el mínimo o sin stock | Arma el pedido por proveedor para copiar o mandar por WhatsApp | 3 min por proveedor + 1 por producto |
| Recordatorios de fiado | Fiados sin cobrar de hace más de 7 días | Arma un mensaje para cada cliente; la persona elige si lo manda | 2 min por cliente |

"Ahora no" la esconde 12 horas (si cambia algo, vuelve a aparecer).
**Pará** pone a Golondrina en pausa hasta tocar **Reanudar**.

## El botón

- En pantalla: botón grande **Aprobar** del panel de Golondrina.
- Teclado: **F9**.
- Botón físico: un ESP32-S3 conectado por USB como teclado que manda **F9**.
  Si el panel está cerrado, el botón primero lo abre (nunca aprueba sin que se vea qué).
- Luz: verde = todo en orden · ámbar = hay algo para aprobar · gris = en pausa.

## Historial (registro protegido)

Cada aprobación, "ahora no", pausa y reanudación queda en el registro con número,
fecha, tipo de tarea, cantidad y minutos estimados. **No guarda nombres, teléfonos
ni montos de clientes.** Los mensajes de fiado se arman en memoria y se borran al
cerrarlos.

Cada línea lleva la huella SHA-256 de la anterior, y así quedan encadenadas:
`sha256(numero|fecha|tipo|accion|cantidad|minutos|huella_anterior)`.
Si alguien cambia o borra una línea del medio, la verificación lo marca.

- En la nube (Supabase), la base pone el número, la fecha y la huella, y **no deja
  modificar ni borrar** líneas (tabla `kiosk_calandria_log` en `supabase/schema.sql`).
- Sin internet, la acción queda "pendiente de sellar" en el equipo y se sube sola.
- El registro se ve en pantalla (con la verificación). Para una auditoría,
  tecnoros.ar lo saca directo de la base de datos; el cliente no tiene que hacer nada.

## Pantalla principal: la G

Al entrar se ve solo la G de Golondrina:
- **La G** se toca para aprobar la primera notificación (igual que el botón físico o F9).
  La luz alrededor: ámbar = hay algo para aprobar, verde = todo en orden, gris = en pausa.
- **Notificaciones**: cada tarea que propone Golondrina, con ✓ (aprobar) y ✕ (ahora no).
- **Compartir** (WhatsApp o lo que ofrezca el celular) e **Imprimir**: el resumen del
  día, lo que Golondrina hizo hoy y lo último que preparó (pedido o mensajes).
- Abajo: **una solución de tecnoros.ar**.
- **Abrir sistema** (arriba a la derecha) lleva al sistema completo. Desde ahí, tocando
  el logo de Golondrina se vuelve a la G. Cada equipo recuerda en qué pantalla quedó.
- "X min ahorrados este mes" abre el panel con la pausa y el historial.
- **Hoy**: el informe del día en pantalla (lo mismo que se imprime). Cada parte tiene
  "Ver" y lleva al detalle: por ejemplo, los eventos con saldo, los recordatorios de hoy,
  lo que hay que reponer, los fiados o el registro de lo que hizo Golondrina hoy.
- La G dice "Todo en orden" solo si no hay nada para aprobar **ni** nada para revisar;
  si quedan pendientes dice "Nada para aprobar · N cosas para revisar" (luz celeste).

## Asistente en la G, aprendizaje rápido y app

- El asistente también está en la pantalla de la G. Si una respuesta lleva a una
  pantalla del sistema (vender, cargar un evento, la caja…), abre el sistema ahí.
- Aprende rápido: con **2 veces** que se repita algo (mismo ingreso de mercadería,
  mismo gasto del mes) ya lo propone. Las tareas por reglas (vencimientos, stock
  mínimo, saldos, fiados) funcionan desde el primer día, con los datos que ya hay.
- Se instala como **aplicación** en el celular o la compu ("Agregar a la pantalla de
  inicio" / "Instalar"), con el nombre y el ícono de Golondrina.
