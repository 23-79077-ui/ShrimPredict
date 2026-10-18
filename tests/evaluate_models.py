"""Evaluate ShrimpPredict against labeled images and supplied farm ground truth.

This script never fabricates labels or targets. Image classifications use the live
Flask /predict endpoint; feed and harvest metrics require the real paired CSV data.
"""

from __future__ import annotations

import argparse
import csv
import gc
import json
import mimetypes
import math
import os
import statistics
import sys
import time
import tracemalloc
import urllib.error
import urllib.request
import uuid
from datetime import date, datetime
from pathlib import Path
from typing import Any, Sequence

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
DEFAULT_IMAGE_CSV = ROOT / "ml" / "artifacts" / "test_clean.csv"
DEFAULT_OUTPUT = ROOT / "tests" / "evaluation_results.json"
DEFAULT_SAMPLE_IMAGES = [
    ROOT / "ml" / "test_healthy_shrimp.jpg",
    ROOT / "ml" / "test_wssv_shrimp.jpg",
]


def _read_csv(path: Path) -> list[dict[str, str]]:
    if not path.is_file():
        raise FileNotFoundError(f"Evaluation CSV does not exist: {path}")
    with path.open("r", newline="", encoding="utf-8-sig") as source:
        return list(csv.DictReader(source))


def _portable_path(path: Path) -> str:
    try:
        return path.resolve().relative_to(ROOT).as_posix()
    except ValueError:
        return path.name


def _resolve_image_path(row: dict[str, str], image_root: Path | None) -> Path:
    raw_path = (row.get("image_path") or row.get("path") or "").strip()
    filename = (row.get("filename") or "").strip()
    candidate = Path(raw_path) if raw_path else Path(filename)
    if not candidate.is_absolute():
        candidate = ROOT / candidate
    if candidate.is_file():
        return candidate
    if image_root is not None and filename:
        rooted = image_root / filename
        if rooted.is_file():
            return rooted
    raise FileNotFoundError(
        f"Image not found for manifest row (image_path={raw_path!r}, "
        f"filename={filename!r}); use --image-root if the dataset was relocated."
    )


def _is_wssv(label: str) -> bool:
    normalized = " ".join(label.casefold().replace("_", " ").replace("+", " ").split())
    return "wssv" in normalized or "white spot" in normalized


def _binary_class(label: str) -> int:
    if _is_wssv(label):
        return 1
    if "healthy" in label.casefold() or "black gill" in label.casefold():
        return 0
    raise ValueError(f"Unrecognized disease ground-truth/prediction label: {label!r}")


def _manifest_label(row: dict[str, str]) -> str:
    label = (row.get("label") or row.get("true_label") or row.get("ground_truth_raw") or "").strip()
    if not label:
        raise ValueError("Manifest row must contain label, true_label, or ground_truth_raw.")
    return label


def _multipart_image(image_path: Path) -> tuple[bytes, str]:
    boundary = f"ShrimPredict-{uuid.uuid4().hex}"
    content_type = mimetypes.guess_type(image_path.name)[0] or "application/octet-stream"
    payload = image_path.read_bytes()
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="image"; filename="{image_path.name}"\r\n'
        f"Content-Type: {content_type}\r\n\r\n"
    ).encode("utf-8") + payload + f"\r\n--{boundary}--\r\n".encode("ascii")
    return body, f"multipart/form-data; boundary={boundary}"


def _prediction_label(payload: dict[str, Any]) -> str:
    if payload.get("shrimp_detected") is False:
        raise ValueError("API rejected the image: no shrimp was detected.")
    if payload.get("image_quality") == "Poor Image Quality" or payload.get("status") in {
        "Poor Image Quality",
        "Uncertain",
        "Error",
    }:
        raise ValueError(f"API did not produce a classifiable result: {payload.get('status')}.")

    prediction = payload.get("prediction")
    candidates: list[Any] = []
    if isinstance(prediction, dict):
        candidates.extend((prediction.get("prediction"), prediction.get("disease_name"), prediction.get("label")))
    else:
        candidates.append(prediction)
    candidates.extend((payload.get("disease_name"), payload.get("label"), payload.get("status")))

    for candidate in candidates:
        if isinstance(candidate, str) and candidate.strip():
            return candidate.strip()
    raise ValueError("API response did not contain a disease class.")


