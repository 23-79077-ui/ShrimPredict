import io
import json
import urllib.request
from PIL import Image, ImageDraw

def test_php_endpoint(url):
    img = Image.new("RGB", (300, 300), color=(140, 100, 70))
    draw = ImageDraw.Draw(img)
    for x, y in [(50, 50), (80, 120), (150, 60), (200, 180), (110, 220), (70, 190), (180, 100)]:
        draw.ellipse([x-5, y-5, x+5, y+5], fill=(255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    image_bytes = buf.getvalue()

    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    body = []
    body.append(f"--{boundary}".encode())
    body.append(b'Content-Disposition: form-data; name="status"\r\n\r\nPending')
    body.append(f"--{boundary}".encode())
    body.append(b'Content-Disposition: form-data; name="caretaker_name"\r\n\r\nTest Caretaker')
    body.append(f"--{boundary}".encode())
    body.append(b'Content-Disposition: form-data; name="pond_name"\r\n\r\nPond A1')
    body.append(f"--{boundary}".encode())
    body.append(b'Content-Disposition: form-data; name="image"; filename="shrimp_scan.jpg"')
    body.append(b"Content-Type: image/jpeg\r\n")
    body.append(image_bytes)
    body.append(f"--{boundary}--".encode())
    payload = b"\r\n".join(body)

    req = urllib.request.Request(url, data=payload, headers={
        "Content-Type": f"multipart/form-data; boundary={boundary}"
    })
    try:
        with urllib.request.urlopen(req) as resp:
            print("Response from", url, ":", json.loads(resp.read().decode('utf-8')))
    except Exception as e:
        print("Error calling", url, ":", e)

test_php_endpoint("http://localhost/shrim_predict_api/backend/api/disease_scan.php")
test_php_endpoint("http://localhost/shrim_predict_api/disease_scan.php")
