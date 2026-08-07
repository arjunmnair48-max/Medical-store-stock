// Core domain types for the NIPER Hajipur Medical Centre stock register app.

export type ConsumableCategory = 'Medicine' | 'Disposable';

export interface StockItem {
  id: string;
  name: string;
  category: ConsumableCategory;
  unit: string; // e.g. Strip, Box, Bottle, Piece, Vial
  batchNo?: string;
  expiryDate?: string; // ISO date (yyyy-mm-dd)
  reorderLevel: number;
  stock: number;
  unitPrice?: number;
  supplier?: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export type TransactionType = 'IN' | 'OUT';

export interface StockTransaction {
  id: string;
  itemId: string;
  date: string; // ISO date
  type: TransactionType;
  quantity: number;
  balanceAfter: number;
  reference?: string; // PO number, patient/department issued to, etc.
  remarks?: string;
}

export type AssetCondition = 'Good' | 'Needs Repair' | 'Under Repair' | 'Damaged' | 'Disposed';

export const ASSET_CATEGORIES = [
  'Furniture',
  'Equipment',
  'Electronics',
  'Instrument',
  'Fixture',
  'Other',
] as const;

export interface AssetItem {
  id: string;
  name: string;
  assetCategory: string;
  serialNo?: string;
  quantity: number;
  location?: string;
  custodian?: string;
  purchaseDate?: string; // ISO date
  cost?: number;
  condition: AssetCondition;
  warrantyTill?: string; // ISO date
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BackupData {
  version: number;
  exportedAt: string;
  items: StockItem[];
  transactions: StockTransaction[];
  assets: AssetItem[];
}
