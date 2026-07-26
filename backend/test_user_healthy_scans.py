import json
import urllib.request
from pathlib import Path

def test_upload_file(filepath):
    url = "http://localhost/shrim_predict_api/backend/api/disease_scan.php"
    filename = filepath.name
    with open(filepath, "rb") as f:
        image_bytes = f.read()

    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    body = []
    body.append(f"--{boundary}".encode())
    body.append(b'Content-Disposition: form-data; name="status"\r\n\r\nPending')
    body.append(f"--{boundary}".encode())
    body.append(b'Content-Disposition: form-data; name="caretaker_name"\r\n\r\nTest Caretaker')
    body.append(f"--{boundary}".encode())
    body.append(b'Content-Disposition: form-data; name="pond_name"\r\n\r\nPond A1')
    body.append(f"--{boundary}".encode())
    body.append(f'Content-Disposition: form-data; name="image"; filename="{filename}"'.encode())
    body.append(b"Content-Type: image/jpeg\r\n")
    body.append(image_bytes)
    body.append(f"--{boundary}--".encode())
    payload = b"\r\n".join(body)

    req = urllib.request.Request(url, data=payload, headers={
        "Content-Type": f"multipart/form-data; boundary={boundary}"
    })
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode('utf-8'))
        print(f"Uploaded {filename}:")
        print("  Disease:", res['prediction']['disease_name'])
        print("  Risk Level:", res['prediction']['risk_level'])
        print("  Confidence:", res['prediction']['confidence_score'], "%")

uploads_dir = Path("backend/uploads/disease_scans")
for name in ["1785025670_c5464ea2_healthyyy.jpg", "1785025682_38a3f594_healty.jpg", "1785025968_1fd2c0f9_images.jpg", "1785026010_6e0e997b_hehe.jpg"]:
    fp = uploads_dir / name
    if fp.exists():
        test_upload_file(fp)
