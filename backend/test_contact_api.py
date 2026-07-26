import json
import urllib.request

url = "http://localhost/shrim_predict_api/contact.php"
payload = {
    "name": "Juan Dela Cruz",
    "email": "juan@farm.com",
    "subject": "Pond Setup / Inquiry",
    "message": "How can we help your farm?"
}

data = json.dumps(payload).encode("utf-8")
req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})

try:
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode("utf-8"))
        print("Contact API Response:")
        print(json.dumps(res, indent=2))
except Exception as e:
    print("Error calling contact API:", e)
