/**
 * Organization types and interfaces
 */

export type UserRole = 'OWNER' | 'BOARD' | 'MEMBER'

export interface Organization {
    id: string
    slug: string
    name: string
    description?: string
    logo_url?: string
    settings?: Record<string, any>
    created_at: string
    updated_at: string
}

export interface Membership {
    organization: Organization
    role: UserRole
    joined_at: string
}

export interface OrganizationAccess {
    organization: Organization
    role: UserRole
    permissions: string[]
}

export interface OrganizationContextType {
    organization: Organization | null
    userRole: UserRole | null
    permissions: string[]
    isLoading: boolean
    hasPermission: (permission: string) => boolean
    switchOrganization: (orgSlug: string) => Promise<void>
}
