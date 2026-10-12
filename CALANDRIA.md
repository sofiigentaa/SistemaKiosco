# Calandria en el Kiosco

Calandria mira lo que ya está cargado en el sistema y **propone** las tareas que el
kiosco repite siempre. No hace nada sola: cada propuesta espera que la apruebes.

## Qué propone

| Propuesta | Cuándo aparece | Qué hace al aprobar | Tiempo estimado |
|---|---|---|---|
| Ingreso habitual | Un producto entró 3 veces o más con la misma cantidad y cada los mismos días, y ya toca de nuevo | Suma esa cantidad al stock | 2 min |
| Precio de lo que vence | Productos con stock que vencen en 3 días o menos | Baja 20 % (nunca por debajo del costo) | 2 min por producto |
| Pedido a proveedores | Productos en el mínimo o sin stock | Arma el pedido por proveedor para copiar o mandar por WhatsApp | 3 min por proveedor + 1 por producto |
| Recordatorios de fiado | Fiados sin cobrar de hace más de 7 días | Arma un mensaje para cada cliente; la persona elige si lo manda | 2 min por cliente |

"Ahora no" la esconde 12 horas (si cambia algo, vuelve a aparecer).
**Pará** pone a Calandria en pausa hasta tocar **Reanudar**.

## El botón

- En pantalla: botón grande **Aprobar** del panel de Calandria.
- Teclado: **F9**.
- Botón físico: un ESP32-S3 conectado por USB como teclado que manda **F9**.
  Si el panel está cerrado, el botón primero lo abre (nunca aprueba sin que se vea qué).
- Luz: verde = todo en orden · ámbar = hay algo para aprobar · gris = en pausa.

## Registro sellado

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

## Pantalla principal: la C

Al entrar se ve solo la C de Calandria:
- **La C** se toca para aprobar la primera notificación (igual que el botón físico o F9).
  La luz alrededor: ámbar = hay algo para aprobar, verde = todo en orden, gris = en pausa.
- **Notificaciones**: cada tarea que propone Calandria, con ✓ (aprobar) y ✕ (ahora no).
- **Compartir** (WhatsApp o lo que ofrezca el celular) e **Imprimir**: el resumen del
  día, lo que Calandria hizo hoy y lo último que preparó (pedido o mensajes).
- Abajo: **tecnoros.ar**.
- **Abrir sistema** (arriba a la derecha) lleva al sistema completo. Desde ahí, tocando
  el logo de Calandria se vuelve a la C. Cada equipo recuerda en qué pantalla quedó.
- "X min ahorrados este mes" abre el panel con la pausa y el registro sellado.
