import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@/db/schema';
import { PreparationType, IdeaStatus, ItemStatus, PhotoPriority, ItemPriority } from '@/db/schema';

export type TxDb = NodePgDatabase<typeof schema>;

export interface IdeaMetadata {
  colorSwatches?: string[];
  externalUrl?: string | null;
  notes?: string | null;
  linkedVendorId?: string | null;
  linkedTaskId?: string | null;
}

export interface ItemMetadata {
  quantity?: number;
  keeper?: string | null;
  location?: string | null;
  bringTime?: string | null;
  notes?: string | null;
}

export interface MusicMetadata {
  artist?: string | null;
  moment?: string;
  externalUrl?: string | null;
  durationSeconds?: number | null;
  cueNotes?: string | null;
  trackOrder?: number;
}

export interface PhotoMetadata {
  subjectGroup?: string | null;
  sessionName?: string | null;
  timeLocation?: string | null;
  gatheringLead?: string | null;
  isExecuted?: boolean;
  notes?: string | null;
  recipient?: string | null;
  handoverChannel?: string | null;
}

export type PreparationMetadata = IdeaMetadata & ItemMetadata & MusicMetadata & PhotoMetadata;
