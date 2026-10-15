# Roadmap — seis hitos aprobados

Revisión: 13 de octubre de 2026. Los títulos corresponden al plan de ejecución aprobado en la sesión. Neon sustituye al proveedor inicial de backend dentro de los hitos 2 y 4. El alcance es Creador + Mercado **Solana Devnet**, con privacidad por defecto, cuota propia de OpenRouter y token de apoyo sin créditos IA o derechos sobre ingresos. [Decisiones y requisitos](PRD.md), [puertas G](TRACEABILITY.md).

El usuario decidió el 13 de octubre continuar el cierre de código/PRs y conectar OpenRouter después; dejó explícitamente el despliegue Devnet pendiente. Los hitos distinguen ese cierre de la aceptación integral. No se vuelve a solicitar OAuth o fondeo para finalizar este alcance.

| Hito | Implementado | Verificado | Pendiente y criterio de cierre |
| --- | --- | --- | --- |
| H01 Preparar una base reproducible | Checkout y ramas, Bun/Node fijados, scripts cloud/env/migración, archivo legacy, inventario de Drive y grafo AST + requisitos persistente | 38 archivos revisados; lint/build; recursos Neon Free dedicados y migraciones aplicadas; grafo consultable con límites de motor documentados | Conservar run/commit y comandos reproducibles; actualizar el grafo al cambiar fuentes; el hito no acredita login, inferencia o mercado |
| H02 Separar responsabilidades y asegurar datos | Control/worker/runtime, identidades separadas, BFF, CSRF/Origin, cifrado, preview opaco, permisos, recibos durables y login/vínculo Phantom/Solflare | Tests control SQL/HTTP y seguridad; navegador wallet con extensión de prueba; dos bases Neon/RLS; S3 privado y restore QA | Extensiones personales, login por correo real, dos cuentas y apps sin cruce; recuperación de identidad y operación/alertas. R01, R04, R11 y R12; G1 abierta |
| H03 Demostrar creación sin capital | OAuth PKCE OpenRouter propio, catálogo gratuito elegible, job durable, versión base e iteración, consumo separado y estados inciertos | Casos locales de worker, idempotencia, revocación, validación y no reenvío ambiguo | Cuenta propia sin saldo: generar app, iterar y guardar recibo real; probar agotamiento/revocación sin fallback pagado. R03, R06 y R07; G1 abierta |
| H04 Entregar el backend administrado | Dos proyectos Neon, Managed Auth, SDK/gateway, colecciones CRUD y archivos privados con límites; publicación no publica la base | Infraestructura cloud, migraciones control 001–005/apps 001–002, RLS/grants, probe S3; backup/restore QA real de 1 proyecto/2 versiones/1 tarea/1 archivo de 78 bytes | Gestor de tareas desde navegador con cuentas reales: OTP, CRUD, adjuntos, reinicio y aislamiento; datos restaurados no restauran Auth/sesiones. R02 y R12; G1 abierta |
| H05 Publicar y operar el mercado Devnet | Publicación explícita, historial público sin prompts, discovery, feedback moderado, wallet/nonce, registro, curva, buy/sell, aporte separado y conciliación | CI Anchor para ID actual C2: 3 SBF y 3 matemáticas PASS, artefacto/hash cotejados; lógica local/API/SQL y curva exacta | Desplegar/inicializar, registrar, comprar, vender y aportar en Devnet. Faucet RPC ha fallado; no hay evidencia de operaciones finalizadas. R05, R08, R09 y R10; G2/G3 abiertas |
| H06 Cerrar la entrega con evidencia | PRD, UX, arquitectura, trazabilidad, inventario, reconciliación audiovisual v02 y comprobación | Suite completa post-wallet de 104 tests, instalación frozen, lint/build, 6 Playwright, probe/restore QA y CI SBF actual | Completar Auth/extensiones personales/OpenRouter y operaciones Devnet; revisar medios completos/URL antes de publicar. No sustituir pruebas reales por datos sintéticos |

## Evidencia disponible y límites

El [run SBF para C2](https://github.com/CaBsCrypto/promptfun/actions/runs/38357606952) pasó; los runs posteriores con pin de imagen también están enlazados en validación. El programa no está verificado como desplegado. Al desplegar se cotejan artefacto y claves técnicas persistentes externas. La autoridad de upgrade Devnet puede cambiar el programa; el vault sin retiro no promete inmutabilidad permanente.

El restore QA del 13 de octubre, 06:37:06 UTC, utilizó bases y buckets separados de los planos principales. Conservó proyecto, versiones, tarea, archivo/hashes, historial de publicación y recibos; rechazó un destino no vacío. No validó autenticación de usuarios, inferencia o finanzas. Los planos principales no se poblaron con esos datos de prueba.

La suite completa post-wallet pasó 104 tests y 6 Playwright; supera el corte de 89/4. [VALIDATION.md](VALIDATION.md) enlaza las evidencias saneadas. [La reconciliación audiovisual v02](audiovisual/RECONCILIATION.v02.md) conserva originales y mantiene `publish_ready=false`. El grafo conserva su snapshot anterior; la nueva autenticación requiere una futura actualización.

## Orden de cierre

**Prioridad del 15 de octubre: creador completo.** Se añaden borradores privados con autosave y revisión optimista, recuperación del proyecto activo, errores recuperables y consulta manual del resultado incierto. Las pruebas locales, de navegador y Neon QA se registran en [VALIDATION.md](VALIDATION.md); el [recorrido con cuentas reales](CREATOR_ACCEPTANCE.md) mantiene G1 abierta hasta generar, usar, iterar y publicar la app de tareas. La siguiente fase será una beta online pequeña; el despliegue y las operaciones Devnet conservan su aplazamiento independiente.

Código y evidencia de esta fase: [PR #3 en borrador](https://github.com/CaBsCrypto/promptfun/pull/3), dependiente de PR #2. Corte del 15 de octubre: 119 pruebas locales y 16 de navegador aprobadas, control006 aplicado con backup previo y restauración Neon SQL/S3 de proyecto/borrador/versiones/tarea/archivo aprobada. No sustituye el recorrido personal ni cierra G1/G2/G3.

H01 aporta una base navegable y reproducible. H02 y H04 deben demostrar las fronteras con cuentas reales; H03 necesita la generación gratuita efectiva. La publicación de una versión y el mercado se verifican en H05, con artefacto/autoridades/red coincidentes. H06 reúne resultados y sólo cierra los criterios satisfechos. No hay autorización de Mainnet ni de administración de fondos IA; G4 queda fuera de esta entrega.

