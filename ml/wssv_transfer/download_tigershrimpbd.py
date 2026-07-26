from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import shutil
import urllib.request
from pathlib import Path


DATASET_ID = "9dj4sk5d55"
DATASET_VERSION = 1
METADATA_URL = f"https://data.mendeley.com/public-api/datasets/{DATASET_ID}"
DATASET_PAGE_URL = f"https://data.mendeley.com/datasets/{DATASET_ID}/{DATASET_VERSION}"
DEFAULT_METADATA_PATH = Path("data/tigershrimpbd_metadata.json")
DEFAULT_OUTPUT_DIR = Path("data/tigershrimpbd")
REQUEST_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    "Referer": DATASET_PAGE_URL,
}

FOLDER_LABELS = {
    # Folder counts from the public metadata match the dataset description:
    # WSSV=978, Yellow Head=896, Black Gill=854, Healthy=846.
    "06f9a37d-d9eb-437f-8e9b-8b5c9564e4f7": "WSSV",
    "ec9dc924-a7e1-407d-a0ab-4b5fc2a6d00c": "WSSV",
    "f2b2787a-77df-458d-ac22-d438a2ae028d": "Healthy",
    "5d6468d6-f4ca-438e-90c7-d9c49cfe8a89": "Healthy",
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def fetch_metadata(path: Path) -> dict:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        request = urllib.request.Request(METADATA_URL, headers=REQUEST_HEADERS)
        with urllib.request.urlopen(request, timeout=60) as response:
            path.write_bytes(response.read())
    return json.loads(path.read_text(encoding="utf-8"))


def safe_filename(filename: str) -> str:
    return "".join(char if char.isalnum() or char in "._-" else "_" for char in filename)


def unique_target_path(directory: Path, filename: str, file_id: str) -> Path:
    safe_name = safe_filename(filename)
    target = directory / safe_name
    if target.exists():
        target = directory / f"{Path(safe_name).stem}_{file_id[:8]}{Path(safe_name).suffix}"
    return target


def download_one(file_record: dict, output_dir: Path) -> tuple[str, str]:
    label = FOLDER_LABELS[file_record["folder_id"]]
    target_dir = output_dir / label
    target_dir.mkdir(parents=True, exist_ok=True)
    expected_hash = file_record["content_details"]["sha256_hash"]
    base_target = target_dir / safe_filename(file_record["filename"])

    if base_target.exists() and sha256(base_target) == expected_hash:
        return label, "skipped"

    target = unique_target_path(target_dir, file_record["filename"], file_record["id"])
    if target.exists() and sha256(target) == expected_hash:
        return label, "skipped"

    temp_target = target.with_suffix(target.suffix + ".download")
    request = urllib.request.Request(file_record["content_details"]["download_url"], headers=REQUEST_HEADERS)
    with urllib.request.urlopen(request, timeout=90) as response:
        with temp_target.open("wb") as handle:
            shutil.copyfileobj(response, handle)

    actual_hash = sha256(temp_target)
    if actual_hash != expected_hash:
        temp_target.unlink(missing_ok=True)
        raise ValueError(f"Hash mismatch for {file_record['filename']}: {actual_hash} != {expected_hash}")

    temp_target.replace(target)
    return label, "downloaded"


def write_source_note(metadata: dict, output_dir: Path) -> None:
    note = {
        "dataset": metadata.get("name"),
        "id": DATASET_ID,
        "version": DATASET_VERSION,
        "doi": metadata.get("doi", {}).get("id"),
        "source_url": f"https://data.mendeley.com/datasets/{DATASET_ID}/{DATASET_VERSION}",
        "license": "CC BY 4.0",
        "contributors": [
            f"{item.get('first_name', '').strip()} {item.get('last_name', '').strip()}".strip()
            for item in metadata.get("contributors", [])
        ],
        "used_labels": sorted(set(FOLDER_LABELS.values())),
        "folder_label_map": FOLDER_LABELS,
    }
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "SOURCE.json").write_text(json.dumps(note, indent=2), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Download Healthy and WSSV images from TigerShrimpBD.")
    parser.add_argument("--metadata-path", type=Path, default=DEFAULT_METADATA_PATH)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--workers", type=int, default=12)
    args = parser.parse_args()

    metadata = fetch_metadata(args.metadata_path)
    write_source_note(metadata, args.output_dir)
    selected_files = [item for item in metadata["files"] if item.get("folder_id") in FOLDER_LABELS]

    counts: dict[str, dict[str, int]] = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = [executor.submit(download_one, item, args.output_dir) for item in selected_files]
        for future in concurrent.futures.as_completed(futures):
            label, status = future.result()
            counts.setdefault(label, {"downloaded": 0, "skipped": 0})
            counts[label][status] += 1

    print(json.dumps({"selected": len(selected_files), "counts": counts}, indent=2))


if __name__ == "__main__":
    main()
