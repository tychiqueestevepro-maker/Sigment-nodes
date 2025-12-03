import requests
import json

def test_login():
    url = "http://localhost:8000/api/v1/auth/login"
    payload = {
        "email": "tycgfr@gmail.com",
        "password": "password123" # Dummy password
    }
    
    try:
        print(f"Sending request to {url}...")
        response = requests.post(url, json=payload)
        
        print(f"Status Code: {response.status_code}")
        print("Response Headers:", response.headers)
        print("Response Body (Text):")
        print(response.text)
        
        try:
            print("Response Body (JSON):")
            print(response.json())
        except json.JSONDecodeError:
            print("Response is NOT valid JSON")
            
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    test_login()
