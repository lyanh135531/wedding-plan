export type SupportRole =
  | 'co_dau'
  | 'chu_re'
  | 'phu_dau'
  | 'phu_re'
  | 'mc'
  | 'dieu_phoi'
  | 'nguoi_than'
  | 'nha_cung_cap'
  | 'khac';

export interface SupportMember {
  id: string;
  name: string;
  phone: string;
  roles: SupportRole[];
  arrivalTime?: string;
  backupName?: string;
  backupPhone?: string;
  attireNotes?: string;
  duties?: string;
  assignedTaskIds?: string[];
  assignedItemIds?: string[];
  isShared: boolean;
  version?: number;
  createdAt?: string;
}

export interface SupportMemberFormData {
  name: string;
  phone: string;
  roles: SupportRole[];
  arrivalTime?: string;
  backupName?: string;
  backupPhone?: string;
  attireNotes?: string;
  duties?: string;
  isShared: boolean;
}
