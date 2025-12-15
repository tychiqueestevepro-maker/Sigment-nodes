-- Migration: Applications/Tools Management
-- Date: 2025-12-15
-- Description: Adds tables for managing application library and project tools

-- 1. Enum for Categories to ensure data consistency
DO $$ BEGIN
    CREATE TYPE app_category AS ENUM (
        'Software Engineering',
        'Cloud & Infrastructure',
        'Data & Analytics',
        'Product & UX',
        'Automation & AI',
        'Sales',
        'Marketing',
        'Collaboration',
        'Project & Operations'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Enum for Application Status/Type
DO $$ BEGIN
    CREATE TYPE app_status AS ENUM ('CERTIFIED', 'COMMUNITY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. The Main Application Library Table
CREATE TABLE IF NOT EXISTS applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Core Fields
    name TEXT NOT NULL,
    url TEXT NOT NULL, -- The unique key for logic (e.g., slack.com)
    description TEXT,
    logo_url TEXT,
    category app_category NOT NULL,
    
    -- Status & Logic
    status app_status NOT NULL DEFAULT 'COMMUNITY',
    
    -- Scoping Logic
    -- If organization_id is NULL, it's a "Global/Certified" app visible to everyone.
    -- If organization_id is SET, it's a "Community" app visible only to that org.
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Constraints
    -- Prevent duplicate URLs within the same organization
    CONSTRAINT unique_url_per_scope UNIQUE NULLS NOT DISTINCT (url, organization_id)
);

-- 4. Junction Table: Which Organization uses which App?
CREATE TABLE IF NOT EXISTS organization_installed_apps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    installed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(organization_id, application_id)
);

-- 5. Junction Table: Project Usage
-- "Savoir quels outils sont utilisés, par qui, pour quels projets"
CREATE TABLE IF NOT EXISTS project_tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    added_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Tool status within project (active = currently used, planned = to be added)
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'planned')),
    note TEXT, -- Why this tool is used / context
    
    UNIQUE(project_id, application_id)
);

