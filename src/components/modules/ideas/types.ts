export type IdeaCategory = 'style' | 'decor' | 'attire' | 'other';

export type IdeaStatus = 'reference' | 'considering' | 'decided' | 'discarded';

export interface IdeaItem {
  id: string;
  title: string;
  category: IdeaCategory;
  status: IdeaStatus;
  notes?: string;
  imageUrl?: string;
  externalUrl?: string;
  colorSwatches?: string[];
  linkedVendorId?: string;
  linkedVendorName?: string;
  estimatedCost?: number;
  version?: number;
  isShared?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface IdeaFormData {
  title: string;
  category: IdeaCategory;
  status: IdeaStatus;
  notes?: string;
  imageUrl?: string;
  externalUrl?: string;
  colorSwatches?: string[];
  linkedVendorName?: string;
  estimatedCost?: number;
}
