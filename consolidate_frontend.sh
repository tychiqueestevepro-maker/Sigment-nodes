#!/bin/bash

# 1. Créer un dossier d'archive pour les vieux frontends séparés
echo "📦 Création du dossier d'archives..."
mkdir -p _archived_frontends

# 2. Archiver frontend/member (On suppose que le code utile est déjà dans frontend/app/[orgSlug]/member)
if [ -d "frontend/member" ]; then
    echo "mv frontend/member -> _archived_frontends/member"
    mv frontend/member _archived_frontends/
else
    echo "⚠️ frontend/member n'existe pas ou a déjà été déplacé."
fi

# 3. Archiver frontend/board (On suppose que le code utile est déjà dans frontend/app/[orgSlug]/board)
if [ -d "frontend/board" ]; then
    echo "mv frontend/board -> _archived_frontends/board"
    mv frontend/board _archived_frontends/
else
    echo "⚠️ frontend/board n'existe pas ou a déjà été déplacé."
fi

# 4. Nettoyage des backups et fichiers temporaires
echo "🧹 Nettoyage des fichiers temporaires..."
rm -rf frontend_backup_* 2>/dev/null

echo "✅ CONSOLIDATION TERMINÉE."
echo "👉 Votre application est maintenant unifiée dans le dossier 'frontend/'."
echo "   Routes actives :"
echo "   - frontend/app/[orgSlug]/member"
echo "   - frontend/app/[orgSlug]/board"
echo "   - frontend/app/[orgSlug]/owner"
