import io
import json
import urllib.request
import urllib.parse
from PIL import Image, ImageDraw

def post_image(url, filename, image_bytes):
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    body = []
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
        return json.loads(resp.read().decode('utf-8'))

# Create a sample test image (healthy/plain surface test)
img = Image.new("RGB", (300, 300), color=(240, 240, 240))
buf = io.BytesIO()
img.save(buf, format="JPEG")
print("1. Plain Light Image Result:", post_image("http://127.0.0.1:5001/predict", "plain.jpg", buf.getvalue()))

# Create a sample Healthy Shrimp test image (shrimp tissue, NO white spots)
img_healthy = Image.new("RGB", (300, 300), color=(120, 110, 95))
draw_h = ImageDraw.Draw(img_healthy)
draw_h.polygon([(40, 150), (120, 80), (250, 150), (180, 220)], fill=(140, 130, 110))
draw_h.line([(80, 100), (200, 160)], fill=(160, 150, 130), width=15)
buf_h = io.BytesIO()
img_healthy.save(buf_h, format="JPEG")
print("2. Healthy Shrimp Image Result:", post_image("http://127.0.0.1:5001/predict", "healthy_shrimp.jpg", buf_h.getvalue()))

# Create a sample WSSV Shrimp test image (shrimp tissue WITH dense punctate white spots)
img_shrimp = Image.new("RGB", (300, 300), color=(140, 100, 70))
draw = ImageDraw.Draw(img_shrimp)
for gx in range(20, 280, 20):
    for gy in range(20, 280, 20):
        draw.ellipse([gx-4, gy-4, gx+4, gy+4], fill=(255, 255, 255))
buf2 = io.BytesIO()
img_shrimp.save(buf2, format="JPEG")
print("3. WSSV Spot Pattern Image Result:", post_image("http://127.0.0.1:5001/predict", "wssv_spot.jpg", buf2.getvalue()))

