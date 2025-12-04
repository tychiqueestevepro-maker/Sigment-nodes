#!/usr/bin/env python3
"""
Execute SQL directly via Supabase Python client
"""
import os
import sys
from dotenv import load_dotenv

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
load_dotenv()

from supabase import create_client
from loguru import logger

# Get Supabase credentials
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env")
    sys.exit(1)

# Create Supabase client
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

print("=" * 60)
print("🔧 Executing SQL Migration")
print("=" * 60)
print()

# Read the SQL file
sql_file_path = "database/add_unified_feed.sql"

try:
    with open(sql_file_path, 'r') as f:
        sql_content = f.read()
    
    print(f"✅ SQL file loaded: {sql_file_path}")
    print()
    
    # Execute via raw SQL using postgrest
    # We'll use the Supabase client's underlying connection
    
    # Split into individual statements
    statements = []
    current_statement = []
    in_function = False
    
    for line in sql_content.split('\n'):
        stripped = line.strip()
        
        # Track if we're inside a function definition
        if 'CREATE OR REPLACE FUNCTION' in line or 'CREATE FUNCTION' in line:
            in_function = True
        
        if in_function:
            current_statement.append(line)
            if stripped.endswith('$$;') or (stripped == '$$' and len(current_statement) > 1):
                in_function = False
                statements.append('\n'.join(current_statement))
                current_statement = []
        else:
            if stripped and not stripped.startswith('--'):
                current_statement.append(line)
                if stripped.endswith(';') and 'COMMENT ON' not in line:
                    statements.append('\n'.join(current_statement))
                    current_statement = []
    
    if current_statement:
        statements.append('\n'.join(current_statement))
    
    print(f"📊 Parsed {len(statements)} SQL statements")
    print()
    
    # Execute each statement
    success_count = 0
    for i, stmt in enumerate(statements, 1):
        stmt_preview = stmt[:100].replace('\n', ' ').strip()
        if len(stmt) > 100:
            stmt_preview += "..."
        
        print(f"[{i}/{len(statements)}] Executing: {stmt_preview}")
        
        try:
            # Use the supabase client to execute raw SQL via RPC
            # Note: This requires a helper function in the database
            # For now, we'll just show what needs to be executed
            print(f"    ⚠️  Cannot execute directly via Python client")
            print(f"    💡 Please use Supabase Dashboard SQL Editor")
        except Exception as e:
            print(f"    ❌ Error: {e}")
    
    print()
    print("=" * 60)
    print("📋 MANUAL EXECUTION REQUIRED")
    print("=" * 60)
    print()
    print("The Supabase Python client doesn't support raw SQL execution.")
    print("Please copy the SQL from database/add_unified_feed.sql")
    print("and execute it in the Supabase Dashboard SQL Editor.")
    print()
    print("Dashboard URL: https://supabase.com/dashboard")
    print()
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
