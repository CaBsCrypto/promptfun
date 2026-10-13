from pathlib import Path
import json, os, sys, inspect, hashlib
from graphify.detect import detect
from graphify.extract import extract
from graphify.cache import check_semantic_cache

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "graphify-out"
SPEC = Path("C:/Users/MGC/.agents/skills/graphify/references/extraction-spec.md")
OUT.mkdir(exist_ok=True)
(OUT / ".graphify_python").write_text(sys.executable, encoding="utf-8")
(OUT / ".graphify_root").write_text(str(ROOT), encoding="utf-8")

if __name__ == "__main__" and sys.argv[1] == "detect":
    result = detect(ROOT, follow_symlinks=False)
    (OUT / ".graphify_detect.json").write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    summary = {k: result.get(k) for k in ("total_files", "total_words", "warnings")}
    summary["categories"] = {k: len(v) for k, v in result.get("files", {}).items() if v}
    summary["sensitive_skipped_count"] = len(result.get("skipped_sensitive", []))
    summary["api_key_present"] = bool(os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY"))
    print(json.dumps(summary, ensure_ascii=False))
    print("DOCUMENTS")
    print("\n".join(result.get("files", {}).get("document", [])))
elif __name__ == "__main__" and sys.argv[1] == "ast":
    detection = json.loads((OUT / ".graphify_detect.json").read_text(encoding="utf-8"))
    paths = [Path(p) for p in detection.get("files", {}).get("code", [])]
    source_hashes={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}
    result = extract(paths, cache_root=ROOT, root=ROOT, max_workers=4)
    result["source_hashes"]=source_hashes
    result["changed_during_extraction"]=[str(p) for p in paths if hashlib.sha256(p.read_bytes()).hexdigest()!=source_hashes[str(p)]]
    (OUT / ".graphify_ast.json").write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({"ast_nodes": len(result["nodes"]), "ast_edges": len(result["edges"])}))
elif __name__ == "__main__" and sys.argv[1] == "cache":
    detection = json.loads((OUT / ".graphify_detect.json").read_text(encoding="utf-8"))
    paths = [p for cat in ("document", "paper", "image") for p in detection["files"].get(cat, [])]
    nodes, edges, hyperedges, uncached = check_semantic_cache(paths, root=ROOT, prompt_file=SPEC)
    cache_file = OUT / ".graphify_cached.json"
    if nodes or edges or hyperedges:
        cache_file.write_text(json.dumps({"nodes": nodes, "edges": edges, "hyperedges": hyperedges}, ensure_ascii=False), encoding="utf-8")
    else:
        cache_file.unlink(missing_ok=True)
    (OUT / ".graphify_uncached.txt").write_text("\n".join(uncached), encoding="utf-8")
    print(json.dumps({"cache_hits": len(paths)-len(uncached), "uncached": len(uncached)}))

elif __name__ == "__main__" and sys.argv[1] == "build":
    from graphify.build import build_from_json
    from graphify.cluster import cluster, score_all
    from graphify.analyze import god_nodes, surprising_connections, suggest_questions
    from graphify.report import generate
    from graphify.export import to_json
    from graphify.cache import save_semantic_cache
    from graphify.diagnostics import diagnose_extraction, format_diagnostic_report
    from datetime import datetime, timezone
    detection=json.loads((OUT/".graphify_detect.json").read_text(encoding="utf-8"))
    ast=json.loads((OUT/".graphify_ast.json").read_text(encoding="utf-8"))
    chunk=json.loads((OUT/".graphify_chunk_01.json").read_text(encoding="utf-8"))
    uncached=(OUT/".graphify_uncached.txt").read_text(encoding="utf-8").splitlines()
    cache_path=OUT/".graphify_cached.json"
    cached=json.loads(cache_path.read_text(encoding="utf-8")) if cache_path.exists() else {"nodes":[],"edges":[],"hyperedges":[]}
    semantic={"nodes":[],"edges":cached["edges"]+chunk["edges"],"hyperedges":cached.get("hyperedges",[])+chunk["hyperedges"],
              "input_tokens":0,"output_tokens":0,"token_accounting":chunk["token_accounting"]}
    seen=set()
    for n in cached["nodes"]+chunk["nodes"]:
        if n["id"] not in seen: semantic["nodes"].append(n);seen.add(n["id"])
    saved=save_semantic_cache(chunk["nodes"],chunk["edges"],chunk["hyperedges"],root=ROOT,allowed_source_files=uncached,prompt_file=SPEC)
    (OUT/".graphify_semantic.json").write_text(json.dumps(semantic,indent=2,ensure_ascii=False),encoding="utf-8")
    merged={"nodes":ast["nodes"].copy(),"edges":ast["edges"]+semantic["edges"],"hyperedges":semantic["hyperedges"],
            "input_tokens":0,"output_tokens":0,"token_accounting":chunk["token_accounting"],
            "source_hashes":ast.get("source_hashes",{}) | chunk.get("source_hashes",{}),
            "document_files":detection["files"]["document"],"changed_during_extraction":ast.get("changed_during_extraction",[])}
    seen={n["id"] for n in merged["nodes"]}
    for n in semantic["nodes"]:
        if n["id"] not in seen: merged["nodes"].append(n);seen.add(n["id"])
    # Full extraction persists as an audit artifact to retain distinct parallel-edge evidence.
    (OUT/".graphify_extract.json").write_text(json.dumps(merged,indent=2,ensure_ascii=False),encoding="utf-8")
    (OUT/"extraction.json").write_text(json.dumps(merged,indent=2,ensure_ascii=False),encoding="utf-8")
    G=build_from_json(merged,root=ROOT,directed=False)
    if G.number_of_nodes()==0: raise SystemExit("ERROR: Empty graph; no output overwritten.")
    communities=cluster(G);cohesion=score_all(G,communities);gods=god_nodes(G);surprises=surprising_connections(G,communities)
    labels={cid:"Community "+str(cid) for cid in communities}
    questions=suggest_questions(G,communities,labels)
    if not to_json(G,communities,str(OUT/"graph.json")): raise SystemExit("ERROR: refusing graph shrink")
    report=generate(G,communities,cohesion,labels,gods,surprises,detection,{"input":0,"output":0},str(ROOT),suggested_questions=questions)
    (OUT/"GRAPH_REPORT.md").write_text(report,encoding="utf-8")
    analysis={"communities":{str(k):v for k,v in communities.items()},"cohesion":{str(k):v for k,v in cohesion.items()},
              "gods":gods,"surprises":surprises,"questions":questions}
    (OUT/".graphify_analysis.json").write_text(json.dumps(analysis,indent=2,ensure_ascii=False),encoding="utf-8")
    health=diagnose_extraction(merged,directed=False,root=ROOT)
    (OUT/"health.json").write_text(json.dumps(health,indent=2,ensure_ascii=False),encoding="utf-8")
    print(format_diagnostic_report(health))
    print(json.dumps({"nodes":G.number_of_nodes(),"edges":G.number_of_edges(),"communities":len(communities),"semantic_cached_files":saved}))
    for cid,ids in communities.items():
        subset=G.subgraph(ids)
        leaders=sorted(ids,key=lambda n:subset.degree(n),reverse=True)[:8]
        print(json.dumps({"community":cid,"size":len(ids),"leaders":[{"id":n,"label":G.nodes[n].get("label"),"source_file":G.nodes[n].get("source_file")} for n in leaders]},ensure_ascii=False))

