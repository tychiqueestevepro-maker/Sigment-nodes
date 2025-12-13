-- Mettre à jour les groupes existants pour les convertir en projets
-- ATTENTION: Cette commande va convertir TOUS les groupes dont le nom contient certains mots-clés
-- Modifiez la condition WHERE selon vos besoins

-- Option 1: Convertir un groupe spécifique par son nom
UPDATE idea_groups 
SET is_project = TRUE 
WHERE name LIKE '%Boost Team Efficiency%';

-- Option 2: Convertir tous les groupes en projets (ATTENTION!)
-- UPDATE idea_groups SET is_project = TRUE;

-- Vérifier le résultat
SELECT id, name, is_project FROM idea_groups ORDER BY created_at DESC;
