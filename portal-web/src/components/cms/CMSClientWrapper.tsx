"use client";

import dynamic from 'next/dynamic';
import type { CMSTrip } from '@/lib/cms/types';

const CMSWorkspace = dynamic(() => import('./CMSWorkspace'), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center h-screen w-full bg-zinc-50 text-zinc-500">
      <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
      <p className="text-sm font-semibold text-zinc-700">正在載入 CMS 審核工作區...</p>
    </div>
  )
});

export default function CMSClientWrapper({ initialTrip, cmsAccessToken }: { initialTrip?: CMSTrip; cmsAccessToken?: string }) {
  return <CMSWorkspace initialTrip={initialTrip} cmsAccessToken={cmsAccessToken} />;
}
