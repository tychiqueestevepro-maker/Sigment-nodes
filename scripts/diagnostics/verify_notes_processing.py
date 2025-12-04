"""
Script de vérification du traitement des notes
Utilise le backend existant pour accéder à Supabase
"""
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from app.services.supabase_client import supabase
from datetime import datetime, timedelta

print("=" * 80)
print("📊 VÉRIFICATION DU TRAITEMENT DES NOTES")
print("=" * 80)
print()

# 1. Statistiques globales
print("1️⃣  STATISTIQUES GLOBALES")
print("-" * 80)

try:
    # Compter les notes par statut
    notes_response = supabase.table("notes").select("id, status, title_clarified, content_clarified, created_at").execute()
    notes = notes_response.data
    
    total_notes = len(notes)
    status_counts = {}
    
    for note in notes:
        status = note.get("status", "unknown")
        status_counts[status] = status_counts.get(status, 0) + 1
    
    print(f"📝 Total des notes : {total_notes}")
    print()
    print("Répartition par statut :")
    for status, count in sorted(status_counts.items()):
        percentage = (count / total_notes * 100) if total_notes > 0 else 0
        print(f"  • {status:15} : {count:3} ({percentage:5.1f}%)")
    
    print()
    
except Exception as e:
    print(f"❌ Erreur lors de la récupération des statistiques : {e}")
    print()

# 2. Notes avec titre clarified
print("2️⃣  NOTES AVEC TITRE CLARIFIED")
print("-" * 80)

try:
    notes_with_title = [n for n in notes if n.get("title_clarified")]
    notes_without_title = [n for n in notes if not n.get("title_clarified") and n.get("status") == "processed"]
    
    print(f"✅ Notes avec titre clarified : {len(notes_with_title)}")
    print(f"⚠️  Notes traitées SANS titre  : {len(notes_without_title)}")
    print()
    
    if notes_with_title:
        print("Exemples de titres générés :")
        for note in notes_with_title[:5]:
            title = note.get("title_clarified", "")
            created = note.get("created_at", "")[:19]
            print(f"  • [{created}] {title}")
        print()
    
    if notes_without_title:
        print("⚠️  Notes traitées sans titre (anciennes notes) :")
        for note in notes_without_title[:5]:
            content = note.get("content_clarified", "")[:60] if note.get("content_clarified") else "N/A"
            created = note.get("created_at", "")[:19]
            print(f"  • [{created}] {content}...")
        print()
    
except Exception as e:
    print(f"❌ Erreur : {e}")
    import traceback
    traceback.print_exc()
    print()

# 3. Notes récentes (dernières 24h)
print("3️⃣  NOTES RÉCENTES (dernières 24h)")
print("-" * 80)

try:
    # Notes des dernières 24h
    cutoff_time = (datetime.now() - timedelta(hours=24)).isoformat()
    recent_notes = supabase.table("notes").select(
        "id, status, title_clarified, content_clarified, created_at, processed_at"
    ).gte("created_at", cutoff_time).execute()
    
    recent = recent_notes.data
    
    if recent:
        print(f"📅 {len(recent)} note(s) créée(s) dans les dernières 24h")
        print()
        
        for note in recent:
            note_id = note["id"][:8]
            status = note.get("status", "unknown")
            title = note.get("title_clarified", "N/A")
            created = note.get("created_at", "")[:19]
            processed = note.get("processed_at", "N/A")[:19] if note.get("processed_at") else "N/A"
            
            status_emoji = {
                "draft": "📝",
                "processing": "⚙️",
                "processed": "✅",
                "refused": "❌"
            }.get(status, "❓")
            
            print(f"{status_emoji} [{note_id}] {status:12}")
            print(f"   Créée     : {created}")
            print(f"   Traitée   : {processed}")
            print(f"   Titre     : {title}")
            print()
    else:
        print("ℹ️  Aucune note récente")
        print()
    
except Exception as e:
    print(f"❌ Erreur : {e}")
    import traceback
    traceback.print_exc()
    print()

# 4. Vérification de la structure de la table
print("4️⃣  VÉRIFICATION DE LA STRUCTURE")
print("-" * 80)

try:
    # Vérifier si le champ title_clarified existe
    sample_note = supabase.table("notes").select("*").limit(1).execute()
    
    if sample_note.data:
        fields = sample_note.data[0].keys()
        
        required_fields = ["title_clarified", "content_clarified", "status"]
        
        print("Champs requis :")
        for field in required_fields:
            exists = field in fields
            emoji = "✅" if exists else "❌"
            print(f"  {emoji} {field}")
        print()
    
except Exception as e:
    print(f"❌ Erreur : {e}")
    import traceback
    traceback.print_exc()
    print()

# 5. Recommandations
print("5️⃣  RECOMMANDATIONS")
print("-" * 80)

try:
    if notes_without_title:
        print("⚠️  Action requise :")
        print(f"   • {len(notes_without_title)} note(s) traitée(s) n'ont pas de titre")
        print("   • Ces notes ont été traitées AVANT l'ajout du champ title_clarified")
        print("   • Elles afficheront 'Untitled Idea' dans le feed")
        print()
        print("💡 Solutions :")
        print("   1. Laisser tel quel (les nouvelles notes auront un titre)")
        print("   2. Créer un script de migration pour retraiter ces notes")
        print()
    else:
        print("✅ Toutes les notes traitées ont un titre !")
        print()
except:
    pass

print("=" * 80)
print("✅ VÉRIFICATION TERMINÉE")
print("=" * 80)
