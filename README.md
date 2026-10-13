# promptfun

Creador de apps con versiones persistentes, backend de datos y publicación consciente, más un mercado de tokens de apoyo en **Solana Devnet**. El primer caso de aceptación es una app de tareas con archivos. La plataforma permite acceso opcional con correo o wallet Phantom/Solflare mediante firma de mensaje, sin transacción ni SOL. OpenRouter, usuarios de las apps y autorización financiera por proyecto mantienen permisos separados.

La reestructuración utiliza React/Vite, una API de control y worker en Node/Bun, un runtime aislado, dos proyectos **Neon cloud** con Managed Auth y almacenamiento S3 privado, y un programa Anchor 1.2.1. El prototipo anterior está preservado en `legacy/prototype`; el flujo normal no usa proyectos o actividad simulados.

**Estado:** 104 tests locales, instalación frozen, lint/build y 6 Playwright aprobados después de añadir acceso con wallet; infraestructura Neon/S3 y restore QA aislado verificados. CI aprobó 3 SBF y 3 matemáticas para el ID actual. Extensiones personales, Auth/CRUD con usuarios reales, OpenRouter, despliegue/transacciones Devnet y recuperación operativa completa siguen pendientes. G1–G3 permanecen abiertas. No hay Mainnet, dinero real ni conversión de aportes a créditos IA.

El usuario decidió continuar el cierre de código/PRs, conectar OpenRouter después y dejar el despliegue Devnet pendiente. Este cierre no equivale a aceptar los recorridos reales aplazados.

El acceso de plataforma con wallet pasó además una prueba real del BFF y PostgreSQL Neon en QA: dos identidades aisladas, desafío de un solo uso, logout y recuperación del proyecto al reconectar. Fueron firmas de mensajes con claves técnicas propias; las extensiones personales y los usuarios por correo de las apps siguen pendientes. [Evidencia](docs/evidence/neon-wallet-auth.2026-10-13.json).

También decidió el 13 de octubre permitir login inicial con wallet o correo. Una cuenta con correo puede vincular acceso con wallet; una cuenta cuya única credencial es la wallet no puede quitarla. Los usuarios de las apps generadas siguen usando correo/OTP. Dos pruebas de navegador recorren la nueva autenticación con router/SQL reales y una wallet de prueba; faltan extensiones personales. El grafo queda congelado en el corte anterior y registra esta actualización pendiente.

## Documentación

- [PRD y decisiones actuales](docs/PRD.md)
- [Arquitectura, fronteras y mercado](docs/ARCHITECTURE.md)
- [Flujos UX y estados](docs/UX.md)
- [Requisitos R/PF y puertas G](docs/TRACEABILITY.md)
- [Validación y pasos pendientes](docs/VALIDATION.md)
- [Seis hitos aprobados](docs/ROADMAP.md)
- [Reconciliación audiovisual v02](docs/audiovisual/RECONCILIATION.v02.md)
- [Inventario de los 38 archivos originales de Drive](docs/DRIVE_INVENTORY.md)

Los documentos y paquetes v01 de Drive se conservan sin cambios. Esta revisión incorpora las decisiones humanas posteriores: Creador + Mercado Devnet en la entrega y Neon cloud sin Docker local.

## Desarrollo con Neon cloud

Requisitos: Node 24 o superior, Bun **1.4.2**, acceso autorizado a Neon y dos proyectos dedicados en AWS `us-east-1`: `promptfun-control` y `promptfun-apps`. Cada uno requiere Managed Neon Auth; el plano apps requiere bucket privado `app-files` y credenciales S3 correspondientes. La provisión y las cuotas disponibles deben comprobarse en la cuenta; no se reutilizan proyectos ajenos.

Instalar dependencias y preparar las claves persistentes locales:

```powershell
bun install --frozen-lockfile
if (!(Test-Path -LiteralPath .env)) { Copy-Item -LiteralPath .env.example -Destination .env }
bun run local:env
```

Autenticar la CLI Neon 8.4.1 con la cuenta que tiene acceso a los recursos dedicados. Completar en `.env` `NEON_CONTROL_PROJECT_ID` y `NEON_APPS_PROJECT_ID`; opcionalmente, las branches correspondientes. La herramienta valida nombres, plan Free y que las branches de Auth/DB coincidan, obtiene credenciales y las guarda en archivos ignorados sin imprimirlas:

```powershell
bun run cloud:configure --allow-local-development
```

