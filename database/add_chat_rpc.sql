-- Fonction pour récupérer ou créer une conversation privée
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

    -- 2. Chercher une conversation existante entre ces 2 utilisateurs dans cette org
    SELECT c.id INTO v_conversation_id
    FROM conversations c
    JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
    JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
    WHERE c.organization_id = p_organization_id
    AND cp1.user_id = p_current_user_id
    AND cp2.user_id = p_target_user_id;

    -- 3. Si trouvée, la retourner
    IF v_conversation_id IS NOT NULL THEN
        RETURN v_conversation_id;
    END IF;

    -- 4. Sinon, créer une nouvelle conversation
    INSERT INTO conversations (organization_id)
    VALUES (p_organization_id)
    RETURNING id INTO v_conversation_id;

    -- 5. Ajouter les participants
    INSERT INTO conversation_participants (conversation_id, user_id)
    VALUES 
        (v_conversation_id, p_current_user_id),
        (v_conversation_id, p_target_user_id);

    RETURN v_conversation_id;
END;
$$;
