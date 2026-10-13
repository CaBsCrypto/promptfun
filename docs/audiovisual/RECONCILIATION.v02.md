# Reconciliación audiovisual v02

Revisión: 13 de octubre de 2026. Se aplica el criterio de brand-review de claridad, consistencia y afirmaciones sustentadas al [PRD aprobado](../PRD.md). Es un registro de revisión de fuentes existentes: **no crea guiones, no modifica Drive, no cambia bytes v01 y no solicita renders**. [Registro estructurado](reconciliation.v02.json), [inventario de los 38 archivos](../DRIVE_INVENTORY.md).

**`publish_ready=false`** para los 160 MP4. `APP_ENTRY_URL=null`; no se añade URL o QR. Los originales de guiones, manifiestos, fuentes, ZIP y medios permanecen preservados. Una corrección registrada aquí no está aplicada al texto de un vídeo original.

## Fuentes y evidencia

Se consultaron [80 guiones para entrar a promptfun](https://docs.google.com/document/d/161sy783Sl9aGcchF9QoyQgnt7mDh-6twvy5PyqcUdu4/edit?usp=drivesdk), su anexo editorial, [promptfun_80_production_v01.csv](https://drive.google.com/file/d/19QHIdrNTkOVzS1H_KTj-io5wX0KW29y1/view?usp=drivesdk) y [promptfun_80_manifest_v01.json](https://drive.google.com/file/d/1R_U-a4oqLe-2K_vZBHY2FDRT0MhzTTc9/view?usp=drivesdk). Los controles y medios están referenciados por ID exacto en [Promptfun_160_manifest_control.json](https://drive.google.com/file/d/1e-IlPadXEb3orNn5iVIHPMy6aNZVSx-d/view?usp=drivesdk), [Promptfun_indice_Library_160_videos.json](https://drive.google.com/file/d/1bGdvM3wYNgNUcnF18hgqDR8tXdLxaA1u/view?usp=drivesdk), [Promptfun_fuentes_pipeline_v01.zip](https://drive.google.com/file/d/1QNp-IX2YQbXz9Eezzw6bGmSbtbxxkeF8/view?usp=drivesdk) y [Promptfun_controles_y_revision_visual.zip](https://drive.google.com/file/d/11gDjcrXNY755JCtH_Mzq85ju9vi-M5bj/view?usp=drivesdk).

El CSV conserva 80 IDs únicos y los nombres originales de las dos exportaciones por guion. El JSON v02 enumera esos 80 guiones, **160 nombres MP4** y **16 paquetes** con su ID/URL de Drive. No hay copia local de los manifiestos v01 ni se inventan hashes: el valor literal por archivo permanece en el manifiesto de control de Drive. El registro conserva el resultado de la revisión original: 160/160 tamaños y SHA-256 coincidentes.

Los 19 ZIP de UX/producción pasaron CRC de 296 miembros. Se inspeccionaron tres PNG conceptuales y 16 fotogramas a los 9 segundos, uno por lote, cubriendo cuatro audiencias y dos formatos. No se reprodujeron los 160 vídeos completos ni se revisaron todas sus pistas/transiciones/locuciones/frames. La integridad de archivos y la lectura de fuentes no acreditan QA audiovisual completo.

## Hallazgos y criterios de corrección

| Hallazgo | Ubicación/fuente | Severidad | Criterio para una revisión futura |
| --- | --- | --- | --- |
| Presupuesto de inferencia a partir del apoyo | DEV03: «Apoyo para un presupuesto de inferencia»; FAN02: «Presupuesto de inferencia, con reglas por definir» | Alta | En esta entrega el aporte es una transferencia Devnet separada a wallet del proyecto. No paga IA ni transfiere créditos; un presupuesto IA financiado está fuera del alcance. |
| Reglas del token descritas como abiertas | DEV07, FAN06, FAN11 y FAN19; utilidad/derechos/oferta/comisiones por definir | Media | D01–D04/D09 fijan reglas sólo para Devnet: apoyo negociable, 1 bn, 80/20, seis decimales, protocolo 0. No equity, ingresos o créditos IA; no presentar un mercado desplegado. |
| Creación sin capital y cuota gratuita | Anexo editorial: DEV06 y DEV15 | Alta si se elimina la condición | Conservar OAuth propio, elegibilidad, cuota y disponibilidad del proveedor. No prometer gratuidad ilimitada, inferencia garantizada o subsidio de promptfun. La demostración real con cuenta sin saldo sigue pendiente. |
| Aportes, consumo y saldo bajo un único recorrido | FAN09 y ajuste prioritario del anexo | Media | Mostrar conceptualmente registros independientes de proveedor, aporte y mercado. SOL Devnet no se contabiliza como presupuesto gastable de inferencia. |
| Backend como futuro ilimitado | DEV02 y anexo; extensiones opcionales EMP16 | Media | El alcance implementado es un backend acotado de tareas/archivos con Neon; Auth/CRUD de usuarios reales pendiente. No convertir ideas de fase 2 en servicio disponible. |
| Cifra de cap y graduación | Regla preventiva; **no se encontró 85 SOL** en hook/message/voiceover del CSV v01 | Media | C(cap) es 87.912087913 SOL, aproximadamente 87.912, para 800 mn de tokens vendidos; no 85 SOL. No es capitalización de mercado ni inicia DEX/graduación. |
| Mainnet, ingresos o retorno | Regla preventiva; el CSV no menciona Mainnet en los campos revisados y ya evita prometer rentabilidad | Alta si se introduce | Mantener Devnet y pruebas pendientes; el token no otorga ingresos o retorno garantizado. No añadir claims de dinero real, liquidez o finanzas verificadas. |

Los fragmentos de la segunda columna son texto original observado o referencias a su anexo. La última columna contiene restricciones técnicas de revisión, **no nuevo texto de campaña**. El JSON distingue IDs afectados de reglas preventivas sin ocurrencia encontrada. El anexo propone además ajustes opcionales DEV20 y EMP16; no están aplicados a medios.

## Número de curva y autoridades

El cálculo en enteros de [shared/curve.ts](../../shared/curve.ts) utiliza `Vₜ=1.073.000.000×10⁶`, `Vₛ=30×10⁹` y `s=800.000.000×10⁶`:

```text
C(s) = ceil(Vₛ × Vₜ / (Vₜ − s)) − Vₛ
C(cap) = 87.912.087.913 lamports = 87.912087913 SOL
```

La reserva de curva excluye rent y transferencias directas no solicitadas. Comisión de protocolo 0 no significa transacción sin coste. El tramo de 20 % no tiene instrucción de retiro en esta entrega, pero la autoridad de upgrade Devnet puede cambiar el programa: no anunciar bloqueo perpetuo o inmutabilidad permanente.

## Divergencias de revisión conservadas

El manifiesto original de 80 describe guiones y exportaciones planificadas; las fuentes posteriores contienen producción real con Chromium/Playwright/FFmpeg, frente a las propuestas anteriores de Remotion/Hyperframes. Se registra la diferencia sin reemplazar v01.

Los recursos UX usan navy/cian/ámbar; los vídeos tienen cuatro paletas por audiencia. Falta decidir su alineación para publicación. El estado de implementación cambió desde main b8692a1: hoy existen backend, jobs, versiones y código de mercado, con evidencia parcial de Neon y CI. Eso no convierte automáticamente las escenas conceptuales en capturas de funciones reales.

## Lo que mantiene bloqueada la publicación

Falta URL pública validada, cierre de los recorridos reales relevantes de [ROADMAP](../ROADMAP.md), revisión de afirmaciones por ID y revisión completa de los medios: texto/legibilidad en ambos formatos, transiciones, pistas, rótulos de estado y avisos durante toda la pieza. El CI SBF aprobado para el ID actual y el restore QA no sustituyen autenticación/inferencia ni despliegue/transacciones reales.

La reconciliación queda lista para revisión técnica. Los 160 originales siguen privados y pendientes de QA; este registro no autoriza publicar o re-renderizar.

