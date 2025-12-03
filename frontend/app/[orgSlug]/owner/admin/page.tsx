import { redirect } from 'next/navigation';

export default function OwnerAdminIndex({ params }: { params: { orgSlug: string } }) {
    redirect(`/${params.orgSlug}/owner/admin/members`);
}
