#!/usr/bin/env python3
"""
Instructions pour appliquer la migration user_integrations
"""

print("""
╔══════════════════════════════════════════════════════════════╗
║     MIGRATION: TABLE USER_INTEGRATIONS                       ║
╚══════════════════════════════════════════════════════════════╝

📋 ÉTAPE 1: Ouvrir Supabase SQL Editor
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Allez sur: https://app.supabase.com/project/tkgyfhewbvtkrwcyahdn/editor
2. Cliquez sur "SQL Editor" dans le menu latéral

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 ÉTAPE 2: Copier le contenu du fichier SQL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Fichier: database/add_user_integrations.sql

Le fichier contient:
  ✅ Création de la table user_integrations
  ✅ Indexes pour performance
  ✅ Trigger pour updated_at
  ✅ RLS (Row Level Security) policies
  ✅ Fonctions helper:
     - user_has_integration()
     - get_user_integration_token()

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 ÉTAPE 3: Exécuter le SQL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Collez le contenu dans l'éditeur SQL
2. Cliquez sur "Run" (ou Ctrl/Cmd + Enter)
3. Vérifiez qu'il n'y a pas d'erreurs

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 ÉTAPE 4: Vérifier la table
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Exécutez cette requête pour vérifier:

SELECT 
    table_name, 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'user_integrations'
ORDER BY ordinal_position;

Vous devriez voir:
  ✓ id (uuid)
  ✓ user_id (uuid)
  ✓ platform (character varying)
  ✓ access_token (text)
  ✓ refresh_token (text)
  ✓ expires_at (timestamp with time zone)
  ✓ token_type (character varying)
  ✓ scope (text)
  ✓ team_id (character varying)
  ✓ user_platform_id (character varying)
  ✓ created_at (timestamp with time zone)
  ✓ updated_at (timestamp with time zone)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 ÉTAPE 5: Tester les fonctions helper
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Test 1: Vérifier la fonction user_has_integration

SELECT user_has_integration(
    '00000000-0000-0000-0000-000000000000'::uuid,
    'slack'
);
-- Devrait retourner: false

Test 2: Vérifier les policies RLS

SELECT * FROM user_integrations;
-- Devrait retourner: 0 rows (table vide)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ STRUCTURE DE LA TABLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌─────────────────────┬────────────────────────┬──────────────┐
│ Colonne             │ Type                   │ Description  │
├─────────────────────┼────────────────────────┼──────────────┤
│ id                  │ UUID                   │ Primary Key  │
│ user_id             │ UUID                   │ FK → users   │
│ platform            │ VARCHAR(50)            │ slack|teams  │
│ access_token        │ TEXT                   │ OAuth token  │
│ refresh_token       │ TEXT                   │ Refresh      │
│ expires_at          │ TIMESTAMP              │ Expiration   │
│ token_type          │ VARCHAR(50)            │ Bearer       │
│ scope               │ TEXT                   │ Permissions  │
│ team_id             │ VARCHAR(255)           │ Workspace ID │
│ user_platform_id    │ VARCHAR(255)           │ Platform UID │
│ created_at          │ TIMESTAMP              │ Created      │
│ updated_at          │ TIMESTAMP              │ Updated      │
└─────────────────────┴────────────────────────┴──────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔒 SÉCURITÉ (RLS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Row Level Security activé
✅ Les utilisateurs ne voient que leurs propres tokens
✅ INSERT/UPDATE/DELETE limités à leurs données
✅ Tokens expirés automatiquement ignorés

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 PROCHAINES ÉTAPES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Après avoir appliqué cette migration:
  ☐ Créer les services OAuth (slack_oauth_service.py, teams_oauth_service.py)
  ☐ Créer les routes API (/api/v1/integrations/*)
  ☐ Créer le component frontend (IntegrationButton.tsx)
  ☐ Tester le flux OAuth complet

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📚 RESSOURCES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Fichiers créés:
  📄 database/add_user_integrations.sql
  📄 SLACK_TEAMS_OAUTH2_COMPLETE_GUIDE.md (Guide complet)
  📄 TEAMS_OAUTH2_GUIDE.md
  📄 TEAMS_INTEGRATION_GUIDE.md

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Migration prête à être appliquée !

Supabase SQL Editor:
https://app.supabase.com/project/tkgyfhewbvtkrwcyahdn/editor

╚══════════════════════════════════════════════════════════════╝
""")
