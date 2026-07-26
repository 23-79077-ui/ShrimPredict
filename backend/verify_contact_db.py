import json
import urllib.request

url = "http://localhost/shrim_predict_api/contact.php"
payload = {
    "name": "Maria Santos",
    "email": "maria@shrimp-farm.ph",
    "subject": "AI WSSV Scan Integration",
    "message": "We want to connect 5 shrimp ponds in Pampanga to the AI disease alert system."
}

data = json.dumps(payload).encode("utf-8")
req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})

with urllib.request.urlopen(req) as resp:
    res = json.loads(resp.read().decode("utf-8"))
    print("Verification Submission 2 Response:")
    print(json.dumps(res, indent=2))
