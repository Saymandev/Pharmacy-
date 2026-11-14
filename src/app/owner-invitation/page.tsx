import {connection} from 'next/server';import {notFound} from 'next/navigation';
import {OwnerInvitationPage} from '@/features/platform/owner-invitation-page';
export default async function Page(){await connection();if(process.env.OWNER_INVITATION_PREVIEW_ENABLED!=='true')notFound();return <OwnerInvitationPage/>;}
