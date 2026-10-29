'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Sidebar } from './Sidebar';

/**
 * The ROM CRM frame: sidebar, top bar and page body.
 *
 * Renders only in the browser. Sample data is generated from the current time
 * and settings live in localStorage, so server rendering would only produce
 * hydration mismatches.
 */
export const CrmShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex font-sans selection:bg-brand-500 selection:text-white">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-40 h-16 bg-slate-50/90 backdrop-blur border-b border-slate-200 flex items-center px-4 sm:px-6 lg:px-8">
          {/* Presentational: the CRM's global search lives outside this module. */}
          <div aria-disabled="true" className="flex items-center gap-2 w-full max-w-3xl h-10 px-3 rounded-lg border border-slate-200 bg-white text-[14px] text-slate-500 select-none">
            <Search className="w-4 h-4" />
            Search ROM CRM...
          </div>
        </header>
        <main className="flex-1 w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-12">
          <Suspense>{children}</Suspense>
        </main>
      </div>
    </div>
  );
};
