#!/usr/bin/env python
"""Upload the cached legacy Supabase media to the public Hugging Face dataset.

The backup inventory maps every cached object to its canonical Supabase object
path. The two paths that differ only by letter case cannot coexist on Windows,
so this script uploads each cached file directly to ``legacy/<object path>``
instead of staging a local folder.

Uploads are committed in small batches, and an interrupted run resumes by
listing the remote ``legacy/`` tree and skipping files that already exist with
the expected size.

Usage:
    python scripts/upload-legacy-media.py
    python scripts/upload-legacy-media.py --dry-run
    python scripts/upload-legacy-media.py --batch-size 10 --batch-bytes 25000000
"""
from __future__ import annotations

import argparse
import atexit
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# Keep tqdm from writing hundreds of megabytes when stdout is redirected.
os.environ.setdefault("HF_HUB_DISABLE_PROGRESS_BARS", "1")

from huggingface_hub import CommitOperationAdd, HfApi
from huggingface_hub.errors import EntryNotFoundError, HfHubHTTPError, RepositoryNotFoundError

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "exports" / "backups" / ".media-cache"
DEFAULT_INVENTORY = (
    ROOT / "exports" / "backups" / "20261028_192100" / "media-inventory.tsv"
)
OUT_DIR = ROOT / "exports" / "media-migration"
DEFAULT_LOG = OUT_DIR / "upload-batched.log"
DEFAULT_STATUS = OUT_DIR / "upload-status.json"
LOCK = OUT_DIR / "upload.lock"


