# Trazabilidad — requisitos, plan y puertas de aceptación

Revisión: 13 de octubre de 2026. IDs R, PF, D y G proceden del [Plan de desarrollo v0.6](https://docs.google.com/document/d/1srIM_lfwFoF6V-LftWsa_yr1EWFJm8oChRvjGnyz1xQ/edit?usp=drivesdk). Las decisiones actuales están en [PRD](PRD.md). **Implementado** significa que existe código; **comprobado localmente** significa que pasó una prueba acotada; **aceptado** requiere toda la evidencia del recorrido real. Ninguna puerta se marca completa por la existencia del código.

## Requisitos R

| R | PF relacionados | Implementación / prueba local | Pendiente para aceptación |
| --- | --- | --- | --- |
| R01 Identidad y permisos | PF02, PF03 | BFF, CSRF/Origin, auth separada, propietario, revocación; tests control.identity/control/database | Neon real, dos cuentas y revocación real del proveedor |
| R02 Persistencia del proyecto | PF03, PF16 | SQL de proyectos/versiones y runtime CRUD; borradores privados con revisión optimista, autosave y restauración; tests SQL/HTTP/controlador y navegador | Recorrido personal: reiniciar procesos, volver a autenticar y recuperar proyecto/borrador/datos/adjuntos en Neon |
| R03 Generación durable | PF02, PF06, PF15 | Jobs, intento único, leases, recuperación y no repetición de envío ambiguo; tests control | Inferencia propia sin saldo, caída del worker y recuperación real |
| R04 Aislamiento del preview | PF05 | Hostnames distintos, iframe opaco, CSP y bridge acotado; tests runtime/security | Ejecución en navegador y prueba adversarial de fronteras |
| R05 Publicación/versiones | PF04, PF09 | Versiones inmutables, candidata privada y puntero público explícito; tests SQL/HTTP | Dos cuentas, publicar y volver a versión previa sin filtrar borradores |
| R06 Consumo real | PF07, PF15 | Recibos, normalización, estado pending/unknown y conciliación; sin pago automático | Recibo real y agotamiento de cuota; presupuesto financiado fuera de esta entrega |
| R07 Iteración medible | PF08 | Base HTML/manifiesto al modelo, comparación, changelog/no_changes e historial | Tarea equivalente antes/después con proveedor real; medidas de calidad/coste |
| R08 Descubrir/feedback | PF01, PF09, PF11 | Discovery sólo publicado, feedback por versión, aprobación/rechazo; sin datos de actividad falsos | Visitante y segunda cuenta, límites efectivos, recorrido de moderación |
| R09 Aporte verificable | PF10 | Intención exacta, referencia, verificador y firma única; tests market-api/database | Aporte finalizado Devnet, repetición concurrente y recuperación de caída |
| R10 Token/mercado | PF12 | Programa Anchor/SPL, curva y verificador; CI SBF/math aprobado con el ID actual y artefacto/hash registrados | Despliegue, autoridades on-chain y operaciones/adversarios Devnet |
| R11 Operación/recuperación | PF13 | Recuperación de jobs, conciliación y backup/restore SQL+S3 aprobado en QA aislado | Alertas/interruptores, recuperación de identidad y procedimientos operativos completos |
| R12 Archivos/publicación | PF14, PF16 | Gateway, hashes; Neon S3 privado y restore de objetos/metadata QA aprobados | Login/gateway real con dos apps/usuarios, CRUD/adjuntos y app_id alterado |

## Unidades PF

| PF | Entrega de código | Estado y límite |
| --- | --- | --- |
| PF01 Eliminar cifras ficticias | UI normal sin semillas, volumen, rankings o tendencias inventadas | Implementado; prototipo archivado |
| PF02 Frontera del servidor | Auth, secretos cifrados, CSRF/Origin y validadores acotados | Pruebas locales; servicios reales pendientes |
| PF03 Proyecto persistente | Modelo SQL y propietario; importación privada voluntaria | Pruebas SQL; persistencia cloud pendiente |
| PF04 Versiones/publicación | Artefactos con hash y padre; publicación explícita de una versión | Pruebas SQL/HTTP; recorrido completo pendiente |
| PF05 Preview aislado | Runtime separado, documento confiable y iframe generado opaco | Código/tests; navegador pendiente |
| PF06 Jobs/worker | Idempotencia, lease, intents/attempts y resultado incierto | Pruebas locales; recuperación real pendiente |
| PF07 Consumo y conciliación | Recibos y lookup de proveedor, sin sustituir desconocido por cero | Parte de consumo implementada; reservas/presupuestos pagados aplazados |
| PF08 Iteración | Fuente base/contexto, historial y comparación de cambios | Implementado; evaluación real pendiente |
| PF09 Página pública | Versión publicada, metadata pública y runtime URL | Implementado; piloto público pendiente |
| PF10 Aporte Devnet | Intenciones separadas y verificación idempotente finalizada | API/tests; firmas y verificación real pendientes |
| PF11 Feedback/activación | Feedback versionado y moderación | Feedback implementado; eventos/analítica de activación pendientes |
| PF12 Mercado Devnet | Token, curva, vaults, quote/prepare/submit y programa compartido | SBF CI/math del ID actual aprobados; despliegue/operaciones de red pendientes |
| PF13 Operación | Backup/restore SQL+objetos y recuperación parcial | Restore QA aprobado; consola/alertas/identidad completas pendientes |
| PF14 Almacenamiento privado | SDK/gateway, límites y hashes | Neon S3 privado y restore QA aprobados; recorrido con usuarios reales pendiente; IPFS aplazado |
| PF15 Inicio OpenRouter | OAuth propio y selección gratuita elegible | Implementado; gratuidad/cuota efectiva pendiente de cuenta real |
| PF16 Backend de apps | Auth propia, colecciones, archivos y conector de metadata GitHub | Capacidades acotadas implementadas; Neon real pendiente |

## Puertas G

| Puerta | Criterio | Estado actual |
| --- | --- | --- |
| G1 Creador privado | R01–R07, R11 y R12; PF08/PF15/PF16; D06/D07/D10/D11 resueltos; generación gratuita e iteración real y CRUD/archivos aislados | **Abierta**: infraestructura/restore QA aprobados; Auth/OpenRouter, CRUD/navegador y recuperación de identidad pendientes |
| G2 Descubrimiento y aporte | G1 más R08/R09, PF09/PF11, demo pública, feedback y aporte Devnet acreditado una vez | **Abierta**: depende de G1 y transacción real |
| G3 Mercado Devnet | D01–D04 y D09 definidos; R10 y adversarios; artefacto y red verificables | **Abierta**: artefacto CI actual aprobado; despliegue/operaciones reales pendientes |
| G4 Dinero real | G1/G2, D05 y revisión externa técnica, legal y operativa; G3 si existe mercado | **Fuera del alcance autorizado**: no Mainnet ni administración de fondos IA |

## Evidencia y discrepancias

Las pruebas SQL locales usan PostgreSQL WASM/PGlite y rutas HTTP con adaptadores inyectados. La infraestructura Neon/S3 y restore QA tienen evidencia real independiente; faltan Auth, CRUD de usuario, OpenRouter y operaciones Solana. CI ejecutó tres casos SBF/math para el ID actual y registró el artefacto/hash. Las pruebas matemáticas nativas o un harness compilado por sí solos no sustituyen esa evidencia.

El conjunto actual de pruebas y los pasos pendientes se registran en [VALIDATION.md](VALIDATION.md). Las revisiones de documentos/ZIP y límites audiovisuales se registran por archivo en [DRIVE_INVENTORY.md](DRIVE_INVENTORY.md). Cambiar una hipótesis comercial o una regla de mercado requiere actualizar PRD y esta tabla; una pieza de marketing no sirve como aprobación técnica o financiera.

