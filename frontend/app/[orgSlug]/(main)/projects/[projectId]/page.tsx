'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function ProjectPage() {
    const router = useRouter();
    const params = useParams();
    const orgSlug = params.orgSlug as string;
    const projectId = params.projectId as string;

    useEffect(() => {
        // Redirect to overview tab by default
        router.replace(`/${orgSlug}/projects/${projectId}/overview`);
    }, [router, orgSlug, projectId]);

    // Show nothing while redirecting
    return null;
}
