#!/usr/bin/env python3
"""
Diagnostic Complet Backend - Vélocité et Corrélation des Notes
Analyse le traitement des notes, leur clustering, et la performance du système
"""
import os
import sys
from dotenv import load_dotenv
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
load_dotenv()

from supabase import create_client

def parse_datetime(date_str):
    """Parse datetime string with microseconds handling"""
    if not date_str:
        return None
    try:
        date_str = date_str.replace('Z', '+00:00')
        # Tronquer les microsecondes à 6 chiffres max
        if '.' in date_str:
            parts = date_str.split('.')
            microseconds = parts[1].split('+')[0][:6]
            date_str = f"{parts[0]}.{microseconds}+00:00"
        return datetime.fromisoformat(date_str)
    except:
        return None

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

print("=" * 80)
print("🔬 DIAGNOSTIC COMPLET BACKEND - VÉLOCITÉ & CORRÉLATION")
print("=" * 80)
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

# ============================================
# 1. ANALYSE DES NOTES (Toutes)
# ============================================
print("=" * 80)
print("📝 1. ANALYSE COMPLÈTE DES NOTES")
print("=" * 80)

notes = supabase.table("notes").select(
    "id, content_raw, content_clarified, status, cluster_id, pillar_id, ai_relevance_score, created_at, processed_at, embedding"
).eq("organization_id", org_id).order("created_at", desc=False).execute()

