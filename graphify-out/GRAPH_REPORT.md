# Graph Report - PromptFun  (2026-10-13)

## Corpus Check
- 105 files · ~57,278 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 895 nodes · 2287 edges · 41 communities (34 shown, 5 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 137 edges (avg confidence: 0.85)
- Token cost: unknown for host-agent semantic extraction; no external LLM API calls. Zero counters in extraction are placeholders, not measured usage.

## Graph Freshness
- Built from commit: `432ffc98`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- API de control, seguridad y generación
- Interfaz de creador y mercado
- Backup, restore e infraestructura cloud
- Arquitectura, SDK y aislamiento runtime
- Fuentes Drive y reconciliación audiovisual
- Programa Anchor y autoridades
- Loader y despliegue verificable
- Harness SBF y casos atómicos
- Paquete y compilación Vite
- Managed Auth e identidad remota
- Estado y protocolo del mercado
- Comandos de desarrollo y CI
- Dependencias de ejecución
- Configuración TypeScript
- Gate del creador y consumo IA
- Esquema SQL del control
- Decisiones aprobadas del token y aportes
- Requisitos de datos, privacidad y recuperación
- Evidencia, roadmap y gates pendientes
- Curva y cotizaciones exactas
- Dependencias de desarrollo
- Setup Neon y entorno local
- Conciliación financiera y Devnet
- Discovery, publicación y feedback
- Preparación y verificación de transacciones
- Inicialización del programa Devnet
- Pruebas SQL del mercado
- Configuración de autoridades Devnet
- Esquema SQL de mercado y aportes
- Claves técnicas externas
- Esquema SQL de apps
- Pruebas HTTP del mercado
- Compatibilidad del setup Supabase
- Evidencia de navegador y cierre de entrega
- Versiones del runtime
- Recibos idempotentes de apps
- Paquete Rust del mercado
- Paquete Rust del harness SBF
- Referencia SQL a usuarios de plataforma

## God Nodes (most connected - your core abstractions)
1. `HttpError` - 81 edges
2. `Inventario y revisión de Drive` - 47 edges
3. `Arquitectura — revisión Neon / Devnet` - 32 edges
4. `PRD — revisión de implementación` - 31 edges
5. `errorMessage()` - 30 edges
6. `createMarketRouter()` - 29 edges
7. `createRuntimeRouter()` - 29 edges
8. `Trazabilidad — requisitos, plan y puertas de aceptación` - 26 edges
9. `CoreContext` - 24 edges
10. `mountAuth()` - 23 edges

## Surprising Connections (you probably didn't know these)
- `CI de aplicación configurado` --references--> `build`  [EXTRACTED]
  .github/workflows/ci.yml → package.json
- `CI de aplicación configurado` --references--> `lint`  [EXTRACTED]
  .github/workflows/ci.yml → package.json
- `CI de aplicación configurado` --references--> `test`  [EXTRACTED]
  .github/workflows/ci.yml → package.json
- `CI de aplicación configurado` --references--> `test:e2e`  [EXTRACTED]
  .github/workflows/ci.yml → package.json
- `Build y pruebas SBF en Linux` --conceptually_related_to--> `G3 Mercado Devnet`  [INFERRED]
  .github/workflows/solana.yml → docs/TRACEABILITY.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Aceptación de creador privado** — docs_traceability_g1, docs_prd_r01, docs_prd_r02, docs_prd_r03, docs_prd_r04, docs_prd_r05, docs_prd_r12 [EXTRACTED 1.00]
- **Identidades independientes** — docs_architecture_platform_auth, docs_architecture_apps_auth, docs_architecture_openrouter, docs_architecture_wallet, docs_architecture_identity_boundary [INFERRED 0.95]
- **Mercado verificable Devnet** — docs_architecture_program, docs_architecture_curve, docs_architecture_devnet_rpc, docs_architecture_wallet, docs_traceability_g3 [INFERRED 0.85]

## Communities (41 total, 5 thin omitted)

### Community 0 - "API de control, seguridad y generación"
Cohesion: 0.05
Nodes (113): cookie-parser, express, pg, validateBundle(), assertCsrf(), authenticate(), cookieOptions(), cookieValue() (+105 more)

### Community 1 - "Interfaz de creador y mercado"
Cohesion: 0.06
Nodes (76): PF01 Eliminar cifras ficticias, <!doctype html>, lucide-react, react, ApiErrorBody, AppVersion, Feedback, FreeModel (+68 more)

### Community 2 - "Backup, restore e infraestructura cloud"
Cohesion: 0.07
Nodes (52): @aws-sdk/client-s3, assertEmptyDatabase(), assertIsolatedTargets(), BACKUP_TABLES, BackupBundle, BackupDatabase, BackupManifest, bytesFile() (+44 more)

### Community 3 - "Arquitectura, SDK y aislamiento runtime"
Cohesion: 0.06
Nodes (44): Managed Neon Auth de apps, Neon apps, Gateway de apps, Manifiesto de capacidades, Planes Neon, revisión del 6 de octubre, OpenRouter OAuth, Storage, límites del proveedor (+36 more)

### Community 4 - "Fuentes Drive y reconciliación audiovisual"
Cohesion: 0.06
Nodes (41): Reconciliación audiovisual v02, Registro estructurado audiovisual v02, Muestras audiovisuales e integridad, Promptfun_160_manifest_control.json, Marketing y comunidad de promptfun, Promptfun_DEV_16-20_10MP4.zip, carpeta raíz de Promptfun, Promptfun_DEV_06-10_10MP4.zip (+33 more)

### Community 5 - "Programa Anchor y autoridades"
Cohesion: 0.13
Nodes (33): Account, Context, Market, Mint, Program, ProgramData, assert_backing(), buy() (+25 more)

### Community 6 - "Loader y despliegue verificable"
Cohesion: 0.10
Nodes (28): args, artifact, authority, binary, connection, externalKey(), manifest, option() (+20 more)

### Community 7 - "Harness SBF y casos atómicos"
Cohesion: 0.14
Nodes (21): AccountMeta, Address, name: promptfun Solana build, Build y pruebas SBF en Linux, Instruction, Keypair, LiteSVM, buy_sell_cap_reopening_slippage_expiry_and_locked_vault_are_atomic() (+13 more)

### Community 8 - "Paquete y compilación Vite"
Cohesion: 0.07
Nodes (27): name, packageManager, private, type, version, @anchor-lang/core, autoprefixer, esbuild (+19 more)

### Community 9 - "Managed Auth e identidad remota"
Cohesion: 0.19
Nodes (23): RFC-9562, authUrl(), checkedCookie(), confirmed(), failed(), Identity, identityId(), IdentityPlane (+15 more)

### Community 10 - "Estado y protocolo del mercado"
Cohesion: 0.18
Nodes (21): PF10 Aporte Devnet, PF12 Mercado Devnet, Recibo financiero pendiente, addresses(), associatedToken(), ATA_PROGRAM, createAta(), MEMO_PROGRAM (+13 more)

### Community 11 - "Comandos de desarrollo y CI"
Cohesion: 0.12
Nodes (20): CI de aplicación configurado, name: promptfun checks, scripts, backup, backup:restore, backup:verify, build, cloud:configure (+12 more)

### Community 12 - "Dependencias de ejecución"
Cohesion: 0.11
Nodes (19): dependencies, @anchor-lang/core, @aws-sdk/client-s3, cookie-parser, dotenv, express, lucide-react, motion (+11 more)

### Community 13 - "Configuración TypeScript"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, allowJs, experimentalDecorators, isolatedModules, jsx, lib, module (+9 more)

### Community 14 - "Gate del creador y consumo IA"
Cohesion: 0.24
Nodes (17): promptfun Plan de desarrollo y registro de decisiones, D06 Creador + Mercado Devnet; primer caso CRUD de tareas con archivos; OpenRouter propio; Neon cloud, R03 Generación durable y recuperación, R06 Consumo real, R07 Iteración y comparación, H03 Demostrar creación sin capital, Trazabilidad — requisitos, plan y puertas de aceptación, G1 Creador privado (+9 more)

### Community 15 - "Esquema SQL del control"
Cohesion: 0.27
Nodes (15): app_versions_immutable, public.app_versions, public.auth_flows, public.feedback, public.free_quota_days, public.generation_attempts, public.generation_jobs, public.migration_batches (+7 more)

### Community 16 - "Decisiones aprobadas del token y aportes"
Cohesion: 0.17
Nodes (16): Medios v01 privados y publicación bloqueada, Aporte Devnet separado de IA, D01 Token de apoyo negociable, D02 Supply fijo de 1.000.000.000, 6 decimales; 80 % curva y 20 % reservado/bloqueado; mint authority revocada y sin freeze authority, D03 Curva acumulada exacta; compra/venta y recompra después de alcanzar el cap, D04 Comisión de protocolo 0; compras al vault de curva; aportes directos separados a wallet del proyecto, D05 No administrar fondos de IA en este alcance, D07 Privacidad por defecto; publicación explícita de una versión (+8 more)

### Community 17 - "Requisitos de datos, privacidad y recuperación"
Cohesion: 0.19
Nodes (16): R01 Identidad y permisos separados, R02 Proyecto y datos persistentes, R04 Preview aislado, R11 Operación y recuperación, R12 Archivos y publicación, H02 Separar responsabilidades y asegurar datos, H04 Entregar el backend administrado, PF03 Proyecto persistente (+8 more)

### Community 18 - "Evidencia, roadmap y gates pendientes"
Cohesion: 0.15
Nodes (16): R10 Token y mercado, run SBF para C2, Roadmap — seis hitos aprobados, 11. Aporte/recibos, run 38359150252, run 38359145636, Validación y estado de la entrega, 10. Mercado (+8 more)

### Community 19 - "Curva y cotizaciones exactas"
Cohesion: 0.19
Nodes (14): decodeMarket(), discriminator(), fundingTransaction(), cumulativeCost(), CURVE_SUPPLY, LOCKED_SUPPLY, MAX_U64, QUOTE_SECONDS (+6 more)

### Community 20 - "Dependencias de desarrollo"
Cohesion: 0.13
Nodes (15): devDependencies, autoprefixer, @electric-sql/pglite, esbuild, @playwright/test, supabase, tailwindcss, tsx (+7 more)

### Community 21 - "Setup Neon y entorno local"
Cohesion: 0.15
Nodes (9): H01 Preparar una base reproducible, dotenv, args, env, argv, cli(), envPath, ids (+1 more)

### Community 22 - "Conciliación financiera y Devnet"
Cohesion: 0.20
Nodes (9): @solana/web3.js, args, connection, paths, root, assertDevnet(), DEVNET_GENESIS, hash() (+1 more)

### Community 23 - "Discovery, publicación y feedback"
Cohesion: 0.24
Nodes (13): Promptfun diseño UX y pantallas, R05 Versiones y publicación consciente, R08 Descubrir, probar y dar feedback, R09 Aporte verificable, H05 Publicar y operar el mercado Devnet, G2 Descubrimiento y aporte, PF04 Versiones/publicación, PF09 Página pública (+5 more)

### Community 24 - "Preparación y verificación de transacciones"
Cohesion: 0.26
Nodes (13): verifyPreparedTransaction(), verifyWalletMessage(), createMarketRouter(), attachSubmission(), devnet(), prepare(), project(), reconcile() (+5 more)

### Community 25 - "Inicialización del programa Devnet"
Cohesion: 0.18
Nodes (10): authority, [authorityPath,registrarAddress], connection, inside, loader, path, program, registrar (+2 more)

### Community 26 - "Pruebas SQL del mercado"
Cohesion: 0.22
Nodes (6): @electric-sql/pglite, alice, bob, project(), query(), tail

### Community 27 - "Configuración de autoridades Devnet"
Cohesion: 0.20
Nodes (9): args, authority, connection, inside, path, program, registrarIndex, root (+1 more)

### Community 28 - "Esquema SQL de mercado y aportes"
Cohesion: 0.53
Nodes (8): public.projects, public.funding_intents, public.market_quotes, public.markets, public.project_wallet_bindings, public.project_wallet_challenges, public.solana_transactions, public.platform_users

### Community 29 - "Claves técnicas externas"
Cohesion: 0.22
Nodes (8): args, canonical, checked, paths, publicKeys, root, scope, target

### Community 30 - "Esquema SQL de apps"
Cohesion: 0.43
Nodes (7): public.app_files, public.app_instances, public.app_memberships, public.app_records, public.app_sessions, public.app_users, public

### Community 31 - "Pruebas HTTP del mercado"
Cohesion: 0.32
Nodes (4): ControlFixture, fixture(), headers(), post()

### Community 32 - "Compatibilidad del setup Supabase"
Cohesion: 0.33
Nodes (3): env, projects, refs

### Community 34 - "Versiones del runtime"
Cohesion: 0.67
Nodes (3): engines, bun, node

## Knowledge Gaps
- **253 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+248 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 322 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@solana/web3.js` connect `Conciliación financiera y Devnet` to `Interfaz de creador y mercado`, `Loader y despliegue verificable`, `Paquete y compilación Vite`, `Estado y protocolo del mercado`, `Curva y cotizaciones exactas`, `Inicialización del programa Devnet`, `Pruebas SQL del mercado`, `Configuración de autoridades Devnet`, `Claves técnicas externas`, `Pruebas HTTP del mercado`?**
  _High betweenness centrality (0.116) - this node is a cross-community bridge._
- **Why does `Trazabilidad — requisitos, plan y puertas de aceptación` connect `Gate del creador y consumo IA` to `Interfaz de creador y mercado`, `Arquitectura, SDK y aislamiento runtime`, `Fuentes Drive y reconciliación audiovisual`, `Estado y protocolo del mercado`, `Decisiones aprobadas del token y aportes`, `Requisitos de datos, privacidad y recuperación`, `Evidencia, roadmap y gates pendientes`, `Discovery, publicación y feedback`?**
  _High betweenness centrality (0.098) - this node is a cross-community bridge._
- **Why does `HttpError` connect `API de control, seguridad y generación` to `Backup, restore e infraestructura cloud`, `Arquitectura, SDK y aislamiento runtime`, `Managed Auth e identidad remota`, `Estado y protocolo del mercado`, `Preparación y verificación de transacciones`, `Pruebas SQL del mercado`, `Pruebas HTTP del mercado`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _253 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `API de control, seguridad y generación` be split into smaller, more focused modules?**
  _Cohesion score 0.05450861195542046 - nodes in this community are weakly interconnected._
- **Should `Interfaz de creador y mercado` be split into smaller, more focused modules?**
  _Cohesion score 0.05916305916305916 - nodes in this community are weakly interconnected._
- **Should `Backup, restore e infraestructura cloud` be split into smaller, more focused modules?**
  _Cohesion score 0.06625258799171843 - nodes in this community are weakly interconnected._
## Extraction audit and limitations

- Engine: installed graphifyy 0.9.55; Python 3.12.10. Differing installed skill versions were not replaced or downgraded.
- Structural extraction: tree-sitter AST; optional tree-sitter-sql 0.3.11 was added without changing graphify. Windows parallel dispatch uses a guarded entry point.
- Semantic extraction: host agent read/interpreted all 13 detected documents. Four collaboration slots were occupied; no extraction subagent or external model API was used. The explicit mappings and evidence selectors are in extract_semantics.py.
- Corpus: 105 files, approximately 57,278 words. No video/image/PDF parsing in this graph; Drive resources are citations in the inventory, not newly fetched binaries.
- Exclusions: .git, .local, .env*, .agents, .neon, node_modules, target, build outputs, legacy, keypairs and credential file patterns. Credential files were never read. CSS/Anchor.toml/Supabase config TOML are unclassified by this engine; workspace-only Cargo.toml produced no declaration node.
- Snapshot: working tree at 432ffc98217281b9feeae34d46b21d3e76c64955, with uncommitted implementation changes. This graph does not prove live integrations, CI, Mainnet authorization or acceptance gates.
- Health warning: 140 raw edges lack endpoint declarations in the indexed corpus; 84 edges coalesce in the simple undirected graph; 1 self-loop; 15 exact duplicates. Missing endpoint fields: 0. Detailed diagnostics: health.json.
- References without declarations can include external Rust types or SQL symbols. They must not be treated as verified local implementations. Dynamic API/SDK flows are represented semantically; inferred PF-to-code mappings are marked INFERRED, not test evidence.
- extraction.json retains every original AST/semantic edge and source location, including parallel evidence that graph.json aggregates. Source-based statements remain auditable.
- Semantic token usage is unavailable from this host integration. No measured zero-token claim or external extraction price is made.

## Frozen snapshot

This snapshot predates the newly approved platform wallet login. New auth and the last concurrent worker guard require a future update. Per-source extraction hashes and changed sources are retained in provenance.json; changed sources are not stamped current in manifest.json. No acceptance gate is closed by this graph. Query and regeneration instructions: README.md in this directory.
