# UX — flujos y estados de la entrega

Revisión: 13 de octubre de 2026. Base: [diseño UX y pantallas original](https://docs.google.com/document/d/1bmE-DnOmMUABdnf6NNKR44vkptTO9S4sbzZ7aSvhCm8/edit?usp=drivesdk), recursos conceptuales y decisiones de [PRD](PRD.md). La interfaz normal usa datos de API; las pantallas anteriores se conservan en `legacy/prototype`.

## Dirección visual

La interfaz usa navy `#12283a`, cian `#33c6d8`, ámbar `#ffca75` y blanco `#eef8fb`. La tipografía del sistema evita una dependencia de fuentes externas. El énfasis principal recae en el editor, el estado del trabajo y la versión que se está revisando. Las tarjetas no contienen saldos, volumen, usuarios o tendencias de muestra.

La navegación ofrece **Crear** y **Descubrir**. El mercado se carga al abrirlo, sin requerir wallet para entrar al producto. Estado, error, carga y vacío tienen textos propios. Los controles incluyen etiquetas, foco visible y navegación por teclado; la estructura contempla 360 px y movimiento reducido. Las verificaciones visuales y de accesibilidad con servicios reales siguen pendientes; no se afirma una auditoría WCAG completa.

## Crear y conservar un proyecto

Actualización del 15 de octubre: el editor distingue «Cargando borrador», «Cambios sin guardar», «Guardando», «Guardado», «Error al guardar» y «Conflicto entre revisiones». «Guardado» necesita respuesta del servidor y abarca prompt, modelo y versión base. Cambiar proyecto, ir a Descubrir, cerrar sesión o conectar OpenRouter guarda antes de salir; si falla, el texto permanece en el proyecto. Recargar recupera su selección desde la URL, sin guardar el prompt en ella. Un cierre con cambios pendientes utiliza la advertencia nativa del navegador; descartar esa advertencia puede perder los cambios no confirmados.

Un conflicto muestra la copia del servidor junto al texto local intacto. **Usar revisión del servidor** sustituye el editor; **Guardar mi borrador sobre esta revisión** envía conscientemente la copia local usando la revisión observada. Si otra pestaña vuelve a editar, se presenta otro conflicto. Un fallo de lectura nunca inicia un guardado vacío.

La guía inicial muestra cuenta, conexión OpenRouter y elección gratuita. El ejemplo de gestor de tareas rellena la petición cuando el editor está vacío; necesita una generación real para producir una app. El catálogo disponible no promete cuota: ambas se comprueban al ejecutar.

1. Entrar con **Phantom**, **Solflare** o correo. La wallet firma un mensaje de acceso sin transacción ni SOL; la primera firma crea una cuenta si no existe. Con email/contraseña, introducir el código OTP recibido cuando falte confirmar el correo y después entrar normalmente. Google no está configurado.
2. Crear un proyecto con título y descripción. Su estado inicial es privado.
3. Conectar la cuenta propia de OpenRouter mediante redirección; consultar los modelos gratuitos elegibles y su disponibilidad real.
4. Escribir la petición y enviar un job. El editor muestra el estado guardado, sin una barra de progreso ficticia.
5. Revisar la versión resultante y sus cambios. Para iterar, seleccionar una versión base y explicar el cambio; el backend recibe su fuente y manifiesto.
6. Abrir el preview y usar **Abrir app** para una pestaña del runtime. Crear la cuenta propia de esa app, guardar tareas y adjuntos, y comprobarlos tras recargar.
7. Seleccionar y revisar una versión antes de publicarla explícitamente. Una generación posterior conserva la versión pública hasta una nueva publicación.

| Estado de generación | Tratamiento visible |
| --- | --- |
| queued / running / validating | Estado real y posibilidad de volver al proyecto; lectura del job persistente |
| completed | Versión candidata para revisar y comparar |
| no_changes | El resultado coincide con la base; se conserva el historial sin inventar una mejora |
| failed | Motivo recibido; no se genera una app ficticia |
| uncertain | «Requiere revisión», sin polling automático; **Comprobar estado** sólo consulta el trabajo; permite editar/guardar sin repetir el intento equivalente |
| Uso pending / unknown | Tokens/coste pendientes o desconocidos, nunca rellenados con ceros supuestos |
| Proveedor revocado, agotado o no disponible | Error y reconexión/reintento consciente; no se activa un pago alternativo |

La decisión del 13 de octubre incorpora login opcional con wallet. **Vincular acceso con wallet** permite añadir Phantom/Solflare a una cuenta con correo, mediante una nueva firma y sesión/CSRF actuales. El panel permite desvincular sólo cuando conserva acceso por correo; no elimina el último método de una cuenta wallet-only. Una cuenta sin correo muestra su dirección abreviada, sin email ficticio. El login de usuarios de apps generadas continúa separado y usa correo/OTP. Faltan pruebas con extensiones reales, cambio de cuenta y rechazo de firma.

## Preview y sesión de la app

El preview privado se obtiene con un token de corta duración del propietario. El frontend de plataforma integra un documento confiable de runtime en un hostname distinto; éste aloja el HTML generado en un iframe interior de origen opaco. La UI de autenticación pertenece al runtime confiable, no al HTML del modelo.

**Abrir app** está disponible junto al preview. En desarrollo, `localhost` y `127.0.0.1` pertenecen a sitios distintos: la sesión del runtime puede no persistir dentro del iframe por las reglas de cookies del navegador. La pestaña superior del runtime permite iniciar sesión y guardar datos de la app. Esto no debe ocultarse con una sesión local simulada.

Publicar hace accesible el artefacto frontend de esa versión; no convierte en pública la base de datos de sus usuarios. No se muestran prompts privados ni claves en la vista pública. El aislamiento permite código generado que sigue teniendo riesgos funcionales: revisar una app antes de publicar permanece como paso explícito.

## Descubrir y aportar feedback

La lista pública contiene únicamente proyectos con versión publicada. Un resultado vacío indica que no hay proyectos publicados; un fallo de API se presenta como error. La persona abre la versión pública, puede probarla sin wallet y usa la sesión propia de la app si desea guardar datos.

El feedback requiere sesión de plataforma, se asocia a una versión concreta y queda pendiente hasta que el creador lo aprueba. La vista pública muestra los aprobados y un historial de publicaciones con fecha, versión y changelog; la API también ofrece el hash público. No expone prompts ni versiones privadas. No se confunden las cuentas de plataforma y de app, ni una aportación de feedback con una firma financiera.

## Mercado y aportes Devnet

El panel muestra Devnet de forma persistente y separa estas acciones:

| Acción | Secuencia y significado |
| --- | --- |
| Habilitar mercado | Creador conecta wallet, verifica un nonce y firma la transacción preparada; el estado preparado no se presenta como mercado activo |
| Comprar / vender | Introducir cantidad exacta, solicitar cotización, revisar SOL y expiración, firmar y enviar; si cambia el precio se necesita una cotización nueva |
| Aportar SOL | Crear intención separada con importe, receptor y referencia; no compra tokens ni acredita IA |
| Recuperar operación | Conservar firma conocida y consultar al servidor; pending no se presenta como confirmada y bloquea una operación duplicada |

Conectar una wallet en el panel financiero no inicia sesión de plataforma: el acceso exige el mensaje específico de login y el registro de proyecto exige su nonce propio. El saldo proviene de Devnet RPC; si no puede leerse se muestra desconocido. La UI permite Phantom/Solflare y presenta rechazo de firma, saldo insuficiente, programa sin configurar, cotización vencida y confirmación pendiente con errores reales.

Los importes se convierten mediante enteros exactos; no se aceptan exponentes, decimales fuera de precisión ni conversiones inseguras. Tras firmar se conserva un recibo mínimo en `sessionStorage`, limitado a usuario/proyecto, para recuperar un resultado incierto. No contiene claves ni un saldo calculado por el cliente.

## Importar el prototipo anterior

La importación de `promptpump_pocs_v2` es voluntaria y filtra los campos permitidos. Guarda versiones privadas y no ejecuta automáticamente HTML importado. La persona elige **Abrir preview para revisar**, después decide si publicarlo. El almacenamiento anterior no vuelve a ser la fuente normal de proyectos.

## Verificación pendiente

El acceso **Entrar en demo** se ofrece sólo cuando el servidor confirma disponibilidad local. Abre proyectos/borradores privados con una identidad del navegador, muestra un aviso persistente y permite probar autosave, recarga y reentrada. IA, publicación, feedback público y controles de wallet/mercado están desactivados también en el servidor; el preview explica su alcance. No se rellenan versiones ni consumo ficticios. [Detalle y límites de recuperación](LOCAL_DEMO.md).

Los tres PNG conceptuales y 16 fotogramas de marketing se inspeccionaron como referencias, no como capturas de la interfaz implementada. Se dispone de comprobaciones de compilación y pruebas declaradas en [VALIDATION.md](VALIDATION.md); falta ejecutar una revisión visual del navegador, el teclado en todos los recorridos y el flujo completo con Neon, OpenRouter y Devnet.

