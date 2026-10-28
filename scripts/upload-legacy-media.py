#!/usr/bin/env python
"""Upload the cached legacy Supabase media to the public Hugging Face dataset.

The backup inventory maps every cached object to its canonical Supabase object
path. The two paths that differ only by letter case cannot coexist on Windows,
so this script uploads each cached file directly to ``legacy/<object path>``
instead of staging a local folder.

Usage:
    python scripts/upload-legacy-media.py
    python scripts/upload-legacy-media.py --dry-run
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from huggingface_hub import CommitOperationAdd, HfApi

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "exports" / "backups" / ".media-cache"
DEFAULT_INVENTORY = (
    ROOT / "exports" / "backups" / "20261028_192100" / "media-inventory.tsv"
)


def load_env() -> dict[str, str]:
    env: dict[str, str] = {}
    path = ROOT / ".env"
    if not path.exists():
        return env
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        env[name.strip()] = value.strip().strip('"').strip("'")
    return env


def read_inventory(path: Path) -> list[tuple[str, str, int]]:
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line:
            continue
        object_path, stored_path, size = line.split("\t")[:3]
        rows.append((object_path, stored_path, int(size)))
    return rows


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--inventory", type=Path, default=DEFAULT_INVENTORY)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    env = {**load_env(), **os.environ}
    token = env.get("HF_TOKEN")
    user = env.get("HF_USER")
    repo = env.get("HF_REPO")
    if not token or not user or not repo:
        print("HF_TOKEN, HF_USER, and HF_REPO are required", file=sys.stderr)
        return 2

    rows = read_inventory(args.inventory)
    operations = []
    total = 0
    for object_path, stored_path, size in rows:
        source = CACHE / stored_path
        if not source.exists():
            print(f"missing cached object: {source}", file=sys.stderr)
            return 1
        if source.stat().st_size != size:
            print(f"size mismatch for {source}", file=sys.stderr)
            return 1
        operations.append(
            CommitOperationAdd(
                path_in_repo=f"legacy/{object_path}", path_or_fileobj=str(source)
            )
        )
        total += size
    print(f"prepared {len(operations)} objects ({total / 1024 / 1024:.1f} MiB)")
    if args.dry_run:
        for operation in operations[:5]:
            print(f"  {operation.path_in_repo}")
        return 0

    api = HfApi(token=token)
    repo_id = f"{user}/{repo}"
    api.create_commit(
        repo_id=repo_id,
        repo_type="dataset",
        operations=operations,
        commit_message="Import legacy Supabase media under legacy/",
    )
    print(f"uploaded to {repo_id}/legacy")

    remote = {
        item.path: item.size
        for item in api.list_repo_tree(
            repo_id, repo_type="dataset", path_in_repo="legacy", recursive=True
        )
        if hasattr(item, "size")
    }
    missing = [
        object_path
        for object_path, _stored, _size in rows
        if f"legacy/{object_path}" not in remote
    ]
    bad_size = [
        (object_path, size, remote.get(f"legacy/{object_path}"))
        for object_path, _stored, size in rows
        if remote.get(f"legacy/{object_path}") not in (None, size)
    ]
    print(f"remote legacy files: {len(remote)}")
    if missing:
        print(f"missing after upload: {len(missing)}", file=sys.stderr)
        for object_path in missing[:20]:
            print(f"  {object_path}", file=sys.stderr)
    if bad_size:
        print(f"size mismatches: {len(bad_size)}", file=sys.stderr)
        for object_path, local, remote_size in bad_size[:20]:
            print(f"  {object_path}: local={local} remote={remote_size}", file=sys.stderr)
    return 1 if missing or bad_size else 0


if __name__ == "__main__":
    raise SystemExit(main())
