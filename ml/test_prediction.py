import json
from pathlib import Path
import urllib.request

API_URL = "http://127.0.0.1:5001/predict"
ROOT_DIR = Path(__file__).resolve().parents[1]


def post_image_file(url: str, file_path: Path):
    if not file_path.exists():
        raise FileNotFoundError(f"Test image not found: {file_path}")

    filename = file_path.name
    image_bytes = file_path.read_bytes()
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    body = [
        f"--{boundary}".encode(),
        f'Content-Disposition: form-data; name="image"; filename="{filename}"'.encode(),
        b"Content-Type: image/jpeg\r\n",
        image_bytes,
        f"--{boundary}--".encode(),
    ]
    payload = b"\r\n".join(body)

    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))


def run_sanity_tests():
    print("=" * 65)
    print("INFERENCE SANITY TEST (FLASK API)")
    print("=" * 65)
    print(f"Target API Endpoint: {API_URL}")

    test_cases = [
        {
            "name": "Healthy Shrimp Sample (Farm Captured)",
            "path": ROOT_DIR / "ml" / "test_healthy_shrimp.jpg",
            "expected_status": "Healthy",
            "expected_class": "Healthy",
            "min_confidence": 78.0,
        },
        {
            "name": "White Spot Syndrome Virus Sample (WSSV)",
            "path": ROOT_DIR / "ml" / "test_wssv_shrimp.jpg",
            "expected_status": "Diseased",
            "expected_class": "WSSV",
            "min_confidence": 68.0,
        },
    ]

    all_passed = True
    for i, test in enumerate(test_cases, 1):
        print(f"\n[{i}/{len(test_cases)}] Testing: {test['name']}")
        print(f"     File: {test['path']}")

        res = post_image_file(API_URL, test["path"])

        pred = res.get("prediction") or res.get("disease_name")
        status = res.get("status")
        conf = float(res.get("confidence") or res.get("confidence_score") or 0.0)
        model_used = res.get("model_used")
        probs = res.get("probabilities", {})

        print(f"     -> Shrimp Detected : {res.get('shrimp_detected')} ({res.get('stage1_details', {}).get('status', 'N/A')})")
        print(f"     -> Image Quality   : {res.get('image_quality')}")
        print(f"     -> Prediction      : {pred}")
        print(f"     -> Status          : {status}")
        print(f"     -> Confidence      : {conf:.2f}% (Threshold: {test['min_confidence']}%)")
        print(f"     -> Model Used      : {model_used}")
        print(f"     -> Probabilities   : {probs}")

        passed = (
            status == test["expected_status"]
            and test["expected_class"].lower() in str(pred).lower()
            and conf >= test["min_confidence"]
            and ("Consensus" in str(model_used) or "Upgraded" in str(model_used))
        )

        if passed:
            print("     -> SANITY CHECK    : [PASSED]")
        else:
            print(f"     -> SANITY CHECK    : [FAILED] (Expected {test['expected_class']} with status {test['expected_status']})")
            all_passed = False

    print("\n" + "=" * 65)
    if all_passed:
        print("ALL SANITY TESTS PASSED SUCCESSFULLY! The pipeline is ready.")
    else:
        print("SOME TESTS DID NOT MEET EXPECTED CRITERIA.")
    print("=" * 65)


if __name__ == "__main__":
    run_sanity_tests()
