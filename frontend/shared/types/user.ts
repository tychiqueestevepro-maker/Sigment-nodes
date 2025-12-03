/**
 * User types and interfaces
 */

export interface User {
    id: string
    email: string
    name?: string
    first_name?: string
    last_name?: string
    role?: 'OWNER' | 'BOARD' | 'MEMBER' | 'admin' | 'employee' | string
    job_title?: string
    avatar_url?: string
    created_at?: string
}

export interface UserContextType {
    user: User | null
    isLoading: boolean
    isAuthenticated: boolean
    login: (email: string, password: string) => Promise<void>
    logout: () => Promise<void>
    updateUser: (updates: Partial<User>) => Promise<void>
}
