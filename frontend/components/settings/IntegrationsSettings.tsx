'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import toast from 'react-hot-toast';

interface Integration {
    platform: 'slack' | 'teams';
    name: string;
    description: string;
    logo: string;
    color: string;
}

const INTEGRATIONS: Integration[] = [
    {
        platform: 'slack',
        name: 'Slack',
        description: 'Bring all your communication together in one place. Real-time messaging and archiving.',
        logo: '/logos/slack.png',
        color: '#4A154B'
    },
    {
        platform: 'teams',
        name: 'Microsoft Teams',
        description: 'Chat, meet, call, and collaborate all in one place with Microsoft Teams.',
        logo: '/logos/teams.webp',
        color: '#6264A7'
    }
];

export default function IntegrationsSettings() {
    const [orgSlug, setOrgSlug] = useState<string>('');
    const [connectedPlatforms, setConnectedPlatforms] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState<{ [key: string]: boolean }>({});

    // Extract orgSlug from URL after component mounts (client-side only)
    useEffect(() => {
        const slug = window.location.pathname.split('/')[1];
        setOrgSlug(slug);
    }, []);

    // Fetch integration status when orgSlug is available
    useEffect(() => {
        if (orgSlug) {
            fetchIntegrationStatus();
        }
    }, [orgSlug]);

    const fetchIntegrationStatus = async () => {
        try {
            const response = await fetch('http://localhost:8000/api/v1/integrations/status', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                    'X-Organization-Id': orgSlug
                }
            });

            if (response.ok) {
                const data = await response.json();
                const connected = new Set<string>();
                if (data.slack) connected.add('slack');
                if (data.teams) connected.add('teams');
                setConnectedPlatforms(connected);
            }
        } catch (error) {
            console.error('Error fetching integration status:', error);
        }
    };

    const handleConnect = async (platform: 'slack' | 'teams') => {
        setLoading(prev => ({ ...prev, [platform]: true }));

        try {
            const response = await fetch(`http://localhost:8000/api/v1/integrations/${platform}/connect`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                    'X-Organization-Id': orgSlug
                }
            });

            if (response.ok) {
                const data = await response.json();
                // Redirect to OAuth authorization URL
                window.location.href = data.authorization_url;
            } else {
                const error = await response.json();
                toast.error(error.detail || `Failed to connect ${platform}`);
            }
        } catch (error) {
            console.error(`Error connecting ${platform}:`, error);
            toast.error(`Error connecting to ${platform}`);
        } finally {
            setLoading(prev => ({ ...prev, [platform]: false }));
        }
    };

    const handleDisconnect = async (platform: 'slack' | 'teams') => {
        if (!confirm(`Disconnect ${platform === 'slack' ? 'Slack' : 'Microsoft Teams'}?`)) {
            return;
        }

        setLoading(prev => ({ ...prev, [platform]: true }));

        try {
            const response = await fetch(`http://localhost:8000/api/v1/integrations/${platform}/disconnect`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                    'X-Organization-Id': orgSlug
                }
            });

            if (response.ok) {
                setConnectedPlatforms(prev => {
                    const updated = new Set(prev);
                    updated.delete(platform);
                    return updated;
                });
                toast.success(`${platform === 'slack' ? 'Slack' : 'Microsoft Teams'} disconnected`);
            } else {
                const error = await response.json();
                toast.error(error.detail || `Failed to disconnect ${platform}`);
            }
        } catch (error) {
            console.error(`Error disconnecting ${platform}:`, error);
            toast.error(`Error disconnecting from ${platform}`);
        } finally {
            setLoading(prev => ({ ...prev, [platform]: false }));
        }
    };

    return (
        <div className="space-y-4">
            <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900">Integrations</h2>
                <p className="text-sm text-gray-600 mt-1">Manage your workspace integrations.</p>
            </div>

            <div className="space-y-3">
                {INTEGRATIONS.map((integration) => {
                    const isConnected = connectedPlatforms.has(integration.platform);
                    const isLoading = loading[integration.platform];

                    return (
                        <div
                            key={integration.platform}
                            className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-colors"
                        >
                            <div className="flex items-center gap-4">
                                {/* Logo */}
                                <div className="w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden bg-gray-50">
                                    <img
                                        src={integration.logo}
                                        alt={integration.name}
                                        className="w-8 h-8 object-contain"
                                    />
                                </div>

                                {/* Info */}
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-semibold text-gray-900">{integration.name}</h3>
                                        {isConnected && (
                                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                                                Connected
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-600 mt-0.5">{integration.description}</p>
                                </div>
                            </div>

                            {/* Action Button */}
                            <div>
                                {isConnected ? (
                                    <button
                                        onClick={() => handleDisconnect(integration.platform)}
                                        disabled={isLoading}
                                        className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        {isLoading ? 'Disconnecting...' : 'Disconnect'}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleConnect(integration.platform)}
                                        disabled={isLoading}
                                        className="px-4 py-2 text-sm font-medium text-white bg-black hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        {isLoading ? 'Connecting...' : 'Connect'}
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
