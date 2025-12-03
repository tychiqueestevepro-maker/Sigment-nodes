'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function BoardPanelPage() {
    const router = useRouter();
    const params = useParams();
    const orgSlug = params?.orgSlug as string;

    useEffect(() => {
        if (orgSlug) {
            router.push(`/${orgSlug}/board/panel/members`);
        }
    }, [orgSlug, router]);

    return null;
}
