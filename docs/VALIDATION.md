# Validación y estado de la entrega

## Actualización del creador — 15 de octubre de 2026

Se implementaron borradores privados con texto/modelo/base y revisión optimista, autosave confirmado por servidor, recuperación del proyecto activo, resolución explícita de conflictos y protección ante respuestas perdidas u obsoletas. Los trabajos inciertos detienen el polling y permiten comprobar ejecución/consumo sin reenviar inferencia. El SDK ahora expone `files.delete(id)` mediante el gateway autorizado existente.

- **119 pruebas TypeScript/SQL/HTTP/controlador/bridge aprobadas**, sin fallos ni omitidas. TypeScript y build aprobados. Incluyen respuestas de guardado perdidas después de revertir texto y compatibilidad de respaldos pre005/pre006 sin modificar sus hashes o journals originales. [Registro del código probado y hashes](evidence/creator-checks.2026-10-15.json).
- **16 pruebas de navegador aprobadas**: recarga/relogin, autosave de los tres campos, conflictos entre pestañas, fallo de transporte, historial Atrás/Adelante, aislamiento al cambiar cuenta, respuestas de lista obsoletas, carga de candidata y consulta de consumo sin cambiar la base. El fixture usa router/migraciones/SQL reales con PGlite, extensión técnica y catálogo HTTP de prueba explícitos; no OAuth ni inferencia reales. Capturas de escritorio y 360 px inspeccionadas; no auditoría WCAG completa.
- **Neon QA real aprobado**: dos identidades técnicas por firma de mensaje; guardado exacto/reenvío seguro; dos sesiones SQL concurrentes producen 200/409 sin sobrescritura; propietario ajeno 404, CSRF 403 y sesión revocada 401; recuperar borrador tras cerrar pool y volver a autenticar. [Evidencia saneada](evidence/neon-creator-drafts.2026-10-15.json).
- **Migración control006 aplicada al principal**, después de backup SQL/objetos verificado: RLS activo, cero grants de navegador, cero filas fixture escritas en los planos principales. [Evidencia saneada](evidence/neon-creator-drafts-migration.2026-10-15.json).
- **Restore Neon SQL/S3 real aprobado** a las 06:08:10 UTC: un proyecto, un borrador con revisión/base exactas, dos versiones inmutables, un usuario técnico de app, una tarea y un archivo privado de 97 bytes con SHA-256 coincidente. Dos bases y bucket destino aislados vacíos, endpoints/credenciales distintos del principal; no se restauraron sesiones ni conexiones del proveedor. Relogin técnico del propietario y rechazo 404 de otra cuenta aprobados. El usuario de app es fixture SQL explícito: no acredita Managed Auth, generación o uso real del gestor. [Evidencia saneada](evidence/neon-creator-restore.2026-10-15.json).

La aceptación personal de Phantom/correo, OpenRouter sin saldo, app de tareas con usuarios/adjuntos, iteración y publicación sigue pendiente. [Guía de ejecución](CREATOR_ACCEPTANCE.md). Devnet conserva el aplazamiento del usuario. Las secciones siguientes documentan el corte previo del 13 de octubre; no suman sus pruebas a las del corte nuevo.

Corte de evidencia: 13 de octubre de 2026. Esta lista separa lo observado de lo preparado. G1, G2 y G3 permanecen abiertas según [TRACEABILITY.md](TRACEABILITY.md).

**Decisión humana del 13 de octubre:** continuar con el cierre de código/PRs; el usuario conectará OpenRouter después y pidió dejar el despliegue Devnet pendiente. Ese aplazamiento no acredita inferencia o finanzas reales ni cierra las gates. La entrega integral no se declara aceptada.

## Comprobaciones disponibles

