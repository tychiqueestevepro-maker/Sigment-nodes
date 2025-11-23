-- Insert default pillars into Supabase
-- Execute this in your Supabase SQL Editor to ensure pillars exist

INSERT INTO pillars (name, description, color) VALUES
    ('ESG', 'Environmental, Social, and Governance initiatives', '#10B981'),
    ('Innovation', 'Product innovation and R&D ideas', '#6366F1'),
    ('Operations', 'Operational efficiency and process improvements', '#F59E0B'),
    ('Customer Experience', 'Customer satisfaction and service quality', '#EC4899'),
    ('Culture & HR', 'Employee experience and organizational culture', '#8B5CF6'),
    ('Finance', 'Financial planning and budget optimization', '#8B5CF6'),
    ('Tech', 'Technology infrastructure and digital transformation', '#06B6D4')
ON CONFLICT (name) DO NOTHING;

-- Verify pillars were created
SELECT * FROM pillars ORDER BY name;

