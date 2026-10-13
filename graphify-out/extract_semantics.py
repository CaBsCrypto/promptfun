"""Host-agent semantic extraction mappings, grounded in the detected documents.
No API/provider credentials are read. AST extraction is performed by graphify.
Mappings are semantic interpretation, not a replacement for the AST pass.
"""
from pathlib import Path
import json, re, hashlib
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/"graphify-out"
detection=json.loads((OUT/".graphify_detect.json").read_text(encoding="utf-8"))
ast=json.loads((OUT/".graphify_ast.json").read_text(encoding="utf-8"))
files=detection["files"]["document"]
texts={str(p):Path(p).read_text(encoding="utf-8") for p in files}
by_rel={Path(p).relative_to(ROOT).as_posix():p for p in files}
nodes,edges,hyperedges=[],[],[]
seen_nodes=set()
def norm(value): return re.sub(r"[^a-z0-9]+","_",value.lower()).strip("_")
def stem(rel): return norm(str(Path(rel).with_suffix("")).replace("\\","/"))
def loc(path,needle):
    lines=texts[path].splitlines()
    for index,line in enumerate(lines,1):
        if needle in line: return f"L{index}"
    raise ValueError(f"Evidence not found in {Path(path).name}: {needle}")
def node(path,entity,label,needle,file_type="concept",rationale=None,source_url=None):
    ident=stem(Path(path).relative_to(ROOT).as_posix())+"_"+norm(entity)
    if ident not in seen_nodes:
        item={"id":ident,"label":label,"file_type":file_type,"source_file":path,
              "source_location":loc(path,needle),"source_url":source_url,"captured_at":None,
              "author":None,"contributor":None}
        if rationale is not None: item["rationale"]=rationale
        nodes.append(item);seen_nodes.add(ident)
    return ident
def edge(source,target,relation,path,needle,confidence="EXTRACTED",score=1.0):
    edges.append({"source":source,"target":target,"relation":relation,
                  "confidence":confidence,"confidence_score":score,"source_file":path,
                  "source_location":loc(path,needle),"weight":1.0})
def code(rel):
    expected=stem(rel)
    candidates=[n for n in ast["nodes"] if n["source_file"]==rel and n["id"]==expected]
    if not candidates: raise ValueError("No AST module "+rel)
    return candidates[0]["id"]
docs={}
for rel,path in by_rel.items():
    first=texts[path].splitlines()[0]
    docs[rel]=node(path,"document",first.lstrip("# ").strip() or rel,first,"document")
# Explicit citations are parsed from the actual document, not inferred from memory.
url_nodes={}
for rel,path in by_rel.items():
    for line in texts[path].splitlines():
        for match in re.finditer(r"\[([^\]]+)\]\(([^)]+)\)",line):
            label,url=match.groups()
            if url.startswith(("https://","http://")):
                if url not in url_nodes:
                    ident=node(path,"citation_"+hashlib.sha256(url.encode()).hexdigest()[:16],label,line,
                               "document",source_url=url)
                    url_nodes[url]=ident
                edge(docs[rel],url_nodes[url],"cites",path,line)
            elif url.endswith(".md"):
                target=(Path(path).parent/url).resolve().relative_to(ROOT).as_posix()
                if target in docs: edge(docs[rel],docs[target],"references",path,line)
            # Non-corpus URLs and historical folders remain citations, not ingested code.
prd=by_rel["docs/PRD.md"]; trace=by_rel["docs/TRACEABILITY.md"]
R,D,PF,G={},{},{},{}
for line in texts[prd].splitlines():
    cells=[c.strip() for c in line.strip("|").split("|")]
    if cells and re.fullmatch(r"R\d{2}",cells[0]):
        key=cells[0]; R[key]=node(prd,key,key+" "+cells[1],line,"rationale",cells[2])
        edge(docs["docs/PRD.md"],R[key],"references",prd,line)
    elif cells and re.fullmatch(r"D\d{2}",cells[0]):
        key=cells[0]; D[key]=node(prd,key,key+" "+cells[1],line,"rationale",cells[2])
        edge(docs["docs/PRD.md"],D[key],"references",prd,line)
