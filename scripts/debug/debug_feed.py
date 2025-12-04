#!/usr/bin/env python3
"""
Debug: Check notes and clusters status
"""
import os
import sys
from dotenv import load_dotenv

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
load_dotenv()

from supabase import create_client

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

print("=" * 60)
print("🔍 DEBUGGING FEED - Notes & Clusters Status")
print("=" * 60)
print()

# Get organization
orgs = supabase.table("organizations").select("id, name, slug").limit(1).execute()
if not orgs.data:
    print("❌ No organizations found")
    sys.exit(1)

org_id = orgs.data[0]['id']
org_name = orgs.data[0]['name']

print(f"📍 Organization: {org_name} ({org_id})")
print()

# Check NOTES
print("=" * 60)
print("📝 NOTES STATUS")
print("=" * 60)

notes = supabase.table("notes").select("id, title_clarified, content_raw, content_clarified, status, cluster_id, created_at").eq("organization_id", org_id).order("created_at", desc=True).limit(10).execute()

if notes.data:
    print(f"✅ Found {len(notes.data)} recent notes:")
    print()
    for note in notes.data:
        status_emoji = "✅" if note['status'] == 'processed' else "⏳"
        cluster_status = f"🔗 Cluster: {note['cluster_id'][:8]}..." if note['cluster_id'] else "🆓 FREE (not clustered)"
        
        # Show title if available
        title = note.get('title_clarified', None)
        if title:
            title_display = f"📌 {title[:40]}..." if len(title) > 40 else f"📌 {title}"
        else:
            content_preview = note['content_raw'][:40] + "..." if len(note['content_raw']) > 40 else note['content_raw']
            title_display = f"⚠️  NO TITLE | {content_preview}"
        
        print(f"{status_emoji} {note['status']:12} | {cluster_status:30}")
        print(f"   {title_display}")
        print()
    
    # Count by status
    unclustered = sum(1 for n in notes.data if n['cluster_id'] is None)
    clustered = sum(1 for n in notes.data if n['cluster_id'] is not None)
    processed = sum(1 for n in notes.data if n['status'] == 'processed')
    with_title = sum(1 for n in notes.data if n.get('title_clarified'))
    without_title = sum(1 for n in notes.data if not n.get('title_clarified') and n['status'] == 'processed')
    
    print(f"📊 Summary:")
    print(f"   - Unclustered (FREE): {unclustered}")
    print(f"   - Clustered: {clustered}")
    print(f"   - Processed: {processed}")
    print(f"   - With AI Title: {with_title}")
    print(f"   - Processed WITHOUT Title: {without_title}")
    print()
    
    if without_title > 0:
        print(f"⚠️  WARNING: {without_title} processed note(s) don't have AI-generated titles!")
        print("💡 These notes were processed BEFORE the title_clarified field was added.")
        print("💡 They will display 'Untitled Idea' in the feed.")
        print()
    
    if unclustered == 0:
        print("⚠️  WARNING: ALL notes are clustered! No individual ideas will show.")
        print("💡 Solution: Create a new note or uncluster some notes.")
else:
    print("❌ No notes found")

print()

# Check CLUSTERS
print("=" * 60)
print("📚 CLUSTERS STATUS")
print("=" * 60)

clusters = supabase.table("clusters").select("id, title, note_count, last_updated_at").eq("organization_id", org_id).order("last_updated_at", desc=True).limit(10).execute()

if clusters.data:
    print(f"✅ Found {len(clusters.data)} clusters:")
    print()
    for cluster in clusters.data:
        note_emoji = "✅" if cluster['note_count'] >= 2 else "⚠️ "
        print(f"{note_emoji} {cluster['note_count']} notes | {cluster['title']}")
    print()
    
    visible_clusters = sum(1 for c in clusters.data if c['note_count'] >= 2)
    hidden_clusters = sum(1 for c in clusters.data if c['note_count'] < 2)
    
    print(f"📊 Summary:")
    print(f"   - Visible (2+ notes): {visible_clusters}")
    print(f"   - Hidden (0-1 notes): {hidden_clusters}")
else:
    print("❌ No clusters found")

print()

# Check POSTS
print("=" * 60)
print("📮 POSTS STATUS")
print("=" * 60)

posts = supabase.table("posts").select("id, content, post_type, created_at").eq("organization_id", org_id).order("created_at", desc=True).limit(10).execute()

if posts.data:
    print(f"✅ Found {len(posts.data)} posts:")
    print()
    for post in posts.data:
        type_emoji = "📝" if post['post_type'] == 'standard' else "🔗"
        content_preview = post['content'][:50] + "..." if len(post['content']) > 50 else post['content']
        print(f"{type_emoji} {post['post_type']:15} | {content_preview}")
    print()
    
    standard_posts = sum(1 for p in posts.data if p['post_type'] == 'standard')
    linked_posts = sum(1 for p in posts.data if p['post_type'] == 'linked_idea')
    
    print(f"📊 Summary:")
    print(f"   - Standard posts (visible): {standard_posts}")
    print(f"   - Linked idea posts (hidden): {linked_posts}")
else:
    print("❌ No posts found")

print()
print("=" * 60)
print("🎯 EXPECTED FEED CONTENT")
print("=" * 60)
print(f"✅ Unclustered notes (IDEAS): {unclustered if notes.data else 0}")
print(f"✅ Clusters (2+ notes): {visible_clusters if clusters.data else 0}")
print(f"✅ Standard posts: {standard_posts if posts.data else 0}")
print()
print("=" * 60)
