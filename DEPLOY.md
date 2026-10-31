# PostgreSQL en Render

El proyecto usa la base PostgreSQL que ya creaste. No crea una segunda instancia. El navegador
se conecta a la API Node; la URL de PostgreSQL nunca se envía al navegador.

## Conectar la base existente
1. En Render, abrí el servicio web `sistema-kiosco` → **Environment**.
2. Configurá `DATABASE_URL` con la **Internal Database URL** de tu base Render. No uses la URL
   externa para el servicio web; la externa es solo para conexiones desde tu computadora.
3. Configurá `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` con los datos del proyecto Supabase
   que administra las cuentas. La clave `anon` es pública; nunca agregues una `service_role` al
   frontend. `JWT_SECRET` se genera automáticamente con el Blueprint.
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

## Registro y recuperación con Supabase Auth
1. En Supabase, habilitá **Authentication → Providers → Email** y permití el registro.
2. En **Authentication → URL Configuration**, agregá la URL del sitio Render y
   `http://localhost:3000/**` y `http://localhost:3002/**` para desarrollo. El enlace de
   recuperación vuelve a `/?reset=1` en el mismo sitio.
3. Configurá SMTP y las plantillas de confirmación/recuperación en Supabase para el envío de
   emails de producción. Render no envía esos correos.
4. Si la confirmación de email está activa, el usuario debe verificar su dirección antes de
   iniciar sesión. Si está desactivada, ingresa al completar el registro.

Supabase gestiona contraseñas, confirmaciones y recuperación. El backend verifica cada sesión
con Supabase antes de permitir el acceso a PostgreSQL. Las cuentas se enlazan por email y se
conservan los datos existentes del kiosco.

`VITE_BRAND=demo` usa una marca ficticia.
