# PostgreSQL en Render

El proyecto usa la base PostgreSQL que ya creaste. No crea una segunda instancia. El navegador
se conecta a la API Node; la URL de PostgreSQL nunca se envía al navegador.

## Conectar la base existente
1. En Render, abrí el servicio web `sistema-kiosco` → **Environment**.
2. Configurá `DATABASE_URL` con la **Internal Database URL** de tu base Render. No uses la URL
   externa para el servicio web; la externa es solo para conexiones desde tu computadora.
3. Configurá `ADMIN_EMAIL` y `ADMIN_PASSWORD` para la cuenta del kiosco. `JWT_SECRET` se genera
   automáticamente con el Blueprint.
4. Guardá y desplegá. Al iniciar, el backend ejecuta `server/schema.sql` y crea las tablas que
   falten. También podés aplicar el esquema manualmente con `npm run db:apply` desde `.env`.

La URL externa que se compartió antes debe rotarse antes de usarla. Para ejecutar `db:apply` desde
tu computadora, poné la nueva **External Database URL** en `DATABASE_URL` de `.env`. Render puede
requerir habilitar temporalmente tu IP en la lista de acceso de la base.

## Desarrollo local
Copiar `.env.example` a `.env`, iniciar PostgreSQL local con `docker compose up -d` y ejecutar
`npm run dev:api` y `npm run dev` en terminales separadas. Vite envía `/api` al backend en el
puerto 3001.

## Datos y sincronización
- PostgreSQL guarda los datos por cuenta y las operaciones de sincronización son transaccionales.
- Las ventas y movimientos se agregan de forma idempotente; el stock se aplica como diferencia.
- Los equipos consultan cambios cada cinco segundos y guardan cambios offline para reintentarlos.
- El login usa cookie `HttpOnly`, `SameSite=Lax` y expiración de 12 horas.
- El registro de Golondrina se almacena en la misma base PostgreSQL.

## Registro y recuperación de contraseña
El registro está habilitado y las contraseñas requieren al menos 12 caracteres. Para enviar
enlaces de recuperación, configurá `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` y `SMTP_PASSWORD`
como variables privadas en Render. `SMTP_FROM` es opcional; por defecto se usa `SMTP_USER`.
El enlace vence a los 30 minutos, solo puede utilizarse una vez y restablecer la contraseña
cierra las sesiones anteriores. Sin SMTP configurado, el registro y el ingreso funcionan, pero
la pantalla de recuperación informa que el envío de correo no está disponible.

`VITE_BRAND=demo` usa una marca ficticia.
