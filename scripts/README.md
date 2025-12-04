# Scripts Directory

Organisation des scripts par catégorie.

## 📁 Structure

### `/apply` - Scripts d'application
Scripts pour appliquer des migrations SQL et des changements à la base de données.

### `/debug` - Scripts de débogage
Scripts pour déboguer et vérifier l'état du système.

### `/diagnostics` - Scripts de diagnostic
Scripts d'analyse approfondie du système (vélocité, corrélation, performance).

## 📋 Index des Scripts

### Apply Scripts
- `apply_migration.py` - Applique les migrations de base de données
- `apply_sql_updates.sh` - Applique les mises à jour SQL via shell
- `execute_sql.py` - Exécute des requêtes SQL directement

### Debug Scripts
- `debug_feed.py` - Débogue le feed unifié
- `debug_auth.py` - Débogue l'authentification
- `check_config.py` - Vérifie la configuration

### Diagnostic Scripts
- `diagnostic_backend.py` - Diagnostic complet (vélocité, corrélation, similarité)
- `verify_notes_processing.py` - Vérifie le traitement des notes
- `test_backend.py` - Tests du backend

## 🚀 Usage

```bash
# Appliquer une migration
python3 scripts/apply/apply_migration.py

# Déboguer le feed
python3 scripts/debug/debug_feed.py

# Diagnostic complet
python3 scripts/diagnostics/diagnostic_backend.py
```
