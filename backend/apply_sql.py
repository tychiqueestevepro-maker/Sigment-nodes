import os
import sys
import psycopg2
from dotenv import load_dotenv

# Try loading from current dir then parent dir
load_dotenv(".env")
load_dotenv("../.env")

DB_URL = os.getenv("DATABASE_URL")
if not DB_URL:
    # Try looking for other common names
    DB_URL = os.getenv("POSTGRES_URL")

if not DB_URL:
    print("❌ DATABASE_URL not found in environment variables.")
    # Try to construct from components if available
    user = os.getenv("POSTGRES_USER")
    password = os.getenv("POSTGRES_PASSWORD")
    host = os.getenv("POSTGRES_HOST")
    port = os.getenv("POSTGRES_PORT")
    db = os.getenv("POSTGRES_DB")
    
    if user and password and host and db:
        DB_URL = f"postgresql://{user}:{password}@{host}:{port or 5432}/{db}"
        print(f"Constructed URL from components: postgresql://{user}:***@{host}:{port or 5432}/{db}")

if not DB_URL:
    print("❌ Could not determine database connection string.")
    sys.exit(1)

SQL_FILE = sys.argv[1] if len(sys.argv) > 1 else "../database/add_idea_groups_optimized.sql"

try:
    print(f"Connecting to database...")
    # Clean up URL if needed (sometimes loaded with quotes)
    DB_URL = DB_URL.strip("'").strip('"')
    
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = True
    cursor = conn.cursor()
    
    print(f"Reading SQL file: {SQL_FILE}")
    with open(SQL_FILE, 'r') as f:
        sql = f.read()
        
    print("Executing SQL...")
    cursor.execute(sql)
    
    print("✅ SQL Executed Successfully.")
    conn.close()
except Exception as e:
    print(f"❌ Error executing SQL: {e}")
    sys.exit(1)
