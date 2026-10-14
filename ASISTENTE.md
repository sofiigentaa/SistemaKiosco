# Asistente

Botón "Asistente" abajo a la derecha. Es un asistente guiado hecho por tecnoros.ar:
**sin IA ni servicios externos**. Responde con los datos que ya están en el sistema,
nada de lo que se escribe sale del navegador y no guarda la conversación.

**Cómo vas**
- ¿Cuánto vendí hoy? · ¿Cuánto hay en la caja? · ¿Qué tengo que reponer?
- ¿Qué se vence? · ¿Quién me debe? · ¿Qué es lo que más se vende?
- ¿Cuánto sale…? / ¿Cuántos quedan de…? (busca el producto por nombre)

**Cómo se hace**: vender, fiado, cargar productos, descuentos por vencimiento,
abrir y cerrar la caja, y qué hace Golondrina. Cada respuesta trae un botón que
lleva a la pantalla correspondiente.

**Soporte**: "Hablar con soporte" abre WhatsApp con tecnoros.ar. El número se
cambia con la variable `VITE_SOPORTE_WHATSAPP` (por defecto 5493413130336).

**Hablarle**: el botón del micrófono dicta la pregunta (Chrome, Edge y Safari, en
compu y celular; la primera vez el navegador pide permiso). Si la pregunta se hizo
hablando, la respuesta también se lee en voz alta. El reconocimiento de voz lo hace
el navegador (en Chrome, con el servicio de Google); el sistema no guarda el audio
ni el texto. En navegadores sin dictado el botón no aparece y se escribe como siempre.