def _predict_image(image_path: Path, endpoint: str, timeout: float) -> tuple[str, float]:
    body, content_type = _multipart_image(image_path)
    request = urllib.request.Request(
        endpoint,
        data=body,
        headers={"Content-Type": content_type, "Accept": "application/json"},
        method="POST",
    )
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            status = response.status
            response_body = response.read()
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code} from {endpoint}: {detail[:500]}") from exc
    except (urllib.error.URLError, TimeoutError) as exc:
        raise RuntimeError(f"Could not reach {endpoint}: {exc}") from exc
    elapsed_ms = (time.perf_counter() - started) * 1000
    if status < 200 or status >= 300:
        raise RuntimeError(f"HTTP {status} from {endpoint}")
    try:
        payload = json.loads(response_body)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"Non-JSON response from {endpoint}") from exc
    if not isinstance(payload, dict):
        raise RuntimeError(f"Expected a JSON object from {endpoint}")
    if payload.get("success") is False:
        raise RuntimeError(str(payload.get("message") or payload.get("error") or "API reported failure"))
    return _prediction_label(payload), elapsed_ms


def _classification_metrics(y_true: list[int], y_pred: list[int]) -> dict[str, Any]:
    true_positive = sum(actual == 1 and predicted == 1 for actual, predicted in zip(y_true, y_pred))
    true_negative = sum(actual == 0 and predicted == 0 for actual, predicted in zip(y_true, y_pred))
    false_positive = sum(actual == 0 and predicted == 1 for actual, predicted in zip(y_true, y_pred))
    false_negative = sum(actual == 1 and predicted == 0 for actual, predicted in zip(y_true, y_pred))
    total = len(y_true)

    def ratio(numerator: int, denominator: int) -> float | None:
        return numerator / denominator if denominator else None

    precision = ratio(true_positive, true_positive + false_positive)
    recall = ratio(true_positive, true_positive + false_negative)
    return {
        "confusion_matrix": {
            "labels": ["non-WSSV", "WSSV"],
            "matrix_rows_true_columns_predicted": [
                [true_negative, false_positive],
                [false_negative, true_positive],
            ],
        },
        "TP": true_positive,
        "TN": true_negative,
        "FP": false_positive,
        "FN": false_negative,
        "accuracy": ratio(true_positive + true_negative, total),
        "precision": precision,
        "recall": recall,
        "f1_score": (
            2 * precision * recall / (precision + recall)
            if precision is not None and recall is not None and precision + recall
            else None
        ),
        "classified_samples": total,
    }


def evaluate_disease(
    csv_path: Path,
    endpoint: str,
    timeout: float,
    limit: int,
    image_root: Path | None,
) -> dict[str, Any]:
    rows = _read_csv(csv_path)
    if limit > 0:
        rows = rows[:limit]
    if not rows:
        raise ValueError(f"No labeled images found in {csv_path}")

    y_true: list[int] = []
    y_pred: list[int] = []
    latencies: list[float] = []
    failures: list[dict[str, str]] = []
    for index, row in enumerate(rows, start=1):
        try:
            image_path = _resolve_image_path(row, image_root)
            actual = _binary_class(_manifest_label(row))
            predicted_label, latency_ms = _predict_image(image_path, endpoint, timeout)
            predicted = _binary_class(predicted_label)
        except (OSError, RuntimeError, ValueError) as exc:
            failures.append({"row": str(index), "error": str(exc)})
            print(f"[DISEASE {index}/{len(rows)}] ERROR: {exc}", file=sys.stderr)
            continue
        y_true.append(actual)
        y_pred.append(predicted)
        latencies.append(latency_ms)
        if index == 1 or index == len(rows) or index % 25 == 0:
            print(f"[DISEASE] Processed {index}/{len(rows)} manifest rows")

    if not y_true:
        raise RuntimeError(
            f"All {len(rows)} disease predictions failed; first error: "
            f"{failures[0]['error'] if failures else 'unknown'}"
        )
    metrics = _classification_metrics(y_true, y_pred)
    return {
        **metrics,
        "status": "partial" if failures else "complete",
        "endpoint": endpoint,
        "manifest": _portable_path(csv_path),
        "attempted_samples": len(rows),
        "inference_failures": len(failures),
        "coverage": len(y_true) / len(rows),
        "mean_http_inference_ms": statistics.mean(latencies),
        "p95_http_inference_ms": sorted(latencies)[math.ceil(0.95 * len(latencies)) - 1],
        "failure_examples": failures[:20],
        "label_mapping": (
            "WSSV and WSSV + Black Gill are positive; Healthy and Black Gill are negative."
        ),
    }


