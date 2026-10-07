"""Build a source deployment archive from the current tracked + untracked project files.

Run with Python 3 from the repository. Requires Git, excludes local secrets/runtimes,
and records every included file's SHA-256. Does not require committing unfinished work.
"""
from pathlib import Path
import hashlib
import json
import re
import subprocess
import zipfile

root = Path(__file__).resolve().parent.parent
names = subprocess.check_output(
    ["git", "-c", f"safe.directory={root.as_posix()}", "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    cwd=root,
).decode("utf-8").split("\0")
blocked_dirs = {".git", ".data", ".aws", ".codex", ".agents", ".superpowers", "node_modules", "dist", "build", ".react-router"}
secret = re.compile(rb"sk-(?:proj|svcacct)-[A-Za-z0-9_-]{30,}|-----BEGIN (?:OPENSSH |RSA |EC )?PRIVATE KEY-----|AKIA[A-Z0-9]{16}")
files = []
for name in sorted(set(filter(None, names))):
    relative = Path(name)
    if any(p in blocked_dirs for p in relative.parts):
        continue
    if relative.name.startswith(".env") and relative.name != ".env.example":
        continue
    file = root / relative
    if not file.exists():  # removed font assets are still listed until commit
        continue
    if file.is_symlink() or not file.is_file() or not file.resolve().is_relative_to(root):
        raise RuntimeError(f"Unsupported archive input: {name}")
    data = file.read_bytes()
    if secret.search(data):
        raise RuntimeError(f"Possible secret in {name}; archive not created")
    files.append((name.replace("\\", "/"), data))

manifest = {
    "product": "AI Signal JP",
    "baseCommit": "9848e936106db037d99a304887c36aad3fd0fad4",
    "scope": "local-preview-and-deployment-package; public launch pending",
    "files": [{"path": name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()} for name, data in files],
}
out = root / "dist"
out.mkdir(exist_ok=True)
archive = out / "ai-signal-jp-deploy-20261004.zip"
with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for name, data in files:
        info = zipfile.ZipInfo(f"ai-signal-jp/{name}", date_time=(2026, 10, 4, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = (0o100755 if name.endswith(".sh") else 0o100644) << 16
        z.writestr(info, data)
    z.writestr("ai-signal-jp/RELEASE-MANIFEST.json", json.dumps(manifest, ensure_ascii=False, indent=2))
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert "ai-signal-jp/.env" not in z.namelist()
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
(out / f"{archive.name}.sha256").write_text(f"{digest}  {archive.name}\n", encoding="utf-8")
(out / "RELEASE-MANIFEST.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({"archive": str(archive), "files": len(files), "bytes": archive.stat().st_size, "sha256": digest}))
