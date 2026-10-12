# Cómo publicar el Sistema Kiosco en Render con Supabase

## 1. Supabase
1. Usar el proyecto que ya existe o crear uno en https://supabase.com (región São Paulo).
2. **SQL Editor → New query**: pegar `supabase/schema.sql` → **Run**. Crea las tablas nuevas,
   las políticas RLS, la función que suma el stock y activa el tiempo real.
   Además **cierra la tabla vieja `kiosk_state`**, cuya clave quedó publicada en GitHub.
3. **Authentication → Providers → Email**: desactivar "Allow new users to sign up".
4. **Authentication → Users → Add user**: crear la cuenta del kiosco (email + contraseña).
   Todos los equipos del negocio (caja, tablet, celular) entran con esa misma cuenta.
5. Si había datos en la versión anterior: en `supabase/schema.sql` está comentado el bloque
   para pasarlos a la cuenta (reemplazar el email y correrlo una vez).
6. **Project Settings → API**: copiar *Project URL* y la clave *anon public*.

## 2. Render
1. **New → Blueprint** → este repositorio (sitio estático, gratis).
2. Cargar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` → **Apply**.

## Cómo sincroniza
- Cada venta, producto y movimiento es una fila propia: dos equipos vendiendo a la vez no se pisan.
- El stock se descuenta en la base sumando las diferencias (vendo 2 acá y 3 allá = −5).
- Sin internet se sigue vendiendo; al volver la conexión se sube lo pendiente.

## Demo local
`npm run dev` sin variables: modo local con datos de ejemplo. `VITE_BRAND=demo` usa una marca ficticia.

## Calandria

Si el kiosco ya estaba andando, volver a correr `supabase/schema.sql` (se puede
correr de nuevo sin problema): agrega la tabla del registro sellado de Calandria.
Cómo funciona: ver `CALANDRIA.md`.