def _numeric_column(rows: list[dict[str, str]], column: str, source: Path) -> list[float]:
    values: list[float] = []
    for line_number, row in enumerate(rows, start=2):
        try:
            value = float(row[column])
        except (KeyError, TypeError, ValueError) as exc:
            raise ValueError(f"{source}:{line_number} requires numeric column {column!r}.") from exc
        if not math.isfinite(value):
            raise ValueError(f"{source}:{line_number} has a non-finite value in {column!r}.")
        values.append(value)
    return values


def _regression_metrics(actual: Sequence[float], predicted: Sequence[float]) -> dict[str, Any]:
    if len(actual) != len(predicted) or not actual:
        raise ValueError("Regression metrics require equally sized, non-empty columns.")
    errors = [prediction - truth for truth, prediction in zip(actual, predicted)]
    mae = statistics.mean(abs(error) for error in errors)
    rmse = math.sqrt(statistics.mean(error * error for error in errors))
    mean_actual = statistics.mean(actual)
    total_sum_squares = sum((value - mean_actual) ** 2 for value in actual)
    residual_sum_squares = sum(error * error for error in errors)
    r_squared = (
        1 - residual_sum_squares / total_sum_squares
        if len(actual) > 1 and total_sum_squares > 0
        else None
    )
    return {"sample_count": len(actual), "MAE": mae, "RMSE": rmse, "R2": r_squared}


def evaluate_feed(csv_path: Path) -> dict[str, Any]:
    rows = _read_csv(csv_path)
    actual = _numeric_column(rows, "actual_feed_kg", csv_path)
    predicted = _numeric_column(rows, "predicted_feed_kg", csv_path)
    if not rows:
        raise ValueError(f"No feed comparison rows found in {csv_path}")
    errors = [abs(estimate - truth) for truth, estimate in zip(actual, predicted)]
    percent_deviations = [
        error / abs(truth) * 100 for truth, error in zip(actual, errors) if truth != 0
    ]
    return {
        "sample_count": len(rows),
        "MAE_kg": statistics.mean(errors),
        "mean_absolute_percentage_deviation": (
            statistics.mean(percent_deviations) if percent_deviations else None
        ),
        "percentage_deviation_samples_excluded_zero_actual": len(rows) - len(percent_deviations),
        "ground_truth_column": "actual_feed_kg",
        "prediction_column": "predicted_feed_kg",
        "source": _portable_path(csv_path),
    }


def _date_column(rows: list[dict[str, str]], column: str, source: Path) -> list[date]:
    parsed: list[date] = []
    for line_number, row in enumerate(rows, start=2):
        raw = (row.get(column) or "").strip()
        try:
            parsed.append(date.fromisoformat(raw[:10]))
        except ValueError as exc:
            raise ValueError(f"{source}:{line_number} requires ISO date in {column!r}.") from exc
    return parsed


def evaluate_harvest(csv_path: Path) -> dict[str, Any]:
    rows = _read_csv(csv_path)
    if not rows:
        raise ValueError(f"No harvest comparison rows found in {csv_path}")
    actual_yield = _numeric_column(rows, "actual_harvest_kg", csv_path)
    predicted_yield = _numeric_column(rows, "predicted_harvest_kg", csv_path)
    result: dict[str, Any] = {
        "yield_kg": _regression_metrics(actual_yield, predicted_yield),
        "source": _portable_path(csv_path),
        "yield_columns": {
            "actual": "actual_harvest_kg",
            "predicted": "predicted_harvest_kg",
        },
    }
    date_columns_present = all(
        rows[0].get(column) is not None
        for column in ("actual_harvest_date", "predicted_harvest_date")
    )
    if date_columns_present:
        actual_dates = _date_column(rows, "actual_harvest_date", csv_path)
        predicted_dates = _date_column(rows, "predicted_harvest_date", csv_path)
        actual_days = [float(value.toordinal()) for value in actual_dates]
        predicted_days = [float(value.toordinal()) for value in predicted_dates]
        result["harvest_timing_days"] = _regression_metrics(actual_days, predicted_days)
    else:
        result["harvest_timing_days"] = {
            "status": "not_evaluated",
            "reason": "Add actual_harvest_date and predicted_harvest_date ISO columns.",
        }
    return result


