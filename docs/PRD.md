# PRD — revisión de implementación

Revisión: 13 de octubre de 2026. Sustituye las decisiones abiertas de los documentos iniciales únicamente donde el usuario ha definido el alcance de esta entrega. Los originales v01 permanecen en Drive: [inventario completo](DRIVE_INVENTORY.md). La trazabilidad de requisitos y criterios está en [TRACEABILITY.md](TRACEABILITY.md).

## Resultado buscado

**Prioridad aprobada el 15 de octubre:** completar el recorrido del creador antes de una beta online. El editor conserva automáticamente texto, modelo y versión base en un borrador privado por proyecto; recargar recupera también el proyecto activo. Los conflictos entre pestañas requieren elegir una copia. Una generación incierta permite seguir editando y guardar, pero no repetir el intento equivalente. La cuenta OpenRouter personal y el despliegue Devnet siguen pendientes; las mejoras de código no cierran por sí mismas G1. [Recorrido de aceptación](CREATOR_ACCEPTANCE.md).

Una persona crea una app de tareas con archivos, itera sobre una versión existente, conserva sus datos y publica conscientemente una versión. Otra persona descubre esa versión, la prueba y aporta feedback. El proyecto puede habilitar un token de apoyo negociable y aportes directos en **Solana Devnet**, con importes y transacciones verificables. Crear o probar la app no requiere wallet.

La entrega utiliza una cuenta propia de OpenRouter y una ruta de modelos gratuitos elegibles. La disponibilidad, cuota y respuesta dependen del proveedor; un modelo gratuito no garantiza una generación exitosa. No hay sustitución automática por un modelo de pago. Los SOL y tokens de Devnet no pagan inferencia.

El 13 de octubre el usuario aplazó la conexión OpenRouter y el despliegue Devnet, autorizando continuar el cierre de código/PRs. Se mantienen los criterios de aceptación real abiertos y no se declara la entrega integral aceptada.

## Personas y recorridos

| Persona | Resultado | Identidad necesaria |
| --- | --- | --- |
| Creador | Crear proyecto privado, generar, revisar, iterar y publicar una versión | Sesión de plataforma por correo o wallet opcional; OpenRouter para generar; autorización financiera de wallet separada |
| Visitante | Descubrir y abrir una versión publicada | Ninguna para ver la demo; sesión de la app para guardar sus propios datos |
| Colaborador | Enviar feedback de una versión | Sesión de plataforma; sin wallet |
| Participante de mercado | Cotizar, comprar, vender o aportar SOL de prueba | Sesión de plataforma y wallet Devnet para firmar |
| Operador | Ejecutar worker, migraciones, conciliación y verificar pendientes | Acceso técnico separado, sin exposición de secretos a la interfaz |

## Alcance de esta entrega

| Área | Comportamiento previsto | Estado de aceptación |
| --- | --- | --- |
| Creador | Proyectos persistentes, versiones inmutables, generación durable, preview aislado, comparación y publicación explícita | Implementado; pruebas locales; integración real pendiente |
| Backend de apps | Autenticación independiente, CRUD por app/usuario y archivos privados mediante SDK y gateway | Infraestructura/S3/restore QA aprobados; Auth y flujo CRUD/adjuntos con usuarios reales pendientes |
| Proveedor | OAuth PKCE OpenRouter, conexión revocable, modelos elegibles y consumo recibido o pendiente | Implementado; cuenta sin saldo y generación real pendientes |
| Descubrimiento | Sólo proyectos publicados, versión pública y feedback moderado por versión | Implementado; recorrido completo con servicios reales pendiente |
| Mercado | Registro explícito, curva, compras/ventas, aportes separados y verificación finalizada Devnet | CI SBF del ID actual y artefacto/hash aprobados; despliegue y transacciones reales pendientes |
| Operación | Worker con recuperación, recibos, migraciones y respaldo/restauración | Restore SQL+objetos aprobado en QA; identidad, alertas y operación continua pendientes |

La app generada es HTML/CSS/JavaScript con capacidades declaradas. No ejecuta shell, SQL arbitrario, servidores, paquetes externos ni código con claves. El primer caso de aceptación es un gestor de tareas con adjuntos, no un constructor de backend sin límites. El conector implementado se limita a metadata pública de `github.repository`; no escribe en GitHub.

Se aplazan Mainnet, dinero real, presupuestos de IA financiados con aportes, retiros del vault, graduación, DEX, competición, rankings, métricas sociales, derechos sobre ingresos, analítica de activación completa e IPFS. El prototipo anterior permanece en `legacy/prototype`, fuera del flujo normal.

## Decisiones vigentes

