# Moderation Feature Migration Guide

To enable the Mute and Deactivate features, you need to update your Supabase database schema.

## 1. Run SQL Migration
Open your Supabase SQL Editor and run the following SQL command:

```sql
-- Add is_muted and is_deactivated columns to memberships table
ALTER TABLE memberships 
ADD COLUMN IF NOT EXISTS is_muted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_deactivated BOOLEAN DEFAULT FALSE;

-- Add comments for clarity
COMMENT ON COLUMN memberships.is_muted IS 'If true, the member cannot post or comment';
COMMENT ON COLUMN memberships.is_deactivated IS 'If true, the member cannot access the organization';
```

## 2. Verify Implementation
1.  **Backend**: The API endpoints `PATCH /api/members/:id/mute` and `PATCH /api/members/:id/deactivate` are now active.
2.  **Frontend**: 
    *   Go to the **Owner Panel** > **Members**.
    *   Click the "Actions" menu (...) on a member.
    *   You should see "Mute Member" and "Deactivate Account" options (depending on your role and the target's role).
    *   Try muting a member. The menu should update to "Unmute Member".

## 3. Security Rules Implemented
*   **Owners** cannot be muted or deactivated.
*   **Board Members** can only be moderated by the **Owner**.
*   **Members** can be moderated by **Owner** and **Board**.
*   **Members** cannot moderate anyone.