for line in texts[trace].splitlines():
    cells=[c.strip() for c in line.strip("|").split("|")]
    if cells and re.match(r"PF\d{2} ",cells[0]):
        key=cells[0][:4]; PF[key]=node(trace,key,cells[0],line,"rationale",cells[1]+"; "+cells[2])
        edge(docs["docs/TRACEABILITY.md"],PF[key],"references",trace,line)
    elif cells and re.match(r"G[1-4] ",cells[0]):
        key=cells[0][:2]; G[key]=node(trace,key,cells[0],line,"rationale",cells[1]+"; "+cells[2])
        edge(docs["docs/TRACEABILITY.md"],G[key],"references",trace,line)
for line in texts[trace].splitlines():
    cells=[c.strip() for c in line.strip("|").split("|")]
    if cells and re.match(r"R\d{2} ",cells[0]):
        key=cells[0][:3]
        for target in re.findall(r"PF\d{2}",cells[1]):
            edge(R[key],PF[target],"references",trace,line)
# Gate dependencies are explicit in the source table, including documented ranges.
gate_map={
"G1":list(R[k] for k in ["R01","R02","R03","R04","R05","R06","R07","R11","R12"])
     +[PF[k] for k in ["PF08","PF15","PF16"]]+[D[k] for k in ["D06","D07","D10","D11"]],
"G2":[G["G1"],R["R08"],R["R09"],PF["PF09"],PF["PF11"]],
"G3":[R["R10"]]+[D[k] for k in ["D01","D02","D03","D04","D09"]],
"G4":[G["G1"],G["G2"],G["G3"],D["D05"]]}
for gate,targets in gate_map.items():
    for target in targets: edge(G[gate],target,"references",trace,"| "+gate+" ")
# PF-to-source alignment is host-agent inference, not an asserted test result.
implementation={
"PF01":["src/App.tsx","src/features/discovery/Discover.tsx"],
"PF02":["server/control/auth.ts","server/control/security.ts","server/control/identity.ts"],
"PF03":["server/control/projects.ts","server/control/mutations.ts","src/features/creator/LegacyImport.tsx"],
"PF04":["server/control/projects.ts","server/control/mutations.ts","src/features/creator/Workbench.tsx"],
"PF05":["server/runtime/security.ts","server/runtime/sdk.ts","server/runtime/index.ts"],
"PF06":["server/control/jobs.ts","server/control/worker.ts"],
"PF07":["server/control/worker.ts"],
"PF08":["server/control/worker.ts","src/features/creator/Workbench.tsx"],
"PF09":["server/control/projects.ts","src/features/discovery/Discover.tsx"],
"PF10":["server/market/index.ts","server/market/reconcile.ts"],
"PF11":["server/control/projects.ts","src/features/discovery/Discover.tsx"],
"PF12":["server/market/index.ts","server/market/chain.ts","programs/promptfun-market/src/lib.rs","shared/curve.ts"],
"PF13":["scripts/backup.ts","server/control/worker.ts","server/market/reconcile.ts"],
"PF14":["server/runtime/storage.ts","server/runtime/index.ts"],
"PF15":["server/control/providers.ts","src/features/creator/ProviderPanel.tsx"],
"PF16":["server/runtime/index.ts","server/runtime/sdk.ts","server/control/identity.ts"]}
for pf,modules in implementation.items():
    for module in modules:
        edge(code(module),PF[pf],"implements",trace,"| "+pf+" ","INFERRED",0.85)
