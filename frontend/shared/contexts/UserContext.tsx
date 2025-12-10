'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { User, UserContextType } from '@/types/user'

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const router = useRouter()

    useEffect(() => {
        // Check if user is authenticated
        checkAuth()
    }, [])

    async function checkAuth() {
        try {
            // Read user data from localStorage (saved during signup)
            const userId = localStorage.getItem('sigment_user_id')
            const userEmail = localStorage.getItem('sigment_user_email')
            const userDataStr = localStorage.getItem('sigment_user')
            const accessToken = localStorage.getItem('access_token')

            if (userId && userDataStr) {
                try {
                    const userData = JSON.parse(userDataStr)
                    const initialUser = {
                        ...userData,
                        id: userId,
                        email: userEmail || userData.email || 'unknown@example.com',
                        name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || userData.name || 'User',
                        created_at: userData.created_at || new Date().toISOString()
                    }
                    setUser(initialUser)

                    // Fetch fresh user data from API to get updated avatar_url and other fields
                    if (accessToken) {
                        try {
                            const orgId = localStorage.getItem('sigment_org_id')
                            const headers: Record<string, string> = {
                                'Authorization': `Bearer ${accessToken}`
                            }
                            if (orgId) {
                                headers['X-Organization-Id'] = orgId
                            }

                            const response = await fetch('/api/v1/users/me', { headers })

                            if (response.ok) {
                                const freshUserData = await response.json()
                                const updatedUser = {
                                    ...initialUser,
                                    ...freshUserData,
                                    name: `${freshUserData.first_name || ''} ${freshUserData.last_name || ''}`.trim() || initialUser.name
                                }
                                setUser(updatedUser)
                                // Update localStorage with fresh data
                                localStorage.setItem('sigment_user', JSON.stringify(updatedUser))
                            } else if (response.status === 401) {
                                // Token is expired or invalid - clear ALL auth data and force re-login
                                console.warn('Token expired or invalid, clearing auth data...')
                                localStorage.removeItem('access_token')
                                localStorage.removeItem('sigment_user_id')
                                localStorage.removeItem('sigment_user_email')
                                localStorage.removeItem('sigment_user')
                                localStorage.removeItem('sigment_org_id')
                                localStorage.removeItem('sigment_org_slug')
                                localStorage.removeItem('sigment_user_role')
                                setUser(null)
                                // Note: Don't redirect here - let the component handle it
                            }
                        } catch (apiError) {
                            console.warn('Could not refresh user data from API:', apiError)
                            // Continue with cached data
                        }

                    }
                } catch (e) {
                    console.error('Failed to parse user data:', e)
                    // Fallback to minimal user object
                    setUser({
                        id: userId,
                        email: userEmail || 'user@example.com',
                        name: 'User',
                        created_at: new Date().toISOString()
                    })
                }
            }
        } catch (error) {
            console.error('Auth check failed:', error)
        } finally {
            setIsLoading(false)
        }
    }

    async function login(email: string, password: string) {
        setIsLoading(true)
        try {
            const response = await fetch('/api/v1/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.detail || 'Login failed')
            }

            const data = await response.json()
            const { user, organization, redirect_target } = data

            // Update State
            setUser(user)

            // Update LocalStorage (Critical for persistence)
            localStorage.setItem('sigment_user_id', user.id)
            localStorage.setItem('sigment_user_email', user.email)
            localStorage.setItem('sigment_user', JSON.stringify(user))
            if (data.access_token) {
                localStorage.setItem('access_token', data.access_token)
            }
            if (organization && organization.id) {
                localStorage.setItem('sigment_org_id', organization.id)
            }
            if (organization && organization.slug) {
                localStorage.setItem('sigment_org_slug', organization.slug)
            }
            // Save user role if available (role is in user object from backend)
            if (user.role) {
                localStorage.setItem('sigment_user_role', user.role)
            }

            // Handle Redirection based on user role
            if (organization && organization.slug) {
                // Redirect to the unified organization dashboard
                window.location.href = `/${organization.slug}`;
            } else {
                // Fallback if no org data
                router.push('/');
            }

        } catch (error: any) {
            console.error('Login error:', error)
            throw error
        } finally {
            setIsLoading(false)
        }
    }

    async function logout() {
        try {
            await fetch('/api/v1/auth/logout', { method: 'POST' })
            setUser(null)

            // SECURITY: Clear EVERYTHING from localStorage on logout.
            // This ensures no cached messages, groups, or organization data remain for the next user.
            localStorage.clear();

            router.push('/login')
        } catch (error) {
            console.error('Logout error:', error)
        }
    }

    async function updateUser(updates: Partial<User>) {
        if (!user) return

        try {
            // Update local state immediately for responsive UI
            const updatedUser = {
                ...user,
                ...updates,
                name: updates.first_name && updates.last_name
                    ? `${updates.first_name} ${updates.last_name}`.trim()
                    : updates.name || user.name
            }
            setUser(updatedUser)

            // Update localStorage for persistence
            localStorage.setItem('sigment_user', JSON.stringify(updatedUser))
        } catch (error) {
            console.error('Update user error:', error)
            throw error
        }
    }

    const value: UserContextType = {
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        updateUser
    }

    return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

export function useUser() {
    const context = useContext(UserContext)
    if (!context) {
        throw new Error('useUser must be used within UserProvider')
    }
    return context
}
