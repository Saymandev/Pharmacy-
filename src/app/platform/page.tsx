import {connection} from 'next/server';
import {notFound} from 'next/navigation';
import {PlatformPanel} from '@/features/platform/platform-panel';
export default async function PlatformPage(){await connection();if(process.env.PLATFORM_ADMIN_PREVIEW_ENABLED!=='true')notFound();return <PlatformPanel writesEnabled={process.env.PLATFORM_ADMIN_WRITES_ENABLED==='true'}/>;}
