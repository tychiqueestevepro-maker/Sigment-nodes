-- Migration to update pillars for Galaxy View
-- Deletes existing pillars and inserts the new strategic pillars

-- 1. Clear existing pillars (Cascade will handle related clusters/notes if any, but be careful in prod)
-- Since this is dev/setup, we can truncate or delete.
DELETE FROM pillars;

-- 2. Insert new pillars
INSERT INTO pillars (name, description, color) VALUES
    ('Operational Efficiency', 'Le "Comment on travaille". Sujets : Processus internes, logistique, réduction des coûts, gain de temps, bureaucratie, workflows.', '#F59E0B'),
    ('Culture & Well-being', 'Le "Humain". Sujets : Vie au bureau, télétravail, management, événements, formation, recrutement, ambiance.', '#8B5CF6'),
    ('Product & Innovation', 'Le "Futur". Sujets : Nouvelles fonctionnalités, R&D, design, nouvelles offres, idées de rupture.', '#6366F1'),
    ('Tech & Tools', 'Le "Moteur". Sujets : Logiciels, matériel informatique, bugs, sécurité, IA, infrastructures réseau.', '#3B82F6'),
    ('Customer Experience', 'Le "Business". Sujets : Satisfaction client, support, ventes, marketing, image de marque.', '#EC4899'),
    ('ESG & Sustainability', 'La "Conscience". Sujets : Environnement, écologie, éthique, diversité, inclusion, impact social.', '#10B981');
