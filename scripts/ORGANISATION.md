# 📁 Organisation du Projet

Ce projet a été réorganisé pour une meilleure structure et maintenabilité.

## 🗂️ Structure des Dossiers

```
Sigment-nodes/
├── 📂 scripts/              # Scripts utilitaires
│   ├── apply/              # Scripts d'application (migrations SQL)
│   ├── debug/              # Scripts de débogage
│   └── diagnostics/        # Scripts de diagnostic système
│
├── 📂 results/              # Résultats et rapports
│   └── diagnostics/        # Rapports de diagnostic
│
├── 📂 docs/                 # Documentation
│   └── guides/             # Guides et tutoriels
│
├── 📂 backend/              # Code backend (FastAPI)
├── 📂 frontend/             # Code frontend (Next.js)
├── 📂 database/             # Schémas et migrations SQL
└── 📄 cleanup_duplicates.py # Script de nettoyage
```

## 🚀 Scripts Disponibles

### Scripts d'Application (`scripts/apply/`)
- `apply_migration.py` - Applique les migrations de base de données
- `apply_sql_updates.sh` - Applique les mises à jour SQL
- `execute_sql.py` - Exécute des requêtes SQL directement

### Scripts de Debug (`scripts/debug/`)
- `debug_feed.py` - Débogue le feed unifié
- `debug_auth.py` - Débogue l'authentification
- `check_config.py` - Vérifie la configuration

### Scripts de Diagnostic (`scripts/diagnostics/`)
- `diagnostic_backend.py` - **Diagnostic complet** (vélocité, corrélation, similarité)
- `verify_notes_processing.py` - Vérifie le traitement des notes
- `test_backend.py` - Tests du backend

## 📊 Résultats Disponibles

Les résultats des diagnostics sont sauvegardés dans `results/diagnostics/` :
- `diagnostic_complet_20251204.txt` - Rapport complet du diagnostic

## 📚 Documentation

Les guides sont disponibles dans `docs/guides/` :
- `GUIDE_MIGRATION_TITRE.md` - Guide pour appliquer les migrations de titre
- `IMPLEMENTATION_TITRE_CLARIFIED.md` - Documentation de l'implémentation
- `CORRECTION_AFFICHAGE_IDEES.md` - Corrections de l'affichage des idées

## 🧹 Nettoyage

Pour supprimer les fichiers dupliqués à la racine :

```bash
python3 cleanup_duplicates.py
```

Ce script supprimera les fichiers originaux qui ont été copiés dans les dossiers organisés.

## ⚡ Usage Rapide

```bash
# Diagnostic complet
python3 scripts/diagnostics/diagnostic_backend.py

# Debug du feed
python3 scripts/debug/debug_feed.py

# Appliquer une migration
python3 scripts/apply/apply_migration.py
```

---

**Note** : Tous les scripts nécessitent l'environnement virtuel Python activé.
