import { redirect } from 'next/navigation';

export default function Page({ params }: { params: { orgSlug: string } }) {
    redirect(`/${params.orgSlug}/home`);
}