arch=by_rel["docs/ARCHITECTURE.md"]
concept_data={
"platform":("Navegador de plataforma","Creator[",None),
"control":("API de control","BFF[","Valida propietario, sesión y publicación; no ejecuta HTML generado."),
"control_db":("Neon control","BFF --> CDB",None),
"platform_auth":("Managed Neon Auth de plataforma","BFF --> CA",None),
"worker":("Worker durable","Worker[","Conserva intentos y estado incierto sin volver a enviar automáticamente."),
"openrouter":("OpenRouter propio gratuito elegible","Worker --> OR","Cuota y disponibilidad reales; sin fallback pagado automático."),
"runtime":("Runtime confiable separado","Creator --> Outer","Hostname distinto y sesión de app propia."),
"generated_frame":("Iframe generado de origen opaco","Outer --> Inner","El código del modelo no recibe cookies, claves o wallet."),
"apps_gateway":("Gateway de apps","Outer --> Gateway","Autoriza capacidades y aplica aislamiento por app y usuario."),
"apps_db":("Neon apps","Gateway --> ADB",None),
"apps_auth":("Managed Neon Auth de apps","Gateway --> AA",None),
"private_storage":("Neon S3 privado","Gateway --> S3","Publicar frontend no publica adjuntos o bases de datos."),
"devnet_rpc":("Solana Devnet RPC","BFF --> RPC","Acreditación sólo tras verificar ejecución finalizada."),
"wallet":("Wallet del participante","Wallet[","Firma financiera independiente de identidad de plataforma."),
"program":("Programa compartido Anchor 1.2.1","RPC --> Program",None),
"curve":("Curva acumulada exacta C(s)","C(s) =",None),
"capability_manifest":("Manifiesto de capacidades","manifiesto acotado","Colecciones y métodos permitidos; sin backend arbitrario."),
"immutable_version":("Versión candidata y versión publicada","published_version_id","La candidata no sustituye automáticamente al artefacto público."),
"publication_history":("Historial de publicaciones inmutable","historial de publicaciones","Metadata pública sin prompts o borradores."),
"durable_mutation":("Recibos durables de idempotencia","recibos durables de idempotencia","Crear y publicar persisten recibo y cambio en la misma transacción."),
"usage_receipt":("Recibos de consumo independientes","Los recibos de consumo",None),
"uncertain_job":("Inferencia incierta sin reenvío","uncertain","Un resultado ambiguo se conserva para conciliación."),
"identity_boundary":("Identidades separadas por plano e issuer","no se fusionan por email","No fusionar identidades por correo ni trasladar sesiones al HTML generado.")}
A={key:node(arch,key,label,needle,"rationale",why) for key,(label,needle,why) in concept_data.items()}
for key in A: edge(docs["docs/ARCHITECTURE.md"],A[key],"references",arch,concept_data[key][1])
flows=[
("platform","control","Creator["),("control","control_db","BFF --> CDB"),
("control","platform_auth","BFF --> CA"),("worker","control_db","Worker["),
("worker","openrouter","Worker --> OR"),("platform","runtime","Creator --> Outer"),
("runtime","generated_frame","Outer --> Inner"),("generated_frame","runtime","Inner -->"),
("runtime","apps_gateway","Outer --> Gateway"),("apps_gateway","apps_db","Gateway --> ADB"),
("apps_gateway","apps_auth","Gateway --> AA"),("apps_gateway","private_storage","Gateway --> S3"),
("control","devnet_rpc","BFF --> RPC"),("wallet","devnet_rpc","Wallet["),
("devnet_rpc","program","RPC --> Program")]
for source,target,needle in flows: edge(A[source],A[target],"references",arch,needle)
arch_modules={
"platform":["src/App.tsx"],"control":["server/control/index.ts"],
"worker":["server/control/worker.ts"],"openrouter":["server/control/providers.ts"],
"runtime":["server/runtime/index.ts"],"generated_frame":["server/runtime/security.ts"],
"apps_gateway":["server/runtime/index.ts","server/runtime/sdk.ts"],
"platform_auth":["server/control/identity.ts"],"apps_auth":["server/control/identity.ts"],
"private_storage":["server/runtime/storage.ts"],"devnet_rpc":["server/market/chain.ts"],
"wallet":["src/lib/wallet.ts"],"program":["programs/promptfun-market/src/lib.rs"],
"curve":["shared/curve.ts","programs/promptfun-market/src/math.rs"],
"capability_manifest":["server/control/security.ts","shared/contracts.ts"],
"immutable_version":["server/control/projects.ts"],"usage_receipt":["server/control/worker.ts"],
"publication_history":["server/control/projects.ts","supabase/control/migrations/202610130004_publications.sql"],
"durable_mutation":["server/control/mutations.ts"],
"uncertain_job":["server/control/worker.ts"],"identity_boundary":["server/control/identity.ts"]}
for key,modules in arch_modules.items():
    for module in modules: edge(code(module),A[key],"implements",arch,concept_data[key][1],"INFERRED",0.85)
