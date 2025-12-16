-- Update application categories to match frontend filters
-- This ensures the category filters in the Tools Library work correctly

-- Software Engineering
UPDATE applications 
SET category = 'Software Engineering'
WHERE name IN ('GitHub', 'GitLab', 'Bitbucket', 'Jira', 'Linear', 'Sentry', 'Datadog', 'New Relic', 'PagerDuty', 'CircleCI', 'Jenkins', 'Docker', 'Kubernetes');

-- Product & UX
UPDATE applications 
SET category = 'Product & UX'
WHERE name IN ('Figma', 'Miro', 'Notion', 'Confluence', 'ProductBoard', 'Aha!', 'UserTesting', 'Hotjar', 'Mixpanel', 'Amplitude');

-- Data & Analytics
UPDATE applications 
SET category = 'Data & Analytics'
WHERE name IN ('Tableau', 'Looker', 'Power BI', 'Google Analytics', 'Segment', 'Snowflake', 'BigQuery', 'Redshift', 'dbt', 'Airflow', 'Fivetran');

-- AI
UPDATE applications 
SET category = 'AI'
WHERE name IN ('OpenAI', 'Anthropic', 'Claude', 'ChatGPT', 'Midjourney', 'Stable Diffusion', 'Hugging Face', 'Replicate', 'Cohere', 'AI21', 'Jasper', 'Copy.ai', 'Writesonic', 'Runway', 'ElevenLabs');

-- Marketing
UPDATE applications 
SET category = 'Marketing'
WHERE name IN ('HubSpot', 'Marketo', 'Mailchimp', 'SendGrid', 'Intercom', 'Drift', 'Google Ads', 'Facebook Ads', 'LinkedIn Ads', 'SEMrush', 'Ahrefs');

-- Sales
UPDATE applications 
SET category = 'Sales'
WHERE name IN ('Salesforce', 'HubSpot CRM', 'Pipedrive', 'Close', 'Outreach', 'SalesLoft', 'Gong', 'Chorus', 'ZoomInfo', 'Apollo');

-- Operations
UPDATE applications 
SET category = 'Operations'
WHERE name IN ('Asana', 'Monday.com', 'ClickUp', 'Trello', 'Airtable', 'Zapier', 'Make', 'n8n', 'Retool', 'Internal');

-- Finance
UPDATE applications 
SET category = 'Finance'
WHERE name IN ('QuickBooks', 'Xero', 'Stripe', 'Brex', 'Ramp', 'Expensify', 'Bill.com', 'NetSuite', 'Sage');

-- HR
UPDATE applications 
SET category = 'HR'
WHERE name IN ('BambooHR', 'Workday', 'Greenhouse', 'Lever', 'Lattice', 'Culture Amp', 'Gusto', 'Rippling', 'Zenefits', 'ADP');

-- Communication & Collaboration (categorized as Other or Operations)
UPDATE applications 
SET category = 'Operations'
WHERE name IN ('Slack', 'Microsoft Teams', 'Discord', 'Zoom', 'Google Meet', 'Loom');

-- Other (catch-all for tools that don't fit other categories)
UPDATE applications 
SET category = 'Other'
WHERE category NOT IN ('Software Engineering', 'Product & UX', 'Data & Analytics', 'AI', 'Marketing', 'Sales', 'Operations', 'Finance', 'HR');
