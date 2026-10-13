# Mercado promptfun en Solana Devnet

El programa compartido mantiene un mint SPL clásico con seis decimales por proyecto. Emite una sola vez 1.000.000.000 tokens: 800.000.000 en curva y 200.000.000 en un vault sin instrucción de retiro. Revoca mint authority, no configura freeze authority y cobra cero comisiones de protocolo. Hay costes de red y rent. La autoridad de upgrade Devnet puede cambiar el programa; el bloqueo no se anuncia como inmutabilidad permanente.

El PDA Market también mantiene los SOL de la curva. `reserve` excluye rent y transferencias directas no solicitadas. Comprar y vender aplican diferencias de C(s) con aritmética u128 comprobada. Alcanzar el cap bloquea compras; vender reabre capacidad. No hay graduación, migración a DEX, retiros de tesorería ni soporte mainnet. Aportes voluntarios usan transferencias separadas a la wallet vinculada del proyecto y no otorgan tokens ni créditos de IA.

## Construcción y pruebas

- `cargo test -p promptfun-market --lib --locked`: aritmética, límites y propiedades.
- `node --import tsx --test tests/market*.test.ts`: verificadores, API, PostgreSQL en memoria, cancelación RPC y ABI del loader.
- `bash scripts/solana-build-ci.sh` en CI Linux con Anchor 1.2.1: build SBF v1.57/arch v3, IDL y harness LiteSVM 0.13.1. Solo exporta `.so`, IDL y manifest SHA a `.local/solana-artifacts`. No necesita Docker Desktop local ni claves de despliegue en GitHub.
- `cargo test --manifest-path programs/market-tests/Cargo.toml --locked`: pruebas del binario SBF. Falla expresamente si falta `target/deploy/promptfun_market.so`; no sustituye bytecode por un mock.

Los registros financieros residen en el plano PostgreSQL de control, compatible con Neon cloud. El servidor no depende del SDK de Supabase ni concede acceso SQL directo a las apps generadas. El nombre histórico de la carpeta de migraciones se mantiene mientras se reorganiza el setup.

LiteSVM está aislado en otro workspace Cargo: su SDK fija solana-instruction 3.2.0, incompatible con la resolución de Anchor 1.2.1. Ambos lockfiles se versionan. No ejecutar los binarios de pruebas Windows dentro de Linux: el harness debe construirse allí de nuevo.

## Operación explícita con claves externas

1. El operador crea/selecciona las claves técnicas de programa, upgrade y registrar fuera del repositorio. No reutiliza la wallet financiera personal.
2. `bun scripts/solana-sync.ts RUTA_ABSOLUTA_EXTERNA_PROGRAM_KEYPAIR` sincroniza solamente el ID público en Anchor y Rust. Reconstruir SBF después.
3. Descargar los artefactos y comprobar el run y commit de CI. `bun scripts/solana-devnet.ts --program-keypair RUTA_EXTERNA_PROGRAMA --upgrade-keypair RUTA_EXTERNA_UPGRADE --artifact .local/solana-artifacts/promptfun_market.so` calcula rent y comprueba Devnet, saldo, claves distintas y SHA; no envía nada por defecto. Añadir `--submit` despliega explícitamente mediante el loader estándar y verifica bytecode y autoridad finalizados. El progreso público permite `--resume-buffer PUBKEY`; ninguna clave privada se copia a GitHub ni al repositorio.
4. Configurar `MARKET_PROGRAM_ID`, `SOLANA_RPC_URL` y `MARKET_REGISTRAR_KEY_PATH`. `bun scripts/solana-initialize.ts RUTA_EXTERNA_UPGRADE_KEYPAIR REGISTRAR_PUBKEY` prepara la inicialización; añadir `--submit` envía explícitamente la transacción técnica Devnet.
5. Confirmar creación de proyecto, compra, venta y aporte en Devnet con evidencias independientes. Una prueba local no acredita un despliegue público.

El servidor verifica genesis Devnet, firma de wallet vinculada, propiedad del proyecto, config/registrar, mints y vaults, hash exacto del mensaje preparado y ejecución finalizada. Guarda firmas únicas por red e índice, conserva pendientes y el worker recupera mensajes después de una caída. Nunca inventa saldo, recibos o éxito financiero.
