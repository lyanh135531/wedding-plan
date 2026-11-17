export type PreparationTab = 'items' | 'music' | 'shots' | 'linked-ideas';

export type ItemStatus = 'not_prepared' | 'packed' | 'brought' | 'returned';

export interface PreparationItem {
  id: string;
  title: string;
  quantity: number;
  status: ItemStatus;
  keeper?: string;
  location?: string;
  bringTime?: string;
  isRental: boolean;
  returnDueDate?: string;
  notes?: string;
  version?: number;
  createdAt?: string;
}

export type CeremonyMoment =
  | 'guest_arrival'
  | 'grand_entrance'
  | 'ceremony'
  | 'champagne_cake'
  | 'table_visits'
  | 'bouquet_toss'
  | 'send_off';

export interface MusicTrack {
  id: string;
  title: string;
  artist?: string;
  moment: CeremonyMoment;
  orderIndex: number;
  duration?: string;
  cueNotes?: string;
  isBlacklisted: boolean;
  externalUrl?: string;
  version?: number;
}

export type ShotPriority = 'must_have' | 'nice_to_have';

export interface PhotoShot {
  id: string;
  sceneTitle: string;
  subjectGroup: string;
  session: string;
  priority: ShotPriority;
  gatheringLead: string;
  completed: boolean;
  handedOverAt?: string;
  notes?: string;
  version?: number;
}
