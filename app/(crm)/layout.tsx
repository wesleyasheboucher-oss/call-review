import type { ReactNode } from 'react';
import { CrmShell } from '@/src/components/shell/CrmShell';

/** Every Call Review page sits in the ROM CRM shell (sidebar + top bar). */
export default function CrmLayout({ children }: { children: ReactNode }) {
  return <CrmShell>{children}</CrmShell>;
}