| Comprobación | Evidencia actual | Alcance |
| --- | --- | --- |
| Recursos Neon | Dos proyectos Free creados: control `silent-shape-11659103` y apps `mute-cloud-08331010`, AWS us-east-1; Managed Auth activo y bucket privado `app-files` | Provisión observada; login y flujo CRUD/adjuntos de app aún pendientes |
| Infraestructura Neon real | Migraciones control 001–005 y apps 001–002 aplicadas; dos bases distintas, esquema managed-auth y RLS/grants comprobados | No equivale a validar login/CRUD de usuarios finales |
| Neon S3 real | Probe PUT/GET, SHA-256 y rechazo de lectura anónima aprobado; objeto temporal eliminado | Comprueba almacenamiento privado; flujo completo de adjuntos de app pendiente |
| Wallet BFF + Neon SQL real | PASS: dos identidades, proyecto privado, 403 por nonce reutilizado, 404 entre cuentas, logout 401 y persistencia tras reconectar | Claves técnicas propias y sólo firmas de mensajes en QA; sin extensión personal, Managed Auth, OpenRouter ni transacciones. [Evidencia](evidence/neon-wallet-auth.2026-10-13.json) |
| Instalación frozen | PASS: 402 instalaciones, 497 paquetes | Lockfile respetado; no prueba servicios externos |
| TypeScript | Lint/compilación sin errores | No prueba una conexión externa |
| Frontend | Build de Vite correcto; mercado en chunk separado; CSS no escanea el archivo legacy | No certifica recorrido completo de navegador |
| Tests TypeScript/SQL/HTTP | Suite completa post-wallet: 104 PASS en 17,905 s, cero fail/skip/todo; incluye importes, firmas y cinco casos del script de aceptación; lint/build PASS | Los adaptadores no validan Auth/OpenRouter reales; no sumar subconjuntos otra vez |
| Importes de frontend | 3 tests de precisión, formato y cantidades superiores a Number seguro aprobados | Conversión exacta SOL/token; conjunto separado en `src/lib/amounts.test.ts` |
| Rust de curva | 3 pruebas matemáticas nativas aprobadas | Enteros, reversibilidad y límites; no ejecución SBF |
| SBF en CI | [Run C2 38357606952](https://github.com/CaBsCrypto/promptfun/actions/runs/38357606952): 3 SBF y 3 matemáticos PASS; [run 38359150252](https://github.com/CaBsCrypto/promptfun/actions/runs/38359150252) y [run 38359145636](https://github.com/CaBsCrypto/promptfun/actions/runs/38359145636) también SUCCESS con pin de imagen | ID actual C2AEAUWXez38SBM7Hz7SmfZ8dd9WdefEvkXsKUPFNyvG validado en CI; sin despliegue o transacciones Devnet verificadas |
| Drive | 38 archivos inventariados, 19 ZIP con CRC de 296 miembros, 160 MP4 con tamaño/hash cotejados | No reproducción audiovisual completa; ZIP de arquitectura sin CRC registrado |
| UI de dependencias | Health endpoint informa disponibilidad real y permite diagnóstico 503 | No se declara conectado un backend ausente |
| Navegador | Suite completa: 6 Playwright PASS en 5,4 s; 3 smoke, 1 iframe hostil y 2 de acceso con wallet | Wallet usa router/SQL reales y extensión de prueba; no extensión personal, signup/generación/CRUD completo |
| Restore Neon QA real | PASS 06:37:06 UTC: 1 proyecto, 2 versiones, 1 tarea y 1 archivo de 78 bytes; hashes de artefactos/S3 y rechazo de destino no vacío | Dos bases origen y dos destino/buckets QA aislados; conserva historial/recibos. No valida login, inferencia, finanzas ni recuperación de identidad |

El comando incluye `src/lib/*.test.ts`: los tests de importes, firmas y los cinco del script de aceptación forman parte del total de 104 y no se suman otra vez. Los cortes anteriores de 42/85/89 tests y 4 Playwright quedan superados.

La decisión del 13 de octubre añade login/vínculo de plataforma con Phantom/Solflare. El corte actual de 104/6 incluye la ampliación y no verifica extensiones personales. La migración control 005 se aplicó al plano principal y se comprobaron RLS/grants; la prueba BFF/SQL Neon QA independiente también pasó. G1 permanece abierta por los recorridos de correo/apps e inferencia pendientes, y el grafo congelado requiere una futura actualización.

## Comandos de comprobación

Requiere Node 24 o superior y Bun 1.4.2:

```powershell
bun install --frozen-lockfile
bun run lint
bun run test
bun run build
```

Las seis pruebas de navegador en `tests/e2e/` pasaron: tres smoke con backend configurado, una de iframe hostil con fixture explícita de runtime y dos de acceso con wallet mediante router/SQL reales y extensión de prueba. Se ejecutan con `bun run test:e2e`, tras instalar Chromium. **No representan extensiones personales, signup por correo, generación o CRUD completos con cuentas reales**. CUA no ofreció una superficie utilizable; las comprobaciones registradas son de Playwright.

CI de aplicación y Solana están en workflows separados. El run C2 enlazado corresponde al source `2012e1026dc49926894ed61f309fac84ba552e29`; el pin posterior está en `432ffc98217281b9feeae34d46b21d3e76c64955`, con ambos runs SUCCESS. El artefacto actual mide **317.232 bytes** y tiene SHA-256 **868663ea636d4eb6e020e57460bf8780a27b13fd56bc234733f09ee405d4ea71**. Antes de enviar un despliegue, los scripts vuelven a cotejar artefacto, ID y autoridades. Ningún run sustituye verificar bytecode finalizado en Devnet.

## Recorrido de aceptación real pendiente

| Paso | Resultado que debe observarse y conservarse |
| --- | --- |
| 1. Neon dedicado | Dos proyectos distintos, Auth activo, bucket privado y migraciones aplicadas; registrar sólo IDs/URLs públicas, nunca secretos |
| 2. Identidad de plataforma | Correo/OTP y login/logout; acceso opcional Phantom/Solflare, nonce consumido/expirado, rechazo/cambio de cuenta, vínculo/desvínculo sin quitar último método; reinicio y B no accede a A |
| 3. OpenRouter sin saldo | OAuth propio, lista elegible, generación e iteración reales; recibo de uso, agotamiento/revocación y ausencia de pago alternativo |
| 4. Preview y tareas | Abrir preview privado y **Abrir app**, sesión independiente, crear/editar/borrar tareas y adjuntos; persistencia tras recarga/reinicio |
| 5. Aislamiento | Dos apps y dos usuarios; manipular IDs, manifiestos y mensajes no cruza datos ni alcanza cookies/endpoints privados |
| 6. Publicación | Candidata no altera público; publicar una versión, volver a anterior, visitante sin wallet y feedback moderado por versión |
| 7. Worker | Caída antes y después del envío; recuperación sin inferencia duplicada; recibos pending/unknown conciliados o conservados como desconocidos |
| 8. Backup/restore | Backup SQL + objetos con hashes; restaurar en destino aislado y comprobar tareas/versiones/archivos; no probar restauración sobre datos ajenos |
| 9. Programa Devnet | Artefacto CI probado, hash/ID y autoridades coincidentes; despliegue e inicialización finalizados; supply/mint/vaults verificados |
| 10. Mercado | Registrar, cotizar, comprar, vender, llegar al cap y recomprar; insuficiencia, stale quote y firmas incorrectas rechazadas |
| 11. Aporte/recibos | Transferencia con intención exacta, acreditación única y recuperación tras timeout/reinicio; importe/destino/red alterados rechazados |
| 12. UX | Teclado, 360 px, errores/vacíos/carga, foco y contraste en los flujos reales; capturas sin secretos |

Una transacción enviada conserva estado pendiente hasta la verificación del servidor; una firma sola no prueba éxito. Un error de disponibilidad no prueba falta de saldo. Ningún dato sintético puede sustituir estas evidencias.

## Registro y lanzamiento

Evidencias saneadas: [checks de aplicación y aplazamiento humano](evidence/application-checks.2026-10-13.json), [infraestructura Neon y S3](evidence/neon-infrastructure.2026-10-13.json), [restore QA aislado](evidence/neon-restore.2026-10-13.json) y [build SBF del ID actual](evidence/solana-build.2026-10-13.json). La prueba de infraestructura se repitió después del hardening y pasó. Estos registros no contienen credenciales y no acreditan login/inferencia o transacciones de usuario.

Por cada gate se debe registrar commit, comando/run, fecha, caso, resultado y referencias públicas de red o artefacto. Las cuentas de prueba, tokens de preview, claves y dumps de datos personales no se incluyen en el registro público. El índice de Drive y las fuentes v01 siguen preservados; la publicación de marketing continúa pendiente, con `publish_ready=false` en sus manifiestos originales.

