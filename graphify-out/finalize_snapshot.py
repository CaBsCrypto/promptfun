"""Persist graphify's manifest and an honest, portable audit of this snapshot."""
from pathlib import Path
from datetime import datetime, timezone
import json, hashlib, subprocess
from graphify.detect import save_manifest

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "graphify-out"
def read(name):
    return json.loads((OUT / name).read_text(encoding="utf-8"))
def write(name, value):
    (OUT / name).write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
def relative(path):
    return Path(path).resolve().relative_to(ROOT).as_posix()

detection = read(".graphify_detect.json")
extraction = read("extraction.json")
documents = set(extraction.get("document_files", []))
changed = []
source_hashes = {}
for source, expected in extraction.get("source_hashes", {}).items():
    path = Path(source)
    actual_bytes = path.read_text(encoding="utf-8").encode() if source in documents else path.read_bytes()
    source_hashes[relative(source)] = expected
    if hashlib.sha256(actual_bytes).hexdigest() != expected:
        changed.append(source)
corpus = [path for paths in detection["files"].values() for path in paths]
save_manifest(detection["files"], root=ROOT, scan_corpus=corpus)
# Do not stamp a concurrently changed source as fully indexed.
manifest = read("manifest.json")
for path in changed:
    if relative(path) in manifest:
        manifest[relative(path)]["ast_hash"] = ""
        manifest[relative(path)]["semantic_hash"] = ""
write("manifest.json", manifest)
analysis = read(".graphify_analysis.json")
write("analysis.json", analysis)
graph = read("graph.json")
timestamp = datetime.now(timezone.utc).isoformat()
provenance = {
    "schema_version": 1,
    "built_at": timestamp,
    "git_head": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
    "working_tree_included": True,
    "engine": "graphifyy 0.9.55",
    "python": "3.12.10",
    "sql_parser": "tree-sitter-sql 0.3.11",
    "structural_method": "tree-sitter AST, max_workers=4, guarded Windows entry point",
    "semantic_method": "Host LLM interpretation of all detected documents; reproducible source selectors in extract_semantics.py; no external LLM API calls",
    "files": detection["total_files"],
    "approximate_words": detection["total_words"],
    "categories": {category: len(paths) for category, paths in detection["files"].items() if paths},
    "nodes": len(graph["nodes"]),
    "edges": len(graph.get("links", graph.get("edges", []))),
    "communities": len(analysis["communities"]),
    "semantic_token_usage": "unknown",
    "exclusions_source": ".graphifyignore",
    "source_hashes": source_hashes,
    "changed_since_extraction": sorted(relative(path) for path in changed),
    "changed_during_ast_extraction": [relative(path) for path in extraction.get("changed_during_extraction", [])],
    "not_indexed_after_snapshot": ["new platform wallet-login/link/unlink work"],
    "detected_files": {category: [relative(path) for path in paths] for category, paths in detection["files"].items() if paths},
    "limitations": [
        "No new Drive media ingestion; inventory URLs are citations.",
        "JSON evidence/content ledgers have no structural declaration nodes from this engine.",
        "CSS and selected TOML configuration are unclassified; workspace Cargo.toml has no declaration.",
        "See health.json for dangling endpoints, self-loops, duplicate and aggregated edge evidence.",
        "Graph relations are navigation and traceability, not verification of live APIs or acceptance gates.",
        "OpenRouter and Devnet deployment explicitly deferred by the user on 2026-10-13."
    ]
}
write("provenance.json", provenance)
write("cost.json", {
    "runs": [{"date": timestamp, "input_tokens": None, "output_tokens": None,
              "files": detection["total_files"], "accounting": "host token usage unavailable", "external_llm_api_calls": 0}],
    "total_input_tokens": None, "total_output_tokens": None,
    "note": "Unknown is not zero. Zero counters in extraction.json are explicit engine placeholders."
})
report = OUT / "GRAPH_REPORT.md"
report.write_text(report.read_text(encoding="utf-8") + "\n## Frozen snapshot\n\n"
    + "This snapshot predates the newly approved platform wallet login. New auth and the last concurrent worker guard require a future update. "
    + "Per-source extraction hashes and changed sources are retained in provenance.json; changed sources are not stamped current in manifest.json. "
    + "No acceptance gate is closed by this graph. Query and regeneration instructions: README.md in this directory.\n", encoding="utf-8")
print(json.dumps({key: provenance[key] for key in ["files", "approximate_words", "nodes", "edges", "communities", "changed_since_extraction"]}, ensure_ascii=False))