-- 6. Tool Connections (Integrations between tools)
CREATE TABLE IF NOT EXISTS tool_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    source_tool_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    target_tool_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    
    -- Connection metadata
    label TEXT, -- e.g., "Commit & Push", "Auto-Deploy", "Sync Leads"
    is_active BOOLEAN DEFAULT true,
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Prevent duplicate connections
    UNIQUE(project_id, source_tool_id, target_tool_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_apps_name ON applications(name);
CREATE INDEX IF NOT EXISTS idx_apps_url ON applications(url);
CREATE INDEX IF NOT EXISTS idx_apps_category ON applications(category);
CREATE INDEX IF NOT EXISTS idx_apps_organization ON applications(organization_id);
CREATE INDEX IF NOT EXISTS idx_project_tools_project ON project_tools(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tools_app ON project_tools(application_id);
CREATE INDEX IF NOT EXISTS idx_tool_connections_project ON tool_connections(project_id);

-- Seed certified applications (global, visible to all)
-- Delete existing to avoid duplicates, then re-insert
DELETE FROM applications WHERE organization_id IS NULL;

INSERT INTO applications (name, url, description, category, status, organization_id)
VALUES 
    -- ============ 1. Software Engineering ============
    ('GitHub', 'github.com', 'Collaborative code hosting and version control platform.', 'Software Engineering', 'CERTIFIED', NULL),
    ('GitLab', 'gitlab.com', 'Complete DevOps platform for the software development lifecycle.', 'Software Engineering', 'CERTIFIED', NULL),
    ('Jira', 'atlassian.com/software/jira', 'Project tracking and issue management for agile teams.', 'Software Engineering', 'CERTIFIED', NULL),
    ('Docker', 'docker.com', 'Containerization platform for developing and deploying applications.', 'Software Engineering', 'CERTIFIED', NULL),
    ('Postman', 'postman.com', 'API development and testing collaboration platform.', 'Software Engineering', 'CERTIFIED', NULL),
    ('Cursor', 'cursor.com', 'AI-powered code editor for enhanced productivity.', 'Software Engineering', 'CERTIFIED', NULL),
    ('VS Code', 'code.visualstudio.com', 'Lightweight and powerful open source code editor by Microsoft.', 'Software Engineering', 'CERTIFIED', NULL),

    -- ============ 2. Cloud & Infrastructure ============
    ('AWS', 'aws.amazon.com', 'Amazon cloud services for compute, storage and more.', 'Cloud & Infrastructure', 'CERTIFIED', NULL),
    ('Google Cloud Platform', 'cloud.google.com', 'Google cloud infrastructure for enterprise applications.', 'Cloud & Infrastructure', 'CERTIFIED', NULL),
    ('Microsoft Azure', 'azure.microsoft.com', 'Microsoft cloud platform for hosting and services.', 'Cloud & Infrastructure', 'CERTIFIED', NULL),
    ('Vercel', 'vercel.com', 'Deployment platform optimized for modern frontend frameworks.', 'Cloud & Infrastructure', 'CERTIFIED', NULL),
    ('Cloudflare', 'cloudflare.com', 'CDN, web security and performance services.', 'Cloud & Infrastructure', 'CERTIFIED', NULL),
    ('Netlify', 'netlify.com', 'Automated deployment platform for modern websites.', 'Cloud & Infrastructure', 'CERTIFIED', NULL),
    ('Railway', 'railway.app', 'Simplified app and database deployment.', 'Cloud & Infrastructure', 'CERTIFIED', NULL),

    -- ============ 3. Data & Analytics ============
    ('BigQuery', 'cloud.google.com/bigquery', 'Serverless data warehouse for large-scale analytics.', 'Data & Analytics', 'CERTIFIED', NULL),
    ('Snowflake', 'snowflake.com', 'Cloud data platform for analytics and data warehousing.', 'Data & Analytics', 'CERTIFIED', NULL),
    ('Looker', 'looker.com', 'Business intelligence and data visualization platform.', 'Data & Analytics', 'CERTIFIED', NULL),
    ('Mixpanel', 'mixpanel.com', 'Product analytics to understand user behavior.', 'Data & Analytics', 'CERTIFIED', NULL),
    ('Datadog', 'datadoghq.com', 'Monitoring and observability for cloud infrastructure.', 'Data & Analytics', 'CERTIFIED', NULL),
    ('Amplitude', 'amplitude.com', 'Product analytics platform to optimize engagement.', 'Data & Analytics', 'CERTIFIED', NULL),
    ('Segment', 'segment.com', 'Customer data platform for collection and unification.', 'Data & Analytics', 'CERTIFIED', NULL),
    ('Airtable', 'airtable.com', 'Collaborative database with spreadsheet interface.', 'Data & Analytics', 'CERTIFIED', NULL),

    -- ============ 4. Product & UX ============
    ('Figma', 'figma.com', 'Collaborative design tool for creating user interfaces.', 'Product & UX', 'CERTIFIED', NULL),
    ('FigJam', 'figma.com/figjam', 'Collaborative whiteboard for brainstorming and workshops.', 'Product & UX', 'CERTIFIED', NULL),
    ('Framer', 'framer.com', 'Interactive design and prototyping with animations.', 'Product & UX', 'CERTIFIED', NULL),
    ('Miro', 'miro.com', 'Digital whiteboard for visual team collaboration.', 'Product & UX', 'CERTIFIED', NULL),
    ('Zeplin', 'zeplin.io', 'Design-to-developer handoff tool for specs and assets.', 'Product & UX', 'CERTIFIED', NULL),
    ('Maze', 'maze.co', 'User testing platform to validate designs quickly.', 'Product & UX', 'CERTIFIED', NULL),

    -- ============ 5. Automation & AI ============
    ('OpenAI API', 'openai.com', 'AI API for GPT and language models.', 'Automation & AI', 'CERTIFIED', NULL),
    ('Make', 'make.com', 'Visual automation platform (formerly Integromat).', 'Automation & AI', 'CERTIFIED', NULL),
    ('Zapier', 'zapier.com', 'Workflow automation between SaaS applications.', 'Automation & AI', 'CERTIFIED', NULL),
    ('n8n', 'n8n.io', 'Open source and self-hosted automation platform.', 'Automation & AI', 'CERTIFIED', NULL),
    ('LangChain', 'langchain.com', 'Framework for building LLM-based applications.', 'Automation & AI', 'CERTIFIED', NULL),
    ('Anthropic', 'anthropic.com', 'Claude API for conversational AI and assistants.', 'Automation & AI', 'CERTIFIED', NULL),

    -- ============ 6. Sales ============
    ('Salesforce', 'salesforce.com', 'World-leading CRM for sales and customer relationships.', 'Sales', 'CERTIFIED', NULL),
    ('HubSpot CRM', 'hubspot.com', 'Free CRM with sales, marketing and service tools.', 'Sales', 'CERTIFIED', NULL),
    ('Pipedrive', 'pipedrive.com', 'Sales-focused CRM for pipeline and deal management.', 'Sales', 'CERTIFIED', NULL),
    ('Apollo', 'apollo.io', 'B2B prospecting and sales intelligence platform.', 'Sales', 'CERTIFIED', NULL),
    ('Stripe', 'stripe.com', 'Online payment infrastructure for internet businesses.', 'Sales', 'CERTIFIED', NULL),
    ('Intercom', 'intercom.com', 'Customer messaging and conversational support platform.', 'Sales', 'CERTIFIED', NULL),
    ('Lemlist', 'lemlist.com', 'Personalized email outreach tool for prospecting.', 'Sales', 'CERTIFIED', NULL),

    -- ============ 7. Marketing ============
    ('Google Analytics', 'analytics.google.com', 'Free web analytics for traffic and behavior insights.', 'Marketing', 'CERTIFIED', NULL),
    ('Google Ads', 'ads.google.com', 'Google advertising platform for PPC campaigns.', 'Marketing', 'CERTIFIED', NULL),
    ('Meta Ads Manager', 'business.facebook.com', 'Facebook and Instagram advertising manager.', 'Marketing', 'CERTIFIED', NULL),
    ('SEMrush', 'semrush.com', 'All-in-one marketing suite for SEO, PPC and content.', 'Marketing', 'CERTIFIED', NULL),
    ('HubSpot Marketing', 'hubspot.com/products/marketing', 'Inbound marketing and automation software.', 'Marketing', 'CERTIFIED', NULL),
    ('Mailchimp', 'mailchimp.com', 'Email marketing and automation platform.', 'Marketing', 'CERTIFIED', NULL),

    -- ============ 8. Collaboration & Knowledge ============
    ('Slack', 'slack.com', 'Team messaging and real-time collaboration hub.', 'Collaboration', 'CERTIFIED', NULL),
    ('Notion', 'notion.so', 'All-in-one workspace: notes, docs, wikis and databases.', 'Collaboration', 'CERTIFIED', NULL),
    ('Confluence', 'atlassian.com/software/confluence', 'Enterprise wiki for documentation and knowledge sharing.', 'Collaboration', 'CERTIFIED', NULL),
    ('Microsoft Teams', 'microsoft.com/teams', 'Microsoft collaboration hub with chat, meetings and files.', 'Collaboration', 'CERTIFIED', NULL),
    ('Google Workspace', 'workspace.google.com', 'Google productivity suite: Gmail, Drive, Docs, Meet.', 'Collaboration', 'CERTIFIED', NULL),
    ('Loom', 'loom.com', 'Async video recording for team communication.', 'Collaboration', 'CERTIFIED', NULL),
    ('Discord', 'discord.com', 'Communication platform for communities and teams.', 'Collaboration', 'CERTIFIED', NULL),

    -- ============ 9. Project & Operations ============
    ('Linear', 'linear.app', 'Modern and fast project management for product teams.', 'Project & Operations', 'CERTIFIED', NULL),
    ('ClickUp', 'clickup.com', 'All-in-one productivity platform with project management.', 'Project & Operations', 'CERTIFIED', NULL),
    ('Asana', 'asana.com', 'Work management tool for coordinating projects and tasks.', 'Project & Operations', 'CERTIFIED', NULL),
    ('Monday.com', 'monday.com', 'Work OS platform for project and workflow management.', 'Project & Operations', 'CERTIFIED', NULL),
    ('Trello', 'trello.com', 'Visual project management with Kanban boards.', 'Project & Operations', 'CERTIFIED', NULL),
    ('Basecamp', 'basecamp.com', 'Simple project management and team communication tool.', 'Project & Operations', 'CERTIFIED', NULL)

ON CONFLICT DO NOTHING;

