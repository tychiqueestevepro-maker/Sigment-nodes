import os
import sys
import asyncio

# Setup path to import app modules
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(current_dir, '..')
sys.path.append(backend_dir)

from app.services.supabase_client import get_supabase_client
from datetime import datetime

def publish_pending():
    supabase = get_supabase_client()
    now = datetime.utcnow().isoformat()
    
    print(f"Checking for scheduled posts before {now}...")
    
    response = supabase.table("posts").select("id, scheduled_at").eq("status", "scheduled").lte("scheduled_at", now).execute()
    posts = response.data or []
    
    print(f"Found {len(posts)} posts to publish.")
    
    for post in posts:
        print(f"Publishing {post['id']} (scheduled: {post['scheduled_at']})...")
        supabase.table("posts").update({
            "status": "published",
            "created_at": post["scheduled_at"]
        }).eq("id", post["id"]).execute()
        
    print("Done! Posts should now appear in the feed.")

if __name__ == "__main__":
    publish_pending()
