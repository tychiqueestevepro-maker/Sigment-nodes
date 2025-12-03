"""
Debug script to check cluster and pillar organization_id
"""
import os
from dotenv import load_dotenv
from supabase import create_client

# Load environment
load_dotenv()

# Initialize Supabase
supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)

# Check the cluster
cluster_id = "a6ef52d7-fe8b-43d6-b606-14a91518f2c1"
pillar_id = "165b86e4-abd0-4fa2-bac0-89e2c899eee0"
note_id = "354f3d61-0760-46fa-8378-c3a54c744352"
expected_org_id = "1923eb01-105d-4272-a67a-9a9477e4af6a"

print("=" * 80)
print("DEBUGGING MISSING CLUSTER IN GALAXY VIEW")
print("=" * 80)

# Check Note
print("\n1. Checking Note:")
note = supabase.table("notes").select("*").eq("id", note_id).execute()
if note.data:
    n = note.data[0]
    print(f"   ✓ Note exists")
    print(f"   - ID: {n['id']}")
    print(f"   - Organization ID: {n.get('organization_id', 'MISSING!')}")
    print(f"   - Pillar ID: {n.get('pillar_id', 'MISSING!')}")
    print(f"   - Cluster ID: {n.get('cluster_id', 'MISSING!')}")
    print(f"   - Status: {n.get('status')}")
    print(f"   - Match Org: {str(n.get('organization_id')) == expected_org_id}")
else:
    print("   ✗ Note NOT FOUND!")

# Check Cluster
print("\n2. Checking Cluster:")
cluster = supabase.table("clusters").select("*").eq("id", cluster_id).execute()
if cluster.data:
    c = cluster.data[0]
    print(f"   ✓ Cluster exists")
    print(f"   - ID: {c['id']}")
    print(f"   - Title: {c.get('title')}")
    print(f"   - Organization ID: {c.get('organization_id', 'MISSING!')}")
    print(f"   - Pillar ID: {c.get('pillar_id')}")
    print(f"   - Match Org: {str(c.get('organization_id')) == expected_org_id}")
else:
    print("   ✗ Cluster NOT FOUND!")

# Check Pillar
print("\n3. Checking Pillar:")
pillar = supabase.table("pillars").select("*").eq("id", pillar_id).execute()
if pillar.data:
    p = pillar.data[0]
    print(f"   ✓ Pillar exists")
    print(f"   - ID: {p['id']}")
    print(f"   - Name: {p.get('name')}")
    print(f"   - Organization ID: {p.get('organization_id', 'MISSING!')}")
    print(f"   - Match Org: {str(p.get('organization_id')) == expected_org_id}")
else:
    print("   ✗ Pillar NOT FOUND!")

# Test the Galaxy query
print("\n4. Testing Galaxy Query:")
try:
    response = supabase.table("clusters").select(
        """
        id,
        title,
        last_updated_at,
        pillar_id,
        organization_id,
        pillars(id, name, color, organization_id),
        notes!inner(id, ai_relevance_score, status, organization_id)
        """
    ).eq("organization_id", expected_org_id).eq("notes.status", "processed").execute()
    
    print(f"   - Total clusters returned: {len(response.data) if response.data else 0}")
    if response.data:
        for cluster in response.data:
            print(f"   - Cluster: {cluster.get('title')} - Notes: {len(cluster.get('notes', []))}")
    else:
        print("   ✗ No clusters returned!")
except Exception as e:
    print(f"   ✗ Query failed: {e}")

# Try without notes filter
print("\n5. Testing WITHOUT notes filter:")
try:
    response = supabase.table("clusters").select(
        """
        id,
        title,
        organization_id,
        pillar_id
        """
    ).eq("organization_id", expected_org_id).execute()
    
    print(f"   - Total clusters returned: {len(response.data) if response.data else 0}")
    if response.data:
        for cluster in response.data[:5]:  # First 5
            print(f"   - Cluster: {cluster.get('title', 'No title')} (ID: {cluster['id'][:8]}...)")
except Exception as e:
    print(f"   ✗ Query failed: {e}")

print("\n" + "=" * 80)
