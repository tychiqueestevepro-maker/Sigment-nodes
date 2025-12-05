-- ===================================================
-- Migration: Fix Private vs Group Conversations
-- Description: Updates get_or_create_conversation function to properly distinguish
--              between private (1-to-1) and group conversations.
-- 
-- PROBLEM: Quand un utilisateur essayait de démarrer une conversation privée
--          avec quelqu'un qui était déjà dans un groupe commun, le système
--          retournait le groupe au lieu de créer une nouvelle conversation privée.
--
-- SOLUTION: La fonction vérifie maintenant que:
--   1. is_group = FALSE (exclure les conversations de groupe)
--   2. Il y a exactement 2 participants
--   3. Les 2 participants sont l'utilisateur courant et l'utilisateur cible
-- ===================================================

-- Drop and recreate the function with proper distinction
CREATE OR REPLACE FUNCTION get_or_create_conversation(
    p_organization_id UUID,
    p_target_user_id UUID,
    p_current_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_conversation_id UUID;
BEGIN
    -- 1. Vérifier que le target user est bien dans la même organisation
    IF NOT EXISTS (
        SELECT 1 FROM memberships 
        WHERE user_id = p_target_user_id AND organization_id = p_organization_id
    ) THEN
        RAISE EXCEPTION 'Target user is not a member of this organization';
    END IF;

    -- 2. Chercher une conversation PRIVÉE existante entre ces 2 utilisateurs
    -- Critères importants:
    --   - is_group = FALSE (exclure les groupes)
    --   - Exactement 2 participants
    --   - Les 2 participants sont current_user et target_user
    SELECT c.id INTO v_conversation_id
    FROM conversations c
    JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
    JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
    WHERE c.organization_id = p_organization_id
      AND c.is_group = FALSE  -- IMPORTANT: Ne chercher que dans les conversations privées
      AND cp1.user_id = p_current_user_id
      AND cp2.user_id = p_target_user_id
      -- Vérifier qu'il y a exactement 2 participants
      AND (
          SELECT COUNT(*) 
          FROM conversation_participants cp 
          WHERE cp.conversation_id = c.id
      ) = 2;

    -- 3. Si trouvée, la retourner
    IF v_conversation_id IS NOT NULL THEN
        RETURN v_conversation_id;
    END IF;

    -- 4. Sinon, créer une nouvelle conversation PRIVÉE
    INSERT INTO conversations (organization_id, is_group)
    VALUES (p_organization_id, FALSE)  -- Marquer explicitement comme conversation privée
    RETURNING id INTO v_conversation_id;

    -- 5. Ajouter les participants
    INSERT INTO conversation_participants (conversation_id, user_id)
    VALUES 
        (v_conversation_id, p_current_user_id),
        (v_conversation_id, p_target_user_id);

    RETURN v_conversation_id;
END;
$$;

-- Optionnel: Mettre à jour les anciennes conversations privées qui n'ont pas is_group défini
-- Cela corrige les données existantes pour marquer correctement les conversations 1-à-1
UPDATE conversations c
SET is_group = FALSE
WHERE is_group IS NULL
  AND (
      SELECT COUNT(*) 
      FROM conversation_participants cp 
      WHERE cp.conversation_id = c.id
  ) = 2;

-- Confirmer que la migration a été appliquée
DO $$
BEGIN
    RAISE NOTICE 'Migration fix_private_vs_group_conversations applied successfully!';
    RAISE NOTICE 'Private conversations are now properly distinguished from group conversations.';
END $$;