edge(A["curve"],A["program"],"references",arch,"Compra(q)")
edge(A["worker"],A["uncertain_job"],"references",arch,"uncertain")
edge(A["worker"],A["usage_receipt"],"references",arch,"Los recibos de consumo")
edge(A["apps_gateway"],A["capability_manifest"],"references",arch,"Cada operación identifica")
edge(A["control"],A["immutable_version"],"references",arch,"published_version_id")
# UX concepts keep operational uncertainty separate from success.
ux=by_rel["docs/UX.md"]
U={}
ux_data=[
("open_app","Abrir app en pestaña runtime","**Abrir app** está disponible","La sesión entre sitios puede no persistir dentro del iframe.",["PF05","PF16"]),
("otp","Confirmación de correo OTP","código OTP recibido","Después de verificar, entrar con contraseña.",["PF02","PF16"]),
("private_import","Importación voluntaria privada","promptpump_pocs_v2","No ejecutar automáticamente HTML importado.",["PF03","PF05"]),
("publish_review","Revisión antes de publicar","Seleccionar y revisar una versión","La nueva generación no cambia la versión pública.",["PF04","PF09"]),
("pending_receipt","Recibo financiero pendiente","sessionStorage","Firma mínima por usuario/proyecto; no inventa saldo o éxito.",["PF10","PF12"]),
("exact_amounts","Importes enteros exactos","enteros exactos","No exponentes ni conversiones inseguras.",["PF12"]),
("feedback","Feedback moderado por versión","El feedback requiere sesión","Cuenta de plataforma independiente de app y wallet.",["PF11"])]
for key,label,needle,why,pfs in ux_data:
    U[key]=node(ux,key,label,needle,"rationale",why)
    edge(docs["docs/UX.md"],U[key],"references",ux,needle)
    for pf in pfs: edge(U[key],PF[pf],"conceptually_related_to",ux,needle,"INFERRED",0.85)
edge(U["open_app"],A["runtime"],"conceptually_related_to",ux,"**Abrir app** está disponible","INFERRED",0.95)
edge(U["pending_receipt"],A["uncertain_job"],"semantically_similar_to",ux,"Recuperar operación","INFERRED",0.75)
# Build/test definitions are not proof that a remote run passed.
ci=by_rel[".github/workflows/ci.yml"]; sol=by_rel[".github/workflows/solana.yml"]
ci_node=node(ci,"application_checks","CI de aplicación configurado","application:","rationale","Define lint, tests, build y navegador; no acredita un run verde.")
sol_node=node(sol,"sbf_build","Build y pruebas SBF en Linux","solana:","rationale","Anchor 1.2.1; artefacto real y pruebas requieren ejecución del workflow.")
edge(docs[".github/workflows/ci.yml"],ci_node,"references",ci,"application:")
edge(docs[".github/workflows/solana.yml"],sol_node,"references",sol,"solana:")
for label,needle in [("package_scripts_lint","bun run lint"),("package_scripts_test","bun run test"),("package_scripts_build","bun run build"),("package_scripts_test_e2e","bun run test:e2e")]:
    if any(n["id"]==label for n in ast["nodes"]): edge(ci_node,label,"references",ci,needle)
edge(ci_node,code("tests/e2e/smoke.spec.ts"),"references",ci,"bun run test:e2e","INFERRED",0.95)
edge(sol_node,code("scripts/solana-build-ci.sh"),"references",sol,"bash scripts/solana-build-ci.sh")
edge(sol_node,code("programs/market-tests/src/lib.rs"),"references",sol,"Build program and run genuine SBF tests","INFERRED",0.85)
val=by_rel["docs/VALIDATION.md"]; V={}
for line in texts[val].splitlines():
    if re.match(r"^\| \d+\.",line):
        cells=[c.strip() for c in line.strip("|").split("|")]
        key=norm(cells[0].split(". ",1)[1])
        V[key]=node(val,key,cells[0],line,"rationale",cells[1]+"; evidencia de recorrido pendiente")
        edge(docs["docs/VALIDATION.md"],V[key],"references",val,line)
