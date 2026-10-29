'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity, Building, Building2, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleCheck, FileText, Gauge, Home,
  Inbox, LayoutGrid, Mail, Map, Phone, ShieldCheck, Sparkles, Stethoscope, Target, User as UserIcon, UsersRound,
} from 'lucide-react';
import { CALL_REVIEW_HREF } from '../../config/callReview';

/**
 * ROM CRM shell navigation, mirroring the CRM's own sidebar (same as the Market
 * Access hub). Only Quality > Call Review is this app; every other entry is
 * presentational, so the shell reads the same as the CRM.
 */

const ICON = 'w-[18px] h-[18px]';

/** The logo's lift: a soft shadow under the letters. */
const LOGO_SHADOW: React.CSSProperties = { filter: 'drop-shadow(0 1px 1px rgba(15, 23, 42, 0.25)) drop-shadow(0 2px 4px rgba(15, 23, 42, 0.18))' };

/** A CRM entry; with `href` it is one of this app's pages, otherwise inert. */
type Item = { label: string; icon: React.ReactNode; href?: string };

/** The CRM, in the CRM's order. `soon` sections have no items yet. */
const SECTIONS: { key: string; label: string; items?: Item[]; soon?: boolean }[] = [
  { key: 'crm', label: 'ROM CRM', items: [{ label: 'Home', icon: <Home className={ICON} /> }] },
  {
    key: 'market',
    label: 'Market Access',
    items: [
      { label: 'Coverage Map', icon: <Map className={ICON} /> },
      { label: 'KPI Dashboard', icon: <Gauge className={ICON} /> },
      { label: 'Organizations', icon: <Building className={ICON} /> },
      { label: 'Contracts', icon: <FileText className={ICON} /> },
      { label: 'New Payer Pipeline', icon: <Target className={ICON} /> },
      { label: 'Implementation', icon: <CircleCheck className={ICON} /> },
      { label: 'AI Insights', icon: <Sparkles className={ICON} /> },
    ],
  },
  { key: 'elcap', label: 'ELCAP', items: [{ label: 'Providers', icon: <UsersRound className={ICON} /> }] },
  {
    key: 'sales',
    label: 'Sales',
    items: [
      { label: 'Command Center', icon: <LayoutGrid className={ICON} /> },
      { label: 'Pipeline', icon: <Target className={ICON} /> },
      { label: 'Sites of care', icon: <Building2 className={ICON} /> },
      { label: 'Prescribers', icon: <Activity className={ICON} /> },
      { label: 'Contacts', icon: <UserIcon className={ICON} /> },
      { label: 'Leads', icon: <Inbox className={ICON} /> },
      { label: 'Tasks', icon: <CheckCircle2 className={ICON} /> },
      { label: 'Communications', icon: <Mail className={ICON} /> },
    ],
  },
  { key: 'clinical', label: 'Clinical Services', items: [{ label: 'Patient Starts', icon: <Stethoscope className={ICON} /> }] },
  { key: 'rcm', label: 'RCM', items: [{ label: 'Single Case', icon: <FileText className={ICON} /> }] },
  { key: 'bd', label: 'Business Development', soon: true },
  { key: 'quality', label: 'Quality', items: [{ label: 'Call Review', icon: <Phone className={ICON} />, href: CALL_REVIEW_HREF }] },
  { key: 'pr', label: 'PR and Marketing', soon: true },
  { key: 'admin', label: 'Admin', items: [{ label: 'Audit & Access', icon: <ShieldCheck className={ICON} /> }] },
];

const SectionHeader: React.FC<{ label: string; open: boolean; onToggle: () => void; collapsed: boolean }> = ({ label, open, onToggle, collapsed }) => {
  if (collapsed) return <div className="my-2 mx-3 h-px bg-slate-200" />;
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-3 pt-5 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-700 hover:text-slate-900 transition cursor-pointer"
    >
      <span>{label}</span>
      <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${open ? '' : '-rotate-90'}`} />
    </button>
  );
};

const NavItem: React.FC<Item & { pathname: string; collapsed: boolean }> = ({ label, icon, href, pathname, collapsed }) => {
  if (!href) {
    return (
      <div
        aria-disabled="true"
        title={`${label} - part of ROM CRM, not this module`}
        className={`flex items-center gap-3 px-3 py-[7px] rounded-lg text-[14px] text-slate-600 cursor-default select-none ${collapsed ? 'justify-center' : ''}`}
      >
        <span className="shrink-0 text-slate-500">{icon}</span>
        {!collapsed && <span className="truncate">{label}</span>}
      </div>
    );
  }
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={`w-full flex items-center gap-3 px-3 py-[7px] rounded-lg text-[14px] transition ${collapsed ? 'justify-center' : ''} ${
        active ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-slate-800 hover:bg-slate-100'
      }`}
    >
      <span className={`shrink-0 ${active ? 'text-brand-600' : 'text-slate-700'}`}>{icon}</span>
      {!collapsed && <span className="truncate flex-1 text-left">{label}</span>}
    </Link>
  );
};

export const Sidebar: React.FC = () => {
  const pathname = usePathname() || '/';
  const [collapsed, setCollapsed] = useState(false);
  // Other sections start closed so Quality > Call Review is in view.
  const [open, setOpen] = useState<Record<string, boolean>>({ crm: true, quality: true });
  const toggle = (key: string) => setOpen(s => ({ ...s, [key]: !s[key] }));

  return (
    <aside className={`relative shrink-0 bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0 z-[41] transition-all duration-200 ${collapsed ? 'w-16' : 'w-60'}`}>
      {/* Brand: the ROM CRM logo; collapsed, the swirl. The two crossfade. */}
      <div className="relative h-16 shrink-0 overflow-hidden">
        <img
          src="/romcrm-logo.png"
          alt={collapsed ? '' : 'ROM CRM'}
          width={200}
          height={40}
          className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] max-w-none h-auto transition-all duration-200 ease-out ${collapsed ? 'opacity-0 scale-75' : 'opacity-100 scale-100'}`}
          style={LOGO_SHADOW}
        />
        <img
          src="/romcrm-mark.png"
          alt={collapsed ? 'ROM CRM' : ''}
          width={34}
          height={36}
          className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-9 w-auto max-w-none transition-all duration-200 ease-out ${collapsed ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-50 -rotate-90'}`}
          style={LOGO_SHADOW}
        />
      </div>
      <button
        onClick={() => setCollapsed(c => !c)}
        title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        className="absolute -right-3 top-[52px] z-20 w-6 h-6 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 hover:text-slate-900 hover:border-slate-300 transition cursor-pointer"
      >
        {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>

      <nav className="flex-1 overflow-y-auto no-scrollbar px-2 pb-6">
        {SECTIONS.map(section =>
          section.soon ? (
            !collapsed && (
              <div key={section.key} className="flex items-center justify-between gap-2 px-3 pt-5 pb-1.5 select-none">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-700 leading-tight">{section.label}</span>
                <span className="shrink-0 text-[11px] text-slate-500">Coming soon...</span>
              </div>
            )
          ) : (
            <React.Fragment key={section.key}>
              <SectionHeader label={section.label} open={!!open[section.key]} onToggle={() => toggle(section.key)} collapsed={collapsed} />
              {open[section.key] && (
                <div className="space-y-px">
                  {section.items!.map(item => <NavItem key={item.label} {...item} pathname={pathname} collapsed={collapsed} />)}
                </div>
              )}
            </React.Fragment>
          ),
        )}
      </nav>
    </aside>
  );
};