Los títulos D corresponden al [Plan original v0.6](https://docs.google.com/document/d/1srIM_lfwFoF6V-LftWsa_yr1EWFJm8oChRvjGnyz1xQ/edit?usp=drivesdk).

| ID | Decisión para esta entrega | Límite |
| --- | --- | --- |
| D01 | Token de apoyo negociable | No otorga equity, ingresos, retorno garantizado ni créditos IA |
| D02 | Supply fijo de 1.000.000.000, 6 decimales; 80 % curva y 20 % reservado/bloqueado; mint authority revocada y sin freeze authority | Reglas Devnet; el tramo bloqueado no dispone de retiro en esta entrega |
| D03 | Curva acumulada exacta; compra/venta y recompra después de alcanzar el cap | Sin graduación ni liquidez externa |
| D04 | Comisión de protocolo 0; compras al vault de curva; aportes directos separados a wallet del proyecto | Tarifas/rent de la red continúan; ninguna conversión a créditos IA |
| D05 | No administrar fondos de IA en este alcance | El presupuesto financiado y reglas de conversión/reembolso siguen sin resolver |
| D06 | Creador + Mercado Devnet; primer caso CRUD de tareas con archivos; OpenRouter propio; Neon cloud | La gratuidad efectiva y la provisión real deben comprobarse |
| D07 | Privacidad por defecto; publicación explícita de una versión | Publicar el frontend no publica prompts, borradores, claves ni bases de datos |
| D08 | Competencias futuras aplazadas | No datos simulados de actividad o clasificación |
| D09 | Programa compartido Anchor 1.2.1 y SPL clásico, sólo Devnet; autoridades técnicas separadas | No autorización ni evidencia de despliegue Mainnet |
| D10 | Almacenamiento privado Neon S3 y hashes; proyectos cloud separados | IPFS aplazado; restore QA aprobado, recuperación de identidad pendiente |
| D11 | Managed Neon Auth por correo; login opcional de plataforma Phantom/Solflare verificado por el BFF; usuarios de apps, OAuth y autorización financiera separados | Decisión wallet del 13 de octubre; correo confirmado cuando se usa; Google no configurado; extensiones y recuperación reales pendientes |

## Requisitos de aceptación

| ID | Requisito | Evidencia necesaria para aceptarlo |
| --- | --- | --- |
| R01 | Identidad y permisos separados | Crear sin wallet, negar acceso B→A y revocar OpenRouter sin borrar proyectos |
| R02 | Proyecto y datos persistentes | CRUD, sesión y archivos sobreviven reinicio; apps y usuarios no cruzan datos |
| R03 | Generación durable y recuperación | Job/intento/fuente persistentes, idempotencia y recuperación sin repetir una inferencia ambigua; cuenta sin saldo validada |
| R04 | Preview aislado | Código generado sin acceso a cookies/claves de plataforma, navegación superior ni endpoints privados; bridge verifica emisor/esquema |
| R05 | Versiones y publicación consciente | Candidata no modifica público; historial inmutable; selección explícita y regreso a una versión previa |
| R06 | Consumo real | Registrar tokens, coste, modelo, intento y fuente; desconocido pendiente; sin débitos imaginarios ni pago automático |
| R07 | Iteración y comparación | Enviar versión base al modelo, mostrar cambios reales y conservar historial; comprobar tarea equivalente antes/después |
| R08 | Descubrir, probar y dar feedback | Abrir publicado sin wallet; feedback ligado a versión y moderado; etiquetas Devnet sin actividad inventada |
| R09 | Aporte verificable | Validar intención, red, destino, importe, referencia y expiración; acreditar una vez incluso con concurrencia/reinicio |
| R10 | Token y mercado | Verificar mint, programa, autoridades, supply, vaults e importes; pruebas adversariales reales en Devnet |
| R11 | Operación y recuperación | Encontrar pendientes sin secretos, preservar evidencia, respaldar/restaurar y controlar discrepancias |
| R12 | Archivos y publicación | Objetos privados por app/usuario; hashes; manipulación de app_id sin acceso cruzado; recuperación verificable |

## Secuencia de aceptación

Primero se conectan dos proyectos Neon dedicados, Auth y un bucket privado; después se ejecuta el recorrido de tareas con archivos, se revoca/reconecta OpenRouter y se comprueba generación/iteración con cuenta sin saldo. El preview se abre también en una pestaña de runtime para validar la sesión propia de la app. Luego se publica una versión y se revisa el feedback desde una segunda cuenta.

En paralelo, CI Linux debe producir y probar el artefacto SBF correspondiente al ID público. Sólo después de comprobar hash, red y autoridades se despliega/inicializa Devnet y se valida registro, compra, venta, aporte y recuperación de recibos. Ninguna puerta G1–G3 se cierra por compilar o pasar pruebas inyectadas: véase [VALIDATION.md](VALIDATION.md).