# Specific pending gate evidence is aligned semantically to its requirement.
validation_requirements={
"neon_dedicado":["R01","R02","R12"],"identidad_de_plataforma":["R01"],
"openrouter_sin_saldo":["R03","R06","R07"],"preview_y_tareas":["R02","R04","R12"],
"aislamiento":["R01","R04","R12"],"publicacion":["R05","R08"],
"worker":["R03","R06"],"backup_restore":["R11","R12"],
"programa_devnet":["R10"],"mercado":["R10"],"aporte_recibos":["R09"],"ux":["R08"]}
for key,rids in validation_requirements.items():
    if key in V:
        needle=next(line for line in texts[val].splitlines() if "| "+nodes[next(i for i,n in enumerate(nodes) if n["id"]==V[key])]["label"]+" |" in line)
        for rid in rids: edge(V[key],R[rid],"conceptually_related_to",val,needle,"INFERRED",0.85)
edge(sol_node,G["G3"],"conceptually_related_to",sol,"solana:","INFERRED",0.85)
ops=by_rel["tools/solana-operations.md"]
upgrade=node(ops,"upgrade_authority","Autoridad de upgrade Devnet","autoridad de upgrade Devnet","rationale","El vault sin retiro no equivale a inmutabilidad permanente del programa.")
edge(upgrade,D["D02"],"conceptually_related_to",ops,"autoridad de upgrade Devnet","INFERRED",0.95)
for rel,needle in [("scripts/solana-sync.ts","solana-sync.ts"),("scripts/solana-devnet.ts","solana-devnet.ts"),("scripts/solana-initialize.ts","solana-initialize.ts")]:
    edge(docs["tools/solana-operations.md"],code(rel),"references",ops,needle)
index=by_rel["index.html"]
edge(docs["index.html"],code("src/main.tsx"),"references",index,"src/main.tsx")

# Execution roadmap and audiovisual reconciliation are explicit current documents.
road=by_rel.get("docs/ROADMAP.md"); H={}
if road:
    for line in texts[road].splitlines():
        cells=[c.strip() for c in line.strip("|").split("|")]
        if len(cells)>=4 and re.match(r"H0[1-6] ",cells[0]):
            key=cells[0][:3]
            H[key]=node(road,key,cells[0],line,"rationale","Implementado: "+cells[1]+"; Verificado: "+cells[2]+"; Pendiente: "+cells[3])
            edge(docs["docs/ROADMAP.md"],H[key],"references",road,line)
            for rid in set(re.findall(r"R\d{2}",line)):
                edge(H[key],R[rid],"references",road,line)
            for gate in set(re.findall(r"G[1-4]",line)):
                edge(H[key],G[gate],"references",road,line)
    roadmap_modules={
      "H01":["scripts/neon.ts","scripts/local.ts","scripts/migrate.ts"],
      "H02":["server/control/auth.ts","server/runtime/security.ts"],
      "H03":["server/control/providers.ts","server/control/worker.ts"],
      "H04":["server/runtime/index.ts","server/runtime/storage.ts","scripts/backup.ts"],
      "H05":["server/control/projects.ts","server/market/index.ts","programs/promptfun-market/src/lib.rs"],
      "H06":["scripts/verify-cloud.ts","tests/e2e/smoke.spec.ts"]}
    for key,modules in roadmap_modules.items():
        for module in modules: edge(code(module),H[key],"implements",road,"| "+key+" ","INFERRED",0.85)
