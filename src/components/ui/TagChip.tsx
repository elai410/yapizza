import type { HTMLAttributes } from 'react';
import type { Tag } from '@/lib/contracts';
import { cn } from './cn';

export const TAG_LABELS: Record<Tag, string> = {
  free_food: 'Free food',
  cultural: 'Cultural',
  professional: 'Career',
  academic: 'Academic',
  social: 'Social',
  arts: 'Arts',
  athletics: 'Athletics',
  traditions: 'Traditions',
};

const BASE = 'inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-xs font-semibold';

// Each tag has its own color so a day reads at a glance.
export const TAG_STYLES: Record<Tag, string> = {
  free_food: 'bg-food-soft text-food',
  cultural: 'bg-sauce-soft text-sauce',
  professional: 'bg-accent-soft text-accent',
  academic: 'bg-[#dcf0ed] text-[#0b6158]',
  social: 'bg-crust-soft text-crust-ink',
  arts: 'bg-[#fce3ee] text-[#9c2257]',
  athletics: 'bg-[#e4eaf1] text-[#2c4560]',
  traditions: 'bg-accent text-accent-ink',
};

export interface TagChipProps extends HTMLAttributes<HTMLSpanElement> {
  tag: Tag;
}

export function TagChip({ tag, className, ...props }: TagChipProps) {
  return (
    <span
      className={cn(BASE, TAG_STYLES[tag], className)}
      {...props}
    >
      {TAG_LABELS[tag]}
    </span>
  );
}

export type StatusKind = 'updated' | 'canceled' | 'review';

const STATUS: Record<StatusKind, { label: string; className: string }> = {
  updated: { label: 'Updated', className: 'bg-update-soft text-update' },
  canceled: { label: 'Canceled', className: 'bg-cancel-soft text-cancel' },
  review: { label: 'Needs review', className: 'bg-sunken text-muted' },
};

export interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  kind: StatusKind;
}

export function StatusBadge({ kind, className, ...props }: StatusBadgeProps) {
  return (
    <span className={cn(BASE, STATUS[kind].className, className)} {...props}>
      {STATUS[kind].label}
    </span>
  );
}
