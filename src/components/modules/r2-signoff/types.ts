export type ReadinessDomainId =
  | 'guests'
  | 'budget'
  | 'seating'
  | 'menus'
  | 'logistics'
  | 'preparation'
  | 'program'
  | 'support';

export type ReadinessStatus = 'ready' | 'warning' | 'not_ready';

export interface ReadinessDomainItem {
  id: ReadinessDomainId;
  title: string;
  status: ReadinessStatus;
  score: number; // 0 - 100
  summary: string;
  details: { label: string; value: string | number; isOk?: boolean }[];
  route: string;
}

export interface R2Snapshot {
  id: string;
  version: string;
  createdAt: string;
  createdBy: string;
  overallReadiness: number;
  notes?: string;
  guestCount: number;
  seatingCount: number;
  mealCount: number;
  handedOverAt?: string;
  handedOverTo?: string;
  handoverChannel?: string;
}

export interface DeltaChange {
  domain: string;
  description: string;
  type: 'added' | 'modified' | 'removed';
}

export interface CreateSnapshotFormData {
  version: string;
  notes?: string;
  handedOverTo?: string;
  handoverChannel?: string;
}