recon=by_rel.get("docs/audiovisual/RECONCILIATION.v02.md")
if recon:
    publish_blocked=node(recon,"publish_ready_false","Medios v01 privados y publicación bloqueada","publish_ready=false","rationale","160 MP4 preservados; no full-playback QA ni URL pública validada.")
    support_scope=node(recon,"support_not_ai_budget","Aporte Devnet separado de IA","Presupuesto de inferencia a partir del apoyo","rationale","DEV03/FAN02 necesitan alineación textual con D04/D05; ningún SOL Devnet paga IA.")
    cap=node(recon,"curve_cap_87912","Cap de curva 87.912087913 SOL","C(cap) =","rationale","Cálculo entero; 800 mn tokens, sin graduación, no capitalización.")
    media_qa=node(recon,"sampled_not_full_qa","Muestras audiovisuales e integridad","No se reprodujeron los 160","rationale","CRC/hash y 16 fotogramas no equivalen a QA audiovisual completo.")
    for entity,needle in [(publish_blocked,"publish_ready=false"),(support_scope,"Presupuesto de inferencia a partir del apoyo"),(cap,"C(cap) ="),(media_qa,"No se reprodujeron los 160")]:
        edge(docs["docs/audiovisual/RECONCILIATION.v02.md"],entity,"references",recon,needle)
    edge(support_scope,D["D04"],"references",recon,"D01–D04/D09")
    edge(support_scope,D["D05"],"conceptually_related_to",recon,"No paga IA","INFERRED",0.95)
    edge(cap,A["curve"],"conceptually_related_to",recon,"C(cap) =","INFERRED",0.95)
    edge(cap,code("shared/curve.ts"),"references",recon,"shared/curve.ts")
    edge(publish_blocked,G["G1"],"conceptually_related_to",recon,"Lo que mantiene bloqueada","INFERRED",0.85)
    edge(publish_blocked,G["G3"],"conceptually_related_to",recon,"Lo que mantiene bloqueada","INFERRED",0.85)
    json_record=node(recon,"reconciliation_json","Registro estructurado audiovisual v02","reconciliation.v02.json","document","Referencia al JSON local; el motor AST no extrae declaraciones de este ledger de contenido.")
    edge(docs["docs/audiovisual/RECONCILIATION.v02.md"],json_record,"references",recon,"reconciliation.v02.json")
# Three flow groups with meaning beyond a single pairwise relationship.
hyperedges=[
{"id":"docs_prd_creator_acceptance","label":"Aceptación de creador privado","nodes":[G["G1"],R["R01"],R["R02"],R["R03"],R["R04"],R["R05"],R["R12"]],"relation":"form","confidence":"EXTRACTED","confidence_score":1.0,"source_file":trace},
{"id":"docs_architecture_identity_boundaries","label":"Identidades independientes","nodes":[A["platform_auth"],A["apps_auth"],A["openrouter"],A["wallet"],A["identity_boundary"]],"relation":"form","confidence":"INFERRED","confidence_score":0.95,"source_file":arch},
{"id":"docs_architecture_devnet_market","label":"Mercado verificable Devnet","nodes":[A["program"],A["curve"],A["devnet_rpc"],A["wallet"],G["G3"]],"relation":"participate_in","confidence":"INFERRED","confidence_score":0.85,"source_file":arch}]
# Retain distinct source locations but avoid exact duplicated extraction records.
dedup={}
for item in edges:
    k=(item["source"],item["target"],item["relation"],item["source_file"],item["source_location"])
    dedup[k]=item
result={"nodes":nodes,"edges":list(dedup.values()),"hyperedges":hyperedges,
        "input_tokens":0,"output_tokens":0,"token_accounting":"Host-agent token usage unavailable; zeros are placeholders, not measured usage.",
        "extraction_method":"Host LLM interpreted the detected documents; deterministic selectors persist source evidence. No external LLM calls.",
        "source_hashes":{p:hashlib.sha256(texts[p].encode()).hexdigest() for p in files}}
uncached_file=OUT/".graphify_uncached.txt"
if uncached_file.exists():
    allowed=set(uncached_file.read_text(encoding="utf-8").splitlines())
    result["nodes"]=[n for n in result["nodes"] if n["source_file"] in allowed]
    result["edges"]=[e for e in result["edges"] if e["source_file"] in allowed]
    result["hyperedges"]=[h for h in result["hyperedges"] if h["source_file"] in allowed]
(OUT/".graphify_chunk_01.json").write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
print(json.dumps({"semantic_nodes":len(result["nodes"]),"semantic_edges":len(result["edges"]),"hyperedges":len(result["hyperedges"]),"documents":len(files)}))