def _parse_resolutions(raw: str) -> list[tuple[int, int]]:
    resolutions = []
    for token in raw.split(","):
        try:
            width, height = (int(part) for part in token.lower().split("x", maxsplit=1))
        except (ValueError, TypeError) as exc:
            raise argparse.ArgumentTypeError(
                f"Invalid resolution {token!r}; expected WIDTHxHEIGHT, e.g. 640x480."
            ) from exc
        if width <= 0 or height <= 0:
            raise argparse.ArgumentTypeError("Image resolutions must be positive.")
        resolutions.append((width, height))
    return resolutions


def _sample_paths(csv_path: Path | None, image_root: Path | None, limit: int) -> list[Path]:
    paths: list[Path] = []
    if csv_path is not None and csv_path.is_file():
        for row in _read_csv(csv_path):
            try:
                paths.append(_resolve_image_path(row, image_root))
            except FileNotFoundError:
                continue
            if limit > 0 and len(paths) >= limit:
                break
    if not paths:
        paths = [path for path in DEFAULT_SAMPLE_IMAGES if path.is_file()]
    if not paths:
        raise FileNotFoundError(
            "No benchmark images found. Supply a labeled manifest with local image paths."
        )
    return paths


def benchmark_preprocessing(
    images: list[Path],
    resolutions: list[tuple[int, int]],
    batch_sizes: list[int],
) -> list[dict[str, Any]]:
    try:
        from PIL import Image
        from ml.preprocessing import preprocess_for_inference
    except ImportError as exc:
        raise RuntimeError(
            "Pillow and the project preprocessing module are required for image benchmarks."
        ) from exc

    try:
        psutil = __import__("psutil")
        process = psutil.Process(os.getpid())
    except ImportError:
        process = None

    import numpy as np

    results: list[dict[str, Any]] = []
    for width, height in resolutions:
        for batch_size in batch_sizes:
            warmup_paths = images[: min(batch_size, len(images))]
            for image_path in warmup_paths:
                with Image.open(image_path) as source:
                    resized = source.convert("RGB").resize(
                        (width, height), Image.Resampling.LANCZOS
                    )
                    preprocess_for_inference(resized)
            gc.collect()

            rss_samples = []
            if process is not None:
                rss_samples.append(process.memory_info().rss)
            processed = 0
            tracemalloc.start()
            started = time.perf_counter()
            try:
                for offset in range(0, len(images), batch_size):
                    batch = []
                    for image_path in images[offset : offset + batch_size]:
                        with Image.open(image_path) as source:
                            resized = source.convert("RGB").resize(
                                (width, height), Image.Resampling.LANCZOS
                            )
                            tensor, _ = preprocess_for_inference(resized)
                        batch.append(tensor[0])
                        processed += 1
                    if batch:
                        np.stack(batch, axis=0)
                    if process is not None:
                        rss_samples.append(process.memory_info().rss)
                elapsed_seconds = time.perf_counter() - started
                _, peak_python_bytes = tracemalloc.get_traced_memory()
            finally:
                tracemalloc.stop()
            results.append(
                {
                    "input_resolution": f"{width}x{height}",
                    "batch_size": batch_size,
                    "warmup_images": len(warmup_paths),
                    "images_processed": processed,
                    "mean_processing_ms_per_image": elapsed_seconds * 1000 / processed,
                    "preprocessing_fps": processed / elapsed_seconds if elapsed_seconds else None,
                    "peak_traced_python_heap_mb": peak_python_bytes / (1024 * 1024),
                    "peak_sampled_process_rss_mb": (
                        max(rss_samples) / (1024 * 1024) if rss_samples else None
                    ),
                    "rss_measurement": (
                        "psutil RSS sampled after each batch"
                        if process is not None
                        else "psutil not installed; see traced Python heap"
                    ),
                }
            )
    return results


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--only",
        default="disease,feed,harvest,image",
        help="Comma-separated domains: disease,feed,harvest,image (default: all).",
    )
    parser.add_argument("--disease-csv", type=Path, default=DEFAULT_IMAGE_CSV)
    parser.add_argument("--image-csv", type=Path, default=DEFAULT_IMAGE_CSV)
    parser.add_argument("--image-root", type=Path)
    parser.add_argument("--feed-csv", type=Path)
    parser.add_argument("--harvest-csv", type=Path)
    parser.add_argument("--predict-url", default="http://127.0.0.1:5001/predict")
    parser.add_argument("--timeout", type=float, default=90.0)
    parser.add_argument("--limit", type=int, default=0, help="Limit disease samples; 0 means all.")
    parser.add_argument("--image-count", type=int, default=24)
    parser.add_argument("--resolutions", default="224x224,640x480,1280x720")
    parser.add_argument("--batch-sizes", default="1,4,8")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    args.domains = {domain.strip().casefold() for domain in args.only.split(",") if domain.strip()}
    valid_domains = {"disease", "feed", "harvest", "image"}
    if not args.domains or args.domains - valid_domains:
        parser.error(f"--only accepts one or more of: {', '.join(sorted(valid_domains))}")
    if args.timeout <= 0 or args.limit < 0 or args.image_count <= 0:
        parser.error("--timeout and --image-count must be positive; --limit cannot be negative.")
    try:
        args.resolutions = _parse_resolutions(args.resolutions)
        args.batch_sizes = [int(value) for value in args.batch_sizes.split(",")]
    except (argparse.ArgumentTypeError, ValueError) as exc:
        parser.error(str(exc))
    if not args.batch_sizes or any(size <= 0 for size in args.batch_sizes):
        parser.error("--batch-sizes must be a comma-separated list of positive integers.")
    return args


