
import os
import sys

# Add current directory to sys.path
sys.path.append(os.getcwd())

try:
    from app.core.config import settings
    print("Settings loaded successfully")
    print(f"SUPABASE_URL: {settings.SUPABASE_URL}")
except Exception as e:
    print(f"Failed to load settings: {e}")
    import traceback
    traceback.print_exc()
