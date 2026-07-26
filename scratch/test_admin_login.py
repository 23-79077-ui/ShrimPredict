import requests

try:
    url = "http://localhost/ShrimPredict/backend/api/login.php"
    payload = {
        "email": "admin@shrimpredict.com",
        "password": "admin123"
    }
    response = requests.post(url, json=payload)
    print("Response Status Code:", response.status_code)
    print("Response Data:", response.text)
except Exception as e:
    print("Test Error:", e)