def main() -> int:
    args = _parse_args()
    report: dict[str, Any] = {
        "system": "ShrimPredict",
        "generated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "domains": {},
        "skipped_domains": {},
        "failed_domains": {},
        "methodology": {
            "disease_detection": (
                "Binary WSSV vs non-WSSV scoring against the supplied labeled split. "
                "Inference runs through the live Flask endpoint; HTTP/model failures are "
                "reported and excluded from classification metrics, with coverage reported."
            ),
            "image_processing": (
                "Measures the project's letterbox preprocessing helper, including source "
                "image decode/resize and 224x224 preprocessing. FPS is preprocessing FPS, "
                "not model-inference FPS. tracemalloc is Python-heap allocation; optional "
                "psutil RSS is sampled after each batch."
            ),
        },
    }

    if "disease" in args.domains:
        try:
            disease_metrics = evaluate_disease(
                args.disease_csv, args.predict_url, args.timeout, args.limit, args.image_root
            )
            report["domains"]["disease_detection"] = disease_metrics
            if disease_metrics["inference_failures"]:
                report["failed_domains"]["disease_detection"] = (
                    f"{disease_metrics['inference_failures']} of "
                    f"{disease_metrics['attempted_samples']} predictions failed or were "
                    "unclassifiable; metrics cover classified samples only."
                )
        except (OSError, RuntimeError, ValueError) as exc:
            report["failed_domains"]["disease_detection"] = str(exc)

    if "feed" in args.domains:
        if args.feed_csv is None:
            report["skipped_domains"]["feed_monitoring"] = (
                "Provide --feed-csv with actual_feed_kg and predicted_feed_kg columns."
            )
        else:
            try:
                report["domains"]["feed_monitoring"] = evaluate_feed(args.feed_csv)
            except (OSError, ValueError) as exc:
                report["failed_domains"]["feed_monitoring"] = str(exc)

    if "harvest" in args.domains:
        if args.harvest_csv is None:
            report["skipped_domains"]["harvest_prediction"] = (
                "Provide --harvest-csv with actual_harvest_kg and predicted_harvest_kg; "
                "date columns are needed for harvest timing metrics."
            )
        else:
            try:
                report["domains"]["harvest_prediction"] = evaluate_harvest(args.harvest_csv)
            except (OSError, ValueError) as exc:
                report["failed_domains"]["harvest_prediction"] = str(exc)

    if "image" in args.domains:
        try:
            images = _sample_paths(args.image_csv, args.image_root, args.image_count)
            report["domains"]["image_processing"] = benchmark_preprocessing(
                images, args.resolutions, args.batch_sizes
            )
            report["image_sample_paths"] = [_portable_path(path) for path in images]
        except (OSError, RuntimeError, ValueError) as exc:
            report["failed_domains"]["image_processing"] = str(exc)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(f"\nEvaluation report: {args.output}")
    for domain, message in report["skipped_domains"].items():
        print(f"[SKIP] {domain}: {message}")
    for domain, message in report["failed_domains"].items():
        print(f"[FAIL] {domain}: {message}", file=sys.stderr)
    for domain, metrics in report["domains"].items():
        status = metrics.get("status", "complete") if isinstance(metrics, dict) else "complete"
        label = "PARTIAL" if status == "partial" else "PASS"
        print(f"[{label}] {domain}:")
        print(json.dumps(metrics, indent=2, allow_nan=False))
    return 1 if report["failed_domains"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
