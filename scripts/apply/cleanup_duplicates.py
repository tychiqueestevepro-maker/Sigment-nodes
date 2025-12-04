#!/usr/bin/env python3
"""
Script pour nettoyer les fichiers dupliqués après organisation
Supprime les fichiers originaux qui ont été copiés dans les dossiers organisés
"""
import os
from pathlib import Path

# Répertoire de base
base_dir = Path(__file__).parent

# Fichiers à supprimer (ceux qui ont été copiés)
files_to_remove = [
    # Scripts d'application
    'apply_migration.py',
    'apply_sql_updates.sh',
    'execute_sql.py',
    'apply_unified_feed_sql.py',
    'apply_sql_direct.py',
    'apply_migration_draft.py',
    
    # Scripts de debug
    'debug_auth.py',
    'debug_feed.py',
    'check_config.py',
    'reproduce_login_api.py',
    'test_feed_endpoint.py',
    
    # Scripts de diagnostic
    'diagnostic_backend.py',
    'verify_notes_processing.py',
    'test_backend.py',
    
    # Résultats
    'diagnostic_results.txt',
    'diagnostic_results_full.txt',
    
    # Guides
    'CORRECTION_AFFICHAGE_IDEES.md',
    'GUIDE_MIGRATION_TITRE.md',
    'IMPLEMENTATION_TITRE_CLARIFIED.md',
    'DIAGNOSTIC_REPORT.md',
    'UNIVERSAL_FEED_DEPLOYMENT.md',
    
    # Script d'organisation (lui-même)
    'organize_files.py',
]

print("=" * 80)
print("🧹 NETTOYAGE DES FICHIERS DUPLIQUÉS")
print("=" * 80)
print()
print("⚠️  Ce script va supprimer les fichiers originaux qui ont été copiés")
print("    dans les dossiers organisés (scripts/, results/, docs/)")
print()

# Demander confirmation
response = input("Voulez-vous continuer ? (oui/non): ").lower().strip()

if response not in ['oui', 'o', 'yes', 'y']:
    print("\n❌ Nettoyage annulé")
    exit(0)

print()
print("=" * 80)
print("🗑️  SUPPRESSION DES FICHIERS")
print("=" * 80)
print()

removed = 0
not_found = 0
errors = 0

for filename in files_to_remove:
    filepath = base_dir / filename
    
    if filepath.exists():
        try:
            filepath.unlink()
            print(f"✅ Supprimé: {filename}")
            removed += 1
        except Exception as e:
            print(f"❌ Erreur: {filename} - {e}")
            errors += 1
    else:
        print(f"⚠️  Introuvable: {filename}")
        not_found += 1

print()
print("=" * 80)
print("📊 RÉSUMÉ")
print("=" * 80)
print(f"✅ Fichiers supprimés : {removed}")
print(f"⚠️  Fichiers introuvables : {not_found}")
print(f"❌ Erreurs : {errors}")
print()

if removed > 0:
    print("✅ Nettoyage terminé ! La racine du projet est maintenant propre.")
    print()
    print("📁 Structure organisée :")
    print("   • scripts/apply/       - Scripts d'application SQL")
    print("   • scripts/debug/       - Scripts de débogage")
    print("   • scripts/diagnostics/ - Scripts de diagnostic")
    print("   • results/diagnostics/ - Résultats des diagnostics")
    print("   • docs/guides/         - Documentation et guides")
else:
    print("ℹ️  Aucun fichier à nettoyer")

print()
print("=" * 80)
