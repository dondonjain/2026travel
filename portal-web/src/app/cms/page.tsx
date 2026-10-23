import type { Metadata } from 'next';
import CMSClientWrapper from '@/components/cms/CMSClientWrapper';

export const metadata: Metadata = {
  title: 'Travel Portal CMS — 行程審核後台 (Checkpoint 1)',
  description: 'Travel Portal 響應式行程審核工作區'
};

export default function CMSPage() {
  return <CMSClientWrapper />;
}
