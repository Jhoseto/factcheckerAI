import React from 'react';
import {
  LayoutDashboard,
  MessageSquareQuote,
  Hand,
  FileText,
  Eye,
  User,
  Mic,
  VenetianMask,
  Smile,
  Brain,
  Landmark,
  type LucideIcon,
} from 'lucide-react';

const tabIcons: Record<string, LucideIcon> = {
  summary: LayoutDashboard,
  claims: MessageSquareQuote,
  manipulation: Hand,
  report: FileText,
  visual: Eye,
  bodyLanguage: User,
  vocal: Mic,
  deception: VenetianMask,
  humor: Smile,
  psychological: Brain,
  cultural: Landmark,
};

export type TabId = keyof typeof tabIcons;

export const TabIcon: React.FC<{ id: TabId; className?: string }> = ({ id, className = 'w-4 h-4 shrink-0' }) => {
  const Icon = tabIcons[id];
  if (!Icon) return null;
  return <Icon className={className} strokeWidth={1.75} />;
};

/** For section headers inside tab content (slightly larger). */
export const SectionIcon: React.FC<{ id: TabId; className?: string }> = ({ id, className }) => (
  <TabIcon id={id} className={className ?? 'w-5 h-5 shrink-0 text-[#968B74]'} />
);

export { tabIcons };