Ese flag habilita los orígenes locales en Auth de los proyectos dedicados. El comando no crea proyectos, no cambia de plan ni modifica recursos ajenos. Mantener `BACKEND_PROVIDER=neon` y comprobar las conexiones `CONTROL_DATABASE_URL`, `APPS_DATABASE_URL`, `CONTROL_AUTH_URL`, `APPS_AUTH_URL` y `NEON_STORAGE_*` guardadas. Los endpoints de Auth son los emitidos por Neon, no los hostnames de Postgres. Las claves nunca se agregan a Git ni a variables del frontend. Los recursos y el login real deben verificarse antes del piloto.

Aplicar las migraciones a ambos planos:

```powershell
bun run db:migrate
```

El layout histórico de SQL es `supabase/control/migrations` y `supabase/apps/migrations`; el runner usa las conexiones actuales de Neon. No hace falta Docker para este flujo. `local:up` y el adapter Supabase quedan como compatibilidad del setup anterior.

Iniciar la API/plataforma y el runtime, y en otra terminal el worker:

```powershell
bun run dev
```

```powershell
bun run worker
```

Abrir [plataforma local](http://localhost:3000). El runtime usa [127.0.0.1:4000](http://127.0.0.1:4000) y requiere una URL de app/versión; se obtiene con **Abrir app** en el proyecto. Los hostnames deben ser distintos. Usar esa pestaña superior para iniciar sesión y guardar tareas/archivos, ya que la sesión propia del runtime puede no persistir dentro del iframe entre sitios.

Sin conexiones cloud, la entrada permite ver el diagnóstico y `/api/health` responde 503 si la base no está disponible. La UI presenta el error real; no rellena proyectos, balances o generaciones de prueba.

## Recorrido inicial

Entrar a la plataforma con Phantom/Solflare firmando un mensaje, o crear una cuenta por correo, confirmar el código recibido e iniciar sesión con contraseña. La confirmación no abre automáticamente una sesión. Crear el proyecto privado y conectar la cuenta propia de OpenRouter desde la interfaz. Elegir un modelo gratuito elegible, pedir una app de tareas con archivos, esperar el job y revisar su versión. Abrir el runtime, crear una cuenta propia de la app y comprobar CRUD/adjuntos tras recargar. Iterar sobre una versión base y publicar sólo la versión revisada.

Un visitante ve únicamente versiones publicadas; el feedback requiere sesión de plataforma y aprobación del creador. Google no está configurado para el adapter Neon. OpenRouter no garantiza cuota/disponibilidad y nunca activa una opción pagada automáticamente.

## Mercado Devnet

El token tiene supply fijo de **1.000.000.000**, 6 decimales, **80 % curva / 20 % bloqueado** y comisión de protocolo **0**. Es un token de apoyo negociable, sin derechos sobre empresa/ingresos ni créditos IA. Compras envían SOL de prueba al vault de curva; aportes directos van por una intención separada a la wallet del proyecto. Rent y tarifas de red siguen aplicando.

El código de programa y herramientas está en `programs/` y `scripts/solana-*.ts`. CI Linux construye el programa con Anchor 1.2.1 y produce `promptfun_market.so`, IDL y `artifact.json`. Un ID público en el código no demuestra despliegue. Antes de habilitar mercado real se requieren artefacto probado, hash/ID, autoridades y configuración Devnet verificadas. Claves técnicas permanecen fuera del repositorio; los scripts de despliegue/inicialización preparan sin enviar salvo `--submit` explícito. [Arquitectura y curva](docs/ARCHITECTURE.md).

Configurar `SOLANA_RPC_URL`, `MARKET_PROGRAM_ID` y `MARKET_REGISTRAR_KEY_PATH` tras esa verificación. La interfaz usa Phantom/Solflare para firmas del participante y registra pending hasta que el servidor verifica finalización. El login con wallet no sustituye la autorización financiera específica de cada proyecto.

## Comprobaciones

```powershell
bun run lint
bun run test
bun run build
```

Playwright: `bun run test:e2e`, con Chromium instalado. El corte posterior a wallet pasó 104 tests sin skip/todo/fail (17,905 s) y 6 Playwright (5,4 s): tres smoke, uno de iframe hostil y dos de acceso con wallet usando router/SQL reales y una extensión de prueba. Instalación frozen, lint/build y CI de 3 SBF + 3 matemáticas aprobados. Los cortes de 89/4 quedan superados; no hay recorrido con extensiones personales, Auth/OpenRouter/Devnet integral aceptado. [Artefacto, fuentes y evidencias](docs/VALIDATION.md).

El repo original es [CaBsCrypto/promptfun](https://github.com/CaBsCrypto/promptfun); el análisis partió de [b8692a1](https://github.com/CaBsCrypto/promptfun/commit/b8692a1d9d89fcbde1a26702d46f9251cc2ce7e9). La reestructuración está en `codex/restructure-promptfun-devnet` y necesita completar la evidencia indicada antes de anunciar disponibilidad.

