#!/usr/bin/env python3
"""
Script to apply SQL migration to Supabase database
"""
import os
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

from app.services.supabase_client import supabase

def apply_migration():
    """Apply the comments fix migration"""
    
    # Read the SQL file
    sql_file = Path(__file__).parent / "database" / "add_social_feed_optimized.sql"
    
    with open(sql_file, 'r') as f:
        sql_content = f.read()
    
    print("🔄 Applying migration to fix comments...")
    print("=" * 50)
    
    try:
        # Execute the SQL via Supabase RPC
        # Note: We need to execute this via psycopg2 or similar direct connection
        # For now, let's use the Supabase REST API's SQL editor approach
        
        # Split by function and execute separately
        functions = []
        current_function = []
        
        for line in sql_content.split('\n'):
            if line.strip().startswith('DROP FUNCTION'):
                if current_function:
                    functions.append('\n'.join(current_function))
                current_function = [line]
            elif line.strip().startswith('CREATE OR REPLACE FUNCTION'):
                current_function.append(line)
            elif current_function:
                current_function.append(line)
                if line.strip() == '$$;':
                    functions.append('\n'.join(current_function))
                    current_function = []
        
        if current_function:
            functions.append('\n'.join(current_function))
        
        print(f"📝 Found {len(functions)} functions to update")
        
        # For Supabase, we need to use psycopg2 directly
        # Let's output instructions instead
        print("\n⚠️  Manual migration required:")
        print("Please run the following SQL in your Supabase SQL Editor:")
        print("=" * 50)
        print(f"\nFile: database/add_social_feed_optimized.sql\n")
        print("Or copy the SQL content and paste it into Supabase SQL Editor")
        print("=" * 50)
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    apply_migration()
