import {connection} from 'next/server';
import {notFound} from 'next/navigation';
import {MemberInvitationPage} from '@/features/shops/member-invitation-page';
export default async function Page(){await connection();if(process.env.MEMBER_INVITATION_PREVIEW_ENABLED!=='true')notFound();return <MemberInvitationPage/>;}
