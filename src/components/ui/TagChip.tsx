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

const BASE = 'inline-flex h-6 items-center whitespace-nowrap rounded-sm px-2 text-xs font-medium';

export interface TagChipProps extends HTMLAttributes<HTMLSpanElement> {
  tag: Tag;
}

export function TagChip({ tag, className, ...props }: TagChipProps) {
  return (
    <span
      className={cn(BASE, tag === 'free_food' ? 'bg-food-soft text-food' : 'bg-sunken text-muted', className)}
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