elif __name__ == "__main__" and sys.argv[1] == "label":
    from graphify.build import build_from_json
    from graphify.analyze import suggest_questions
    from graphify.report import generate
    import subprocess
    extraction=json.loads((OUT/".graphify_extract.json").read_text(encoding="utf-8"))
    detection=json.loads((OUT/".graphify_detect.json").read_text(encoding="utf-8"))
    analysis=json.loads((OUT/".graphify_analysis.json").read_text(encoding="utf-8"))
    health=json.loads((OUT/"health.json").read_text(encoding="utf-8"))
    G=build_from_json(extraction,root=ROOT,directed=False)
    communities={int(k):v for k,v in analysis["communities"].items()}
    cohesion={int(k):v for k,v in analysis["cohesion"].items()}
    labels={int(k):v for k,v in json.loads((OUT/".graphify_labels.json").read_text(encoding="utf-8")).items()}
    if set(labels)!=set(communities): raise ValueError("Community labels do not match analysis")
    questions=suggest_questions(G,communities,labels)
    commit=subprocess.check_output(["git","rev-parse","HEAD"],cwd=ROOT,text=True).strip()
    report=generate(G,communities,cohesion,labels,analysis["gods"],analysis["surprises"],detection,
                    {"input":0,"output":0},str(ROOT),suggested_questions=questions,built_at_commit=commit)
    report=report.replace("- Token cost: 0 input · 0 output","- Token cost: unknown for host-agent semantic extraction; no external LLM API calls. Zero counters in extraction are placeholders, not measured usage.")
    audit=f"""
## Extraction audit and limitations

- Engine: installed graphifyy 0.9.55; Python 3.12.10. Differing installed skill versions were not replaced or downgraded.
- Structural extraction: tree-sitter AST; optional tree-sitter-sql 0.3.11 was added without changing graphify. Windows parallel dispatch uses a guarded entry point.
- Semantic extraction: host agent read/interpreted all {len(detection['files']['document'])} detected documents. Four collaboration slots were occupied; no extraction subagent or external model API was used. The explicit mappings and evidence selectors are in extract_semantics.py.
- Corpus: {detection['total_files']} files, approximately {detection['total_words']:,} words. No video/image/PDF parsing in this graph; Drive resources are citations in the inventory, not newly fetched binaries.
- Exclusions: .git, .local, .env*, .agents, .neon, node_modules, target, build outputs, legacy, keypairs and credential file patterns. Credential files were never read. CSS/Anchor.toml/Supabase config TOML are unclassified by this engine; workspace-only Cargo.toml produced no declaration node.
- Snapshot: working tree at {commit}, with uncommitted implementation changes. This graph does not prove live integrations, CI, Mainnet authorization or acceptance gates.
- Health warning: {health['dangling_endpoint_edges']} raw edges lack endpoint declarations in the indexed corpus; {health['undirected_same_endpoint_collapsed_edges']} edges coalesce in the simple undirected graph; {health['self_loop_edges']} self-loop; {health['exact_duplicate_edges']} exact duplicates. Missing endpoint fields: {health['missing_endpoint_edges']}. Detailed diagnostics: health.json.
- References without declarations can include external Rust types or SQL symbols. They must not be treated as verified local implementations. Dynamic API/SDK flows are represented semantically; inferred PF-to-code mappings are marked INFERRED, not test evidence.
- extraction.json retains every original AST/semantic edge and source location, including parallel evidence that graph.json aggregates. Source-based statements remain auditable.
- Semantic token usage is unavailable from this host integration. No measured zero-token claim or external extraction price is made.
"""
    (OUT/"GRAPH_REPORT.md").write_text(report+audit,encoding="utf-8")
    analysis["questions"]=questions
    (OUT/".graphify_analysis.json").write_text(json.dumps(analysis,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps({"labeled_communities":len(labels),"questions":questions[:4],"gods":analysis["gods"][:5]},ensure_ascii=False))
