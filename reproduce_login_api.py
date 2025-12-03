
import httpx
import asyncio

async def login():
    url = "http://localhost:8000/api/v1/auth/login"
    data = {
        "email": "tycgfr@gmail.com",
        "password": "password123" # I don't know the password, but I can try a dummy one to see if I get 401 or 500
    }
    
    print(f"Logging in to {url}...")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=data)
            print(f"Status: {response.status_code}")
            print(f"Response: {response.text}")
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    asyncio.run(login())
