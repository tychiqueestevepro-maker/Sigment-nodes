'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminIndex({ params }: { params: { orgSlug: string } }) {
    const router = useRouter();

    useEffect(() => {
        router.replace(`/${params.orgSlug}/admin/members`);
    }, [params.orgSlug, router]);

    return null;
}
