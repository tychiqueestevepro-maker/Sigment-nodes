-- Vérifier tous les groupes et leur statut is_project
SELECT 
    id,
    name,
    is_project,
    created_at,
    updated_at
FROM idea_groups
ORDER BY created_at DESC
LIMIT 10;
