import type { Tag } from '@/lib/contracts';

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

export const COLLEGES = [
  'Benjamin Franklin', 'Berkeley', 'Branford', 'Davenport', 'Ezra Stiles', 'Grace Hopper', 'Jonathan Edwards',
  'Morse', 'Pauli Murray', 'Pierson', 'Saybrook', 'Silliman', 'Timothy Dwight', 'Trumbull',
] as const;
