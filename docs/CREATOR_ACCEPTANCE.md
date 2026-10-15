# Aceptación del recorrido del creador

Actualizado el 15 de octubre de 2026. Esta fase mejora la recuperación del trabajo y prepara una app útil antes de la beta online. Las firmas personales y OpenRouter deben completarlos sus titulares. Las fixtures y firmas técnicas no acreditan ese recorrido. Devnet sigue aplazado.

## Antes de la prueba personal

- Arrancar API/runtime y worker con las variables privadas del entorno Neon dedicado y la migración control 006 aplicada. Nunca incluir `.env`, cookies, firmas reutilizables o claves en evidencias/PRs.
- Abrir [promptfun local](http://localhost:3000) en el navegador que tenga Phantom, o entrar por correo y verificar el OTP. Si ya existe una cuenta por correo y se quiere el mismo propietario, usar **Vincular acceso con wallet** desde ella; entrar con una wallet distinta no fusiona cuentas.
- Completar personalmente **Conectar OpenRouter** y volver a la app. Mantener saldo cero y modelos gratuitos elegibles. Si no hay cuota/modelo elegible o el proveedor no confirma la cuota, registrar el impedimento y pedir decisión; no cambiar automáticamente a pago ni comprar créditos.

## Recorrido y evidencia requerida

| Paso | Resultado esperado |
| --- | --- |
| Proyecto/borrador | Crear «Mis tareas», usar el ejemplo o escribir una petición propia, elegir modelo y esperar «Guardado». Recuperar texto exacto, modelo, base y propietario tras recargar, reiniciar procesos y volver a entrar. |
| Dos pestañas | Abrir el mismo proyecto en ambas. Guardar A y editar B desde la revisión anterior: B conserva su texto y muestra conflicto. Comprobar ambas elecciones; una tercera edición concurrente debe volver a rechazar el guardado obsoleto. |
| Fallo de red | Interrumpir la conexión y editar. No mostrar «Guardado», conservar el texto, impedir cambio de proyecto/logout/redirección hasta guardar; recuperar conexión y reintentar. Cerrar forzadamente descartando el aviso no garantiza conservar cambios no confirmados. |
| Generación real | Enviar la petición con OpenRouter propio sin saldo. Conservar job, versión y recibo/estado real del consumo; no registrar éxito por un HTTP aceptado o un modelo listado. |
| Usuarios y tareas | Abrir **Abrir app**, crear una identidad independiente, crear/editar/completar/borrar tareas y subir/descargar/borrar adjuntos. Volver a entrar y comprobar que datos y bytes persisten. |
| Aislamiento | Dos creadores y dos apps; dos usuarios de app. Modificar IDs/cookies/sesiones no permite leer ni mutar proyectos, borradores, tareas o archivos ajenos. |
| Iteración | Seleccionar una versión existente y pedir una mejora concreta. La candidata conserva el padre y los datos anteriores; la publicación actual no cambia. Sin cambios, cuota agotada, revocación, salida inválida y timeout conservan la última versión. |
| Incertidumbre | «Requiere revisión» detiene la espera automática; **Comprobar estado** sólo hace lectura. Consumo pending/unknown nunca aparece como coste cero. Una petición equivalente incierta sigue bloqueada incluso con otro modelo/clave. |
| Publicación | Probar la candidata, marcar revisión y publicarla. Otra persona ve sólo esa versión y puede enviar feedback moderado; no recibe borradores/prompts ni acceso a datos privados. |
| Recuperación | Respaldar SQL y objetos y restaurar en bases/bucket aislados vacíos. Comparar borrador/revisión, versiones/hashes, tareas y bytes/SHA de archivos. Recuperar identidad es un paso independiente: no se restauran sesiones, Managed Auth ni conexiones OpenRouter activas. |

## Registro y cierre

Registrar fecha, commit, versiones de herramientas, comandos y resultados saneados en `docs/evidence/`. Mantener aparte pruebas automatizadas, cloud QA técnica y recorrido personal. Los resultados actuales y límites están en [VALIDATION.md](VALIDATION.md).

G1 sólo cierra con evidencia real de generación gratuita, usuarios/datos/adjuntos, iteración, publicación y recuperación. Hasta entonces no se anuncia beta aceptada. La beta online pequeña es la fase posterior; Mainnet y despliegue Devnet no forman parte de este cierre de código.
