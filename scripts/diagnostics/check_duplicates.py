#!/usr/bin/env python3
"""
Script pour détecter et supprimer les dossiers/fichiers dupliqués
Analyse: /home/ semble être un doublon de /owner/
"""
import os
import shutil
from pathlib import Path
import filecmp

base_dir = Path("/Users/tychiqueesteve/SIGMENT-NODES/Sigment-nodes/frontend/app/[orgSlug]")

print("=" * 80)
print("🔍 ANALYSE DES DOUBLONS : /home/ vs /owner/")
print("=" * 80)
print()

# Vérifier que les dossiers existent
home_dir = base_dir / "home"
owner_dir = base_dir / "owner"

if not home_dir.exists():
    print("❌ /home/ n'existe pas")
    exit(1)

if not owner_dir.exists():
    print("❌ /owner/ n'existe pas")
    exit(1)

print("✅ Les deux dossiers existent")
print()

# Comparer les structures
print("=" * 80)
print("📊 COMPARAISON DES STRUCTURES")
print("=" * 80)
print()

def compare_directories(dir1, dir2, prefix=""):
    """Compare deux répertoires récursivement"""
    identical_files = []
    different_files = []
    only_in_dir1 = []
    only_in_dir2 = []
    
    # Lister les fichiers
    files1 = set(os.listdir(dir1)) if dir1.exists() else set()
    files2 = set(os.listdir(dir2)) if dir2.exists() else set()
    
    # Fichiers communs
    common = files1 & files2
    only1 = files1 - files2
    only2 = files2 - files1
    
    for name in common:
        path1 = dir1 / name
        path2 = dir2 / name
        rel_path = f"{prefix}/{name}" if prefix else name
        
        if path1.is_dir() and path2.is_dir():
            # Comparer récursivement
            sub_identical, sub_different, sub_only1, sub_only2 = compare_directories(
                path1, path2, rel_path
            )
            identical_files.extend(sub_identical)
            different_files.extend(sub_different)
            only_in_dir1.extend(sub_only1)
            only_in_dir2.extend(sub_only2)
        elif path1.is_file() and path2.is_file():
            # Comparer les fichiers
            if filecmp.cmp(path1, path2, shallow=False):
                identical_files.append(rel_path)
            else:
                different_files.append(rel_path)
    
    for name in only1:
        rel_path = f"{prefix}/{name}" if prefix else name
        only_in_dir1.append(rel_path)
    
    for name in only2:
        rel_path = f"{prefix}/{name}" if prefix else name
        only_in_dir2.append(rel_path)
    
    return identical_files, different_files, only_in_dir1, only_in_dir2

identical, different, only_home, only_owner = compare_directories(home_dir, owner_dir)

print(f"📁 Fichiers identiques : {len(identical)}")
for f in sorted(identical)[:10]:
    print(f"   ✅ {f}")
if len(identical) > 10:
    print(f"   ... et {len(identical) - 10} autres")

print()
print(f"📝 Fichiers différents : {len(different)}")
for f in sorted(different):
    print(f"   ⚠️  {f}")

print()
print(f"📂 Seulement dans /home/ : {len(only_home)}")
for f in sorted(only_home):
    print(f"   🏠 {f}")

print()
print(f"📂 Seulement dans /owner/ : {len(only_owner)}")
for f in sorted(only_owner):
    print(f"   👑 {f}")

print()
print("=" * 80)
print("📊 RÉSUMÉ")
print("=" * 80)

total_files = len(identical) + len(different) + len(only_home) + len(only_owner)
similarity = (len(identical) / total_files * 100) if total_files > 0 else 0

print(f"Similarité : {similarity:.1f}%")
print(f"Total de fichiers analysés : {total_files}")
print()

# Décision
if similarity >= 90:
    print("✅ CONCLUSION : /home/ est un DOUBLON de /owner/")
    print()
    print("💡 RECOMMANDATION : Supprimer /home/ et utiliser uniquement /owner/")
    print()
    
    response = input("Voulez-vous supprimer /home/ ? (oui/non): ").lower().strip()
    
    if response in ['oui', 'o', 'yes', 'y']:
        print()
        print("=" * 80)
        print("🗑️  SUPPRESSION DE /home/")
        print("=" * 80)
        print()
        
        try:
            shutil.rmtree(home_dir)
            print(f"✅ Dossier /home/ supprimé avec succès")
            print()
            print("📋 Actions à faire :")
            print("   1. Vérifier que l'application fonctionne toujours")
            print("   2. Mettre à jour les routes si nécessaire")
            print("   3. Supprimer les références à /home/ dans le code")
        except Exception as e:
            print(f"❌ Erreur lors de la suppression : {e}")
    else:
        print("\n❌ Suppression annulée")
else:
    print("⚠️  CONCLUSION : /home/ et /owner/ ont des différences significatives")
    print("💡 RECOMMANDATION : Analyser manuellement les différences avant de supprimer")

print()
print("=" * 80)
