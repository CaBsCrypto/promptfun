# Grafo del proyecto

Snapshot del código y la documentación del 13 de octubre de 2026. Abrir `graph.html` permite explorar el grafo sin servidor. `provenance.json` identifica el corte, los hashes de fuente y cualquier cambio concurrente; la nueva autenticación de plataforma mediante wallet queda para la siguiente actualización.

`graph.json` contiene el grafo consultable. `extraction.json` conserva las aristas y ubicaciones originales, incluidas relaciones que el grafo simple agrega. `health.json` registra límites del extractor; `analysis.json` y `labels.json` contienen las comunidades reales. Los requisitos y sus relaciones con código son trazabilidad, no evidencia de servicios vivos. El consumo de tokens del agente host es desconocido, como registra `cost.json`.

Desde la raíz del repositorio, con graphifyy 0.9.55 instalado:

```powershell
graphify path docs_traceability_g1 server_runtime_security --undirected
graphify query 'G1 Creador privado R04 Preview aislado PF05 Runtime confiable' --budget 1200
graphify export html
```

La primera consulta devuelve G1 → H02 → `runtime/security.ts` en dos saltos, con el segundo vínculo marcado `INFERRED`. El grafo es deliberadamente no dirigido; las etiquetas de relación conservan el sentido conceptual. Consultar la ubicación de fuente antes de tomar una arista `INFERRED` como conclusión.

Para regenerar, use el Python del entorno instalado de graphify. En esta máquina es `C:/Users/MGC/.local/share/graphify-runtime/Scripts/python.exe`; no es un requisito portable del proyecto. `build_graph.py` ejecuta fases `detect`, `ast`, `cache`, `build`, `label`; entre `cache` y `build`, ejecutar `extract_semantics.py`. Después de `build`, revisar los líderes reales de cada comunidad y actualizar `labels.json`, copiarlo a `.graphify_labels.json` y ejecutar `label`. Exportar HTML y ejecutar `finalize_snapshot.py` al terminar. No copiar etiquetas antiguas a IDs nuevos sin revisar las comunidades.

El extractor semántico contiene la interpretación y los selectores de evidencia de este corte. Un nuevo documento o cambio de alcance exige lectura e interpretación antes de regenerar; ejecutar un script por sí solo no reemplaza ese trabajo. `.graphifyignore` excluye credenciales, `.local`, dependencias, compilaciones y el prototipo legado. Cache y temporales `.graphify*` quedan fuera de Git.