if notes.data:
    print(f"✅ Total des notes : {len(notes.data)}")
    print()
    
    # Statistiques par statut
    status_counts = {}
    for note in notes.data:
        status = note.get("status", "unknown")
        status_counts[status] = status_counts.get(status, 0) + 1
    
    print("📊 Répartition par statut :")
    for status, count in sorted(status_counts.items()):
        emoji = {"draft": "📝", "processing": "⚙️", "processed": "✅", "refused": "❌"}.get(status, "❓")
        print(f"   {emoji} {status:15} : {count:3}")
    print()
    
    # Détails de chaque note
    print("📋 DÉTAILS DE CHAQUE NOTE :")
    print("-" * 80)
    
    for i, note in enumerate(notes.data, 1):
        note_id = note["id"]
        status = note.get("status", "unknown")
        created_at = parse_datetime(note.get("created_at"))
        processed_at = parse_datetime(note.get("processed_at"))
        
        # Calculer la vélocité (temps de traitement)
        if processed_at and created_at:
            velocity = (processed_at - created_at).total_seconds()
            velocity_display = f"{velocity:.2f}s"
        else:
            velocity = None
            velocity_display = "N/A"
        
        # Informations sur le clustering
        cluster_id = note.get("cluster_id", "N/A")
        cluster_display = f"{cluster_id[:8]}..." if cluster_id != "N/A" else "❌ Non clustérisée"
        
        # Pillar
        pillar_id = note.get("pillar_id", "N/A")
        
        # Score de pertinence
        relevance = note.get("ai_relevance_score", "N/A")
        relevance_display = f"{relevance:.1f}/10" if relevance != "N/A" else "N/A"
        
        # Embedding
        has_embedding = "✅" if note.get("embedding") else "❌"
        
        # Contenu
        content_raw = note.get("content_raw", "")[:60]
        content_clarified = note.get("content_clarified", "N/A")[:60] if note.get("content_clarified") else "N/A"
        
        status_emoji = {"draft": "📝", "processing": "⚙️", "processed": "✅", "refused": "❌"}.get(status, "❓")
        
        print(f"\n{status_emoji} NOTE #{i} [{note_id[:8]}...]")
        print(f"   Statut          : {status}")
        print(f"   Créée           : {created_at.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"   Traitée         : {processed_at.strftime('%Y-%m-%d %H:%M:%S') if processed_at else 'N/A'}")
        print(f"   ⚡ VÉLOCITÉ     : {velocity_display}")
        print(f"   Cluster         : {cluster_display}")
        print(f"   Pillar          : {pillar_id[:8] if pillar_id != 'N/A' else 'N/A'}...")
        print(f"   Score Pertinence: {relevance_display}")
        print(f"   Embedding       : {has_embedding}")
        print(f"   Contenu brut    : {content_raw}...")
        print(f"   Contenu clarifié: {content_clarified}...")
    
    print()
    print("-" * 80)
    
    # Statistiques de vélocité
    velocities = []
    for note in notes.data:
        if note.get("processed_at") and note.get("created_at"):
            created = parse_datetime(note.get("created_at"))
            processed = parse_datetime(note.get("processed_at"))
            if created and processed:  # Vérifier que les deux ne sont pas None
                velocity = (processed - created).total_seconds()
                velocities.append(velocity)
    
    if velocities:
        avg_velocity = sum(velocities) / len(velocities)
        min_velocity = min(velocities)
        max_velocity = max(velocities)
        
        print(f"\n⚡ STATISTIQUES DE VÉLOCITÉ :")
        print(f"   Moyenne : {avg_velocity:.2f}s")
        print(f"   Min     : {min_velocity:.2f}s")
        print(f"   Max     : {max_velocity:.2f}s")
        print()
    
else:
    print("❌ Aucune note trouvée")
    print()

# ============================================
# 2. ANALYSE DES CLUSTERS
# ============================================
print("=" * 80)
print("📚 2. ANALYSE DES CLUSTERS")
print("=" * 80)

clusters = supabase.table("clusters").select(
    "id, title, note_count, pillar_id, created_at, last_updated_at"
).eq("organization_id", org_id).order("created_at", desc=False).execute()

if clusters.data:
    print(f"✅ Total des clusters : {len(clusters.data)}")
    print()
    
    for i, cluster in enumerate(clusters.data, 1):
        cluster_id = cluster["id"]
        title = cluster.get("title", "Untitled")
        note_count = cluster.get("note_count", 0)
        created_at = parse_datetime(cluster.get("created_at"))
        last_updated = parse_datetime(cluster.get("last_updated_at"))
        
        # Récupérer les notes de ce cluster
        cluster_notes = [n for n in notes.data if n.get("cluster_id") == cluster_id]
        
        print(f"\n📦 CLUSTER #{i} [{cluster_id[:8]}...]")
        print(f"   Titre           : {title}")
        print(f"   Nombre de notes : {note_count}")
        print(f"   Créé            : {created_at.strftime('%Y-%m-%d %H:%M:%S') if created_at else 'N/A'}")
        print(f"   Dernière MAJ    : {last_updated.strftime('%Y-%m-%d %H:%M:%S') if last_updated else 'N/A'}")
        
        if cluster_notes:
            print(f"   Notes associées :")
            for note in cluster_notes:
                note_id = note["id"][:8]
                content = note.get("content_raw", "")[:40]
                print(f"      • [{note_id}...] {content}...")
    
    print()
else:
    print("❌ Aucun cluster trouvé")
    print()

# ============================================
# 3. ANALYSE DE CORRÉLATION
# ============================================
print("=" * 80)
print("🔗 3. ANALYSE DE CORRÉLATION ENTRE NOTES")
print("=" * 80)

if len(notes.data) >= 2:
    print(f"✅ {len(notes.data)} notes disponibles pour analyse de corrélation")
    print()
    
    # Grouper par cluster
    clustered_notes = {}
    for note in notes.data:
        cluster_id = note.get("cluster_id")
        if cluster_id:
            if cluster_id not in clustered_notes:
                clustered_notes[cluster_id] = []
            clustered_notes[cluster_id].append(note)
    
    # Vérifier s'il y a des notes dans le même cluster
    has_correlated = any(len(notes_list) >= 2 for notes_list in clustered_notes.values())
    
    if has_correlated:
        print("📊 NOTES CORRÉLÉES (dans le même cluster) :")
        print()
        
        for cluster_id, cluster_notes_list in clustered_notes.items():
            if len(cluster_notes_list) >= 2:
                cluster_info = next((c for c in clusters.data if c["id"] == cluster_id), None)
                cluster_title = cluster_info.get("title", "Untitled") if cluster_info else "Unknown"
                
                print(f"🔗 CLUSTER: {cluster_title} [{cluster_id[:8]}...]")
                print(f"   Nombre de notes corrélées : {len(cluster_notes_list)}")
                print()
                
                for note in cluster_notes_list:
                    note_id = note["id"][:8]
                    content = note.get("content_raw", "")[:50]
                    relevance = note.get("ai_relevance_score", "N/A")
                    relevance_display = f"{relevance:.1f}/10" if relevance != "N/A" else "N/A"
                    
                    print(f"      • [{note_id}...] Score: {relevance_display}")
                    print(f"        {content}...")
                    print()
                
                # Calculer la similarité moyenne (si on a les embeddings)
                embeddings = [n.get("embedding") for n in cluster_notes_list if n.get("embedding")]
                if len(embeddings) >= 2:
                    print(f"   ✅ Embeddings disponibles pour {len(embeddings)} notes")
                    print(f"   💡 Ces notes ont été jugées similaires par l'IA")
                print()
    else:
        print("⚠️  AUCUNE NOTE CORRÉLÉE - Toutes les notes sont dans des clusters séparés")
        print()
    
    # ============================================
    # ANALYSE DE SIMILARITÉ SÉMANTIQUE
    # ============================================
    print("=" * 80)
    print("🧬 ANALYSE DE SIMILARITÉ SÉMANTIQUE (Embeddings)")
    print("=" * 80)
    print()
    
    # Récupérer les notes avec embeddings
    notes_with_embeddings = [n for n in notes.data if n.get("embedding")]
    
    if len(notes_with_embeddings) >= 2:
        print(f"✅ {len(notes_with_embeddings)} notes avec embeddings disponibles")
        print()
        
        # Fonction pour calculer la similarité cosinus
        def cosine_similarity(vec1, vec2):
            """Calcule la similarité cosinus entre deux vecteurs"""
            import math
            dot_product = sum(a * b for a, b in zip(vec1, vec2))
            magnitude1 = math.sqrt(sum(a * a for a in vec1))
            magnitude2 = math.sqrt(sum(b * b for b in vec2))
            if magnitude1 == 0 or magnitude2 == 0:
                return 0
            return dot_product / (magnitude1 * magnitude2)
        
        # Calculer la similarité entre toutes les paires
        print("📊 MATRICE DE SIMILARITÉ :")
        print()
        
        for i, note1 in enumerate(notes_with_embeddings):
            for j, note2 in enumerate(notes_with_embeddings):
                if i < j:  # Éviter les doublons et la comparaison avec soi-même
                    embedding1 = note1.get("embedding")
                    embedding2 = note2.get("embedding")
                    
                    # Convertir les embeddings si nécessaire (Supabase les stocke parfois comme strings)
                    if isinstance(embedding1, str):
                        import json
                        embedding1 = json.loads(embedding1) if embedding1.startswith('[') else eval(embedding1)
                    if isinstance(embedding2, str):
                        import json
                        embedding2 = json.loads(embedding2) if embedding2.startswith('[') else eval(embedding2)
                    
                    if embedding1 and embedding2:
                        similarity = cosine_similarity(embedding1, embedding2)
                        similarity_pct = similarity * 100
                        
                        # Déterminer le niveau de similarité
                        if similarity >= 0.85:
                            level = "🟢 TRÈS HAUTE"
                            explanation = "Ces notes devraient être dans le même cluster"
                        elif similarity >= 0.75:
                            level = "🟡 HAUTE"
                            explanation = "Similarité au-dessus du seuil (0.75)"
                        elif similarity >= 0.60:
                            level = "🟠 MOYENNE"
                            explanation = "Similarité modérée, clusters séparés justifiés"
                        else:
                            level = "🔴 FAIBLE"
                            explanation = "Notes très différentes, clusters séparés normaux"
                        
                        note1_id = note1["id"][:8]
                        note2_id = note2["id"][:8]
                        note1_content = note1.get("content_raw", "")[:40]
                        note2_content = note2.get("content_raw", "")[:40]
                        
                        cluster1 = note1.get("cluster_id", "N/A")[:8] if note1.get("cluster_id") else "N/A"
                        cluster2 = note2.get("cluster_id", "N/A")[:8] if note2.get("cluster_id") else "N/A"
                        same_cluster = cluster1 == cluster2 and cluster1 != "N/A"
                        
                        print(f"🔗 NOTE [{note1_id}...] ↔️ NOTE [{note2_id}...]")
                        print(f"   Similarité : {similarity_pct:.2f}% ({level})")
                        print(f"   Cluster #1 : {cluster1}...")
                        print(f"   Cluster #2 : {cluster2}...")
                        print(f"   Même cluster : {'✅ OUI' if same_cluster else '❌ NON'}")
                        print(f"   💡 {explanation}")
                        print()
                        print(f"   Note 1 : {note1_content}...")
                        print(f"   Note 2 : {note2_content}...")
                        print()
                        print("-" * 80)
                        print()
        
        print()
    else:
        print(f"⚠️  Seulement {len(notes_with_embeddings)} note(s) avec embeddings")
        print("   → Impossible de calculer la similarité")
        print()
    
    # Notes non corrélées
    unclustered = [n for n in notes.data if not n.get("cluster_id")]
    if unclustered:
        print(f"⚠️  NOTES NON CLUSTÉRISÉES : {len(unclustered)}")
        for note in unclustered:
            note_id = note["id"][:8]
            content = note.get("content_raw", "")[:50]
            print(f"   • [{note_id}...] {content}...")
        print()
else:
    print(f"⚠️  Seulement {len(notes.data)} note(s) - Minimum 2 notes requises pour l'analyse de corrélation")
    print()

# ============================================
# 4. ANALYSE DES PILLARS
# ============================================
print("=" * 80)
print("🏛️  4. ANALYSE DES PILLARS")
print("=" * 80)

pillars = supabase.table("pillars").select("id, name, description, color").eq(
    "organization_id", org_id
).execute()

if pillars.data:
    print(f"✅ Total des pillars : {len(pillars.data)}")
    print()
    
    for pillar in pillars.data:
        pillar_id = pillar["id"]
        name = pillar.get("name", "Unnamed")
        description = pillar.get("description", "N/A")
        color = pillar.get("color", "N/A")
        
        # Compter les notes dans ce pillar
        pillar_notes = [n for n in notes.data if n.get("pillar_id") == pillar_id]
        
        print(f"📌 {name} [{pillar_id[:8]}...]")
        print(f"   Description : {description}")
        print(f"   Couleur     : {color}")
        print(f"   Notes       : {len(pillar_notes)}")
        print()
else:
    print("❌ Aucun pillar trouvé")
    print()

# ============================================
# 5. RÉSUMÉ GLOBAL
# ============================================
print("=" * 80)
print("📊 5. RÉSUMÉ GLOBAL")
print("=" * 80)

total_notes = len(notes.data)
processed_notes = len([n for n in notes.data if n.get("status") == "processed"])
clustered_notes = len([n for n in notes.data if n.get("cluster_id")])
total_clusters = len(clusters.data)
clusters_with_multiple = len([c for c in clusters.data if c.get("note_count", 0) >= 2])

print(f"📝 Notes totales          : {total_notes}")
print(f"✅ Notes traitées         : {processed_notes}")
print(f"🔗 Notes clustérisées     : {clustered_notes}")
print(f"📦 Clusters totaux        : {total_clusters}")
print(f"🎯 Clusters actifs (2+)   : {clusters_with_multiple}")

if velocities:
    print(f"⚡ Vélocité moyenne       : {avg_velocity:.2f}s")

print()

# ============================================
# 6. RECOMMANDATIONS
# ============================================
print("=" * 80)
print("💡 6. RECOMMANDATIONS")
print("=" * 80)

if total_notes == 0:
    print("⚠️  Aucune note dans le système")
    print("   → Soumettez des notes pour tester le système")
elif processed_notes < total_notes:
    pending = total_notes - processed_notes
    print(f"⚠️  {pending} note(s) en attente de traitement")
    print("   → Vérifiez que le worker Celery fonctionne")
elif clustered_notes < processed_notes:
    unclustered = processed_notes - clustered_notes
    print(f"⚠️  {unclustered} note(s) traitée(s) mais non clustérisée(s)")
    print("   → Cela peut être normal si les notes sont très différentes")
else:
    print("✅ Toutes les notes sont traitées et clustérisées !")
    print("   → Le système fonctionne correctement")

print()
print("=" * 80)
print("✅ DIAGNOSTIC TERMINÉ")
print("=" * 80)
