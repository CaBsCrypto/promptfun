# Acceso demo para pruebas internas

La demo local prueba el editor y el guardado real de proyectos y borradores en Neon sin correo, extensión wallet ni OpenRouter. No genera una app de tareas ni simula sus usuarios, archivos, consumo o transacciones.

## Activación

1. Aplicar las migraciones, incluida `202610150007_local_demo.sql`, al plano control dedicado. Respaldar SQL y objetos antes de actualizar un entorno existente.
2. En el `.env` privado de desarrollo, activar `LOCAL_DEMO_ENABLED=true`. Mantener los orígenes separados: `http://localhost:3000` y `http://127.0.0.1:4000`.
3. Reiniciar `bun run dev`, abrir la plataforma y pulsar **Entrar en demo**.
4. Crear un proyecto, escribir una idea o usar el ejemplo de gestor de tareas, esperar **Guardado**, recargar y comprobar el texto. Cerrar sesión y volver a entrar en demo recupera el mismo propietario desde ese navegador.

El flag está apagado por defecto. La configuración rechaza habilitarlo en producción o con orígenes externos. Cada petición demo comprueba el flag, host, origen y conexión de loopback; los encabezados de proxy no conceden acceso. No hay cuenta demo global ni contraseña compartida.

## Identidad y recuperación

Una cookie aleatoria `pf_demo_identity`, HttpOnly y SameSite=Lax, identifica este perfil del navegador durante siete días. El servidor deriva un ID mediante HMAC con la clave persistente y el origen de la plataforma. Guarda sólo el subject derivado, nunca el nonce de la cookie. La sesión ordinaria dura como máximo 24 horas, usa token hash, CSRF y revocación; cerrar sesión conserva la identidad demo para volver a entrar.

Un navegador o perfil nuevo tiene otro propietario. Borrar o perder las cookies, cambiar el origen o rotar `ENCRYPTION_KEY` impide recuperar esa identidad por este acceso. Los datos SQL no se borran automáticamente al vencer la cookie. Usar sólo contenido de prueba; la demo no se convierte ni se fusiona automáticamente con una cuenta normal. Si ya hay una sesión normal, el servidor exige cerrarla antes de entrar en demo.

El respaldo incluye usuario demo, proyectos y borradores, sin sesiones, CSRF, claves o nonce de navegador. Restaurar SQL conserva los IDs; para volver a entrar por el mismo navegador se necesitan también su cookie original, clave de instancia y origen. Un backup 006 puede restaurarse hacia el 007 exacto conocido, sin alterar su journal; la compatibilidad rechaza hashes o migraciones desconocidos.

## Alcance

La UI identifica **Demo local** permanentemente. El servidor rechaza generación, autorización OpenRouter, publicación, feedback público, importación de HTML, preview privado, vínculo de wallet y mutaciones de mercado/aportes, aunque se llamen directamente por API. La lectura de publicaciones sigue disponible. Las cuentas normales conservan su recorrido con correo o wallet y OpenRouter propio.

Las pruebas automatizadas de demo usan el router real y PostgreSQL WASM; las comprobaciones Neon se registran por separado en [VALIDATION.md](VALIDATION.md). Ninguna cierra la aceptación personal de correo/Phantom/OpenRouter, el gestor ejecutable con usuarios/adjuntos o las transacciones Devnet aplazadas.