def acquire_lock() -> bool:
    """Create an exclusive lock file so two uploaders cannot run at once."""
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for _attempt in range(2):
        try:
            handle = os.open(LOCK, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            os.write(handle, str(os.getpid()).encode("ascii"))
            os.close(handle)
            atexit.register(release_lock)
            return True
        except FileExistsError:
            try:
                pid = int(LOCK.read_text(encoding="utf-8").strip())
            except (OSError, ValueError):
                pid = None
            if pid is not None:
                try:
                    os.kill(pid, 0)
                    return False
                except OSError:
                    pass
            try:
                LOCK.unlink()
            except FileNotFoundError:
                pass
    return False


def release_lock() -> None:
    try:
        if int(LOCK.read_text(encoding="utf-8").strip()) == os.getpid():
            LOCK.unlink()
    except (OSError, ValueError):
        pass


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def human_bytes(value: float) -> str:
    value = float(value)
    for unit in ("B", "KiB", "MiB", "GiB"):
        if value < 1024 or unit == "GiB":
            return f"{value:.1f}{unit}"
        value /= 1024
    return f"{value:.1f}GiB"


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


class Logger:
    def __init__(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self.handle = path.open("a", encoding="utf-8")

    def log(self, message: str) -> None:
        line = f"{now()} {message}"
        print(line, flush=True)
        self.handle.write(line + "\n")
        self.handle.flush()

    def close(self) -> None:
        self.handle.close()


def remote_legacy(api: HfApi, repo_id: str) -> dict[str, int]:
    try:
        tree = api.list_repo_tree(
            repo_id, repo_type="dataset", path_in_repo="legacy", recursive=True
        )
        return {
            item.path: int(item.size)
            for item in tree
            if getattr(item, "size", None) is not None
        }
    except (EntryNotFoundError, RepositoryNotFoundError):
        return {}
    except HfHubHTTPError as error:
        response = getattr(error, "response", None)
        if response is not None and response.status_code == 404:
            return {}
        raise


def make_batches(
    rows: list[tuple[str, str, int]], max_files: int, max_bytes: int
):
    batch: list[tuple[str, str, int]] = []
    batch_bytes = 0
    for row in rows:
        size = row[2]
        if batch and (len(batch) >= max_files or batch_bytes + size > max_bytes):
            yield batch
            batch = []
            batch_bytes = 0
        batch.append(row)
        batch_bytes += size
    if batch:
        yield batch


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--inventory", type=Path, default=DEFAULT_INVENTORY)
    parser.add_argument("--batch-size", type=int, default=20)
    parser.add_argument("--batch-bytes", type=int, default=50 * 1024 * 1024)
    parser.add_argument("--num-threads", type=int, default=3)
    parser.add_argument("--retries", type=int, default=3)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--log", type=Path, default=DEFAULT_LOG)
    parser.add_argument("--status", type=Path, default=DEFAULT_STATUS)
    args = parser.parse_args()

    env = {**load_env(), **os.environ}
    token = env.get("HF_TOKEN")
    user = env.get("HF_USER")
    repo = env.get("HF_REPO")
    if not token or not user or not repo:
        print("HF_TOKEN, HF_USER, and HF_REPO are required", file=sys.stderr)
        return 2

    rows = read_inventory(args.inventory)
    total = 0
    for object_path, stored_path, size in rows:
        source = CACHE / stored_path
        if not source.exists():
            print(f"missing cached object: {source}", file=sys.stderr)
            return 1
        if source.stat().st_size != size:
            print(f"size mismatch for {source}", file=sys.stderr)
            return 1
        total += size

    if not args.dry_run and not acquire_lock():
        print(
            f"another uploader is already running (lock: {LOCK}); exiting",
            file=sys.stderr,
        )
        return 3

    repo_id = f"{user}/{repo}"
    logger = Logger(args.log)
    status = {
        "startedAt": now(),
        "updatedAt": now(),
        "repo": repo_id,
        "inventory": str(args.inventory),
        "totalFiles": len(rows),
        "totalBytes": total,
        "batchSize": args.batch_size,
        "batchBytes": args.batch_bytes,
        "force": args.force,
        "remoteFiles": 0,
        "remoteBytes": 0,
        "pendingFiles": 0,
        "pendingBytes": 0,
        "completedFiles": 0,
        "completedBytes": 0,
        "batches": 0,
        "lastCommit": None,
        "error": None,
        "verified": None,
    }

    def write_status() -> None:
        status["updatedAt"] = now()
        args.status.parent.mkdir(parents=True, exist_ok=True)
        args.status.write_text(
            json.dumps(status, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )

    logger.log(
        f"inventory: {len(rows)} objects ({human_bytes(total)}); "
        f"batch={args.batch_size} files/{human_bytes(args.batch_bytes)}; "
        f"threads={args.num_threads}; force={args.force}"
    )
    write_status()

    api = HfApi(token=token)
    remote = remote_legacy(api, repo_id)
    status["remoteFiles"] = len(remote)
    status["remoteBytes"] = sum(remote.values())
    logger.log(
        f"remote legacy/: {len(remote)} files ({human_bytes(sum(remote.values()))})"
    )

    pending: list[tuple[str, str, int]] = []
    for object_path, stored_path, size in rows:
        remote_path = f"legacy/{object_path}"
        if args.force or remote.get(remote_path) != size:
            pending.append((object_path, stored_path, size))
    pending.sort(key=lambda row: (row[2], row[0]))
    status["pendingFiles"] = len(pending)
    status["pendingBytes"] = sum(row[2] for row in pending)
    write_status()
    logger.log(
        f"pending: {len(pending)} files ({human_bytes(sum(row[2] for row in pending))})"
    )

    if not pending:
        logger.log("nothing to upload; all remote sizes match")
    else:
        batches = list(make_batches(pending, args.batch_size, args.batch_bytes))
        logger.log(f"batches: {len(batches)}")
        if args.dry_run:
            for index, batch in enumerate(batches, start=1):
                logger.log(
                    f"DRY RUN batch {index}/{len(batches)}: {len(batch)} files "
                    f"({human_bytes(sum(row[2] for row in batch))})"
                )
            logger.close()
            return 0

        started = time.monotonic()
        done_bytes = 0
        for index, batch in enumerate(batches, start=1):
            batch_bytes = sum(row[2] for row in batch)
            logger.log(
                f"batch {index}/{len(batches)}: {len(batch)} files "
                f"({human_bytes(batch_bytes)})"
            )
            operations = [
                CommitOperationAdd(
                    path_in_repo=f"legacy/{object_path}",
                    path_or_fileobj=str(CACHE / stored_path),
                )
                for object_path, stored_path, _size in batch
            ]
            commit = None
            for attempt in range(1, args.retries + 1):
                try:
                    commit = api.create_commit(
                        repo_id=repo_id,
                        repo_type="dataset",
                        operations=operations,
                        commit_message=(
                            f"Import legacy Supabase media batch {index}/{len(batches)}"
                        ),
                        num_threads=args.num_threads,
                    )
                    break
                except Exception as error:  # noqa: BLE001 - retry all provider errors
                    logger.log(
                        f"batch {index} attempt {attempt}/{args.retries} failed: "
                        f"{type(error).__name__}: {error}"
                    )
                    if attempt == args.retries:
                        status["error"] = f"{type(error).__name__}: {error}"
                        write_status()
                        logger.log("giving up; rerun the same command to resume")
                        logger.close()
                        return 1
                    time.sleep(5 * attempt)

            status["completedFiles"] += len(batch)
            status["completedBytes"] += batch_bytes
            status["batches"] = index
            status["lastCommit"] = getattr(commit, "oid", None)
            write_status()
            done_bytes += batch_bytes
            elapsed = max(time.monotonic() - started, 1)
            rate = done_bytes / elapsed
            remaining = status["pendingBytes"] - done_bytes
            eta = remaining / rate if rate > 0 else 0
            logger.log(
                f"batch {index}/{len(batches)} committed: "
                f"{status['completedFiles']}/{len(pending)} files, "
                f"{human_bytes(done_bytes)}/{human_bytes(status['pendingBytes'])}, "
                f"{human_bytes(rate)}/s, eta {eta / 60:.0f}m"
            )

    logger.log("verifying remote tree")
    remote = remote_legacy(api, repo_id)
    missing = []
    bad_size = []
    for object_path, _stored_path, size in rows:
        remote_path = f"legacy/{object_path}"
        if remote_path not in remote:
            missing.append(object_path)
        elif remote[remote_path] != size:
            bad_size.append((object_path, size, remote[remote_path]))
    status["verified"] = not missing and not bad_size
    status["remoteFiles"] = len(remote)
    status["remoteBytes"] = sum(remote.values())
    write_status()
    logger.log(f"remote legacy/: {len(remote)} files ({human_bytes(sum(remote.values()))})")
    if missing:
        logger.log(f"missing after upload: {len(missing)}")
        for object_path in missing[:20]:
            logger.log(f"  MISSING {object_path}")
    if bad_size:
        logger.log(f"size mismatches: {len(bad_size)}")
        for object_path, local, remote_size in bad_size[:20]:
            logger.log(f"  SIZE {object_path}: local={local} remote={remote_size}")
    logger.log(
        "verified" if not missing and not bad_size else "verification failed"
    )
    logger.close()
    return 0 if not missing and not bad_size else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("interrupted", file=sys.stderr)
        raise SystemExit(130)
