import type { AssetItem, BackupData, StockItem, StockTransaction, TransactionType } from './types';

const KEYS = {
  items: 'mss_items_v1',
  transactions: 'mss_transactions_v1',
  assets: 'mss_assets_v1',
};

function read<T>(key: string): T[] {
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

function write<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data));
}

function newId(): string {
  return (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

function nowIso(): string {
  return new Date().toISOString();
}

// ---------- Stock items (Medicines & Disposables) ----------

export function getItems(): StockItem[] {
  return read<StockItem>(KEYS.items).sort((a, b) => a.name.localeCompare(b.name));
}

export function getItem(id: string): StockItem | undefined {
  return read<StockItem>(KEYS.items).find((i) => i.id === id);
}

export function saveItem(item: Omit<StockItem, 'id' | 'createdAt' | 'updatedAt'>, id?: string): StockItem {
  const items = read<StockItem>(KEYS.items);
  if (id) {
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) throw new Error('Item not found');
    const updated: StockItem = { ...items[idx], ...item, updatedAt: nowIso() };
    items[idx] = updated;
    write(KEYS.items, items);
    return updated;
  }
  const created: StockItem = { ...item, id: newId(), createdAt: nowIso(), updatedAt: nowIso() };
  items.push(created);
  write(KEYS.items, items);
  return created;
}

export function deleteItem(id: string): void {
  write(
    KEYS.items,
    read<StockItem>(KEYS.items).filter((i) => i.id !== id),
  );
  write(
    KEYS.transactions,
    read<StockTransaction>(KEYS.transactions).filter((t) => t.itemId !== id),
  );
}

// ---------- Stock transactions (ledger) ----------

export function getTransactions(itemId?: string): StockTransaction[] {
  const all = read<StockTransaction>(KEYS.transactions).sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  );
  return itemId ? all.filter((t) => t.itemId === itemId) : all;
}

export function recordTransaction(
  itemId: string,
  type: TransactionType,
  quantity: number,
  date: string,
  reference?: string,
  remarks?: string,
): StockTransaction {
  if (quantity <= 0) throw new Error('Quantity must be positive');
  const items = read<StockItem>(KEYS.items);
  const idx = items.findIndex((i) => i.id === itemId);
  if (idx === -1) throw new Error('Item not found');

  const current = items[idx];
  const balanceAfter = type === 'IN' ? current.stock + quantity : current.stock - quantity;
  if (balanceAfter < 0) throw new Error('Insufficient stock for this issue');

  items[idx] = { ...current, stock: balanceAfter, updatedAt: nowIso() };
  write(KEYS.items, items);

  const txns = read<StockTransaction>(KEYS.transactions);
  const txn: StockTransaction = {
    id: newId(),
    itemId,
    date,
    type,
    quantity,
    balanceAfter,
    reference,
    remarks,
  };
  txns.push(txn);
  write(KEYS.transactions, txns);
  return txn;
}

// ---------- Assets (Non-disposable / permanent) ----------

export function getAssets(): AssetItem[] {
  return read<AssetItem>(KEYS.assets).sort((a, b) => a.name.localeCompare(b.name));
}

export function getAsset(id: string): AssetItem | undefined {
  return read<AssetItem>(KEYS.assets).find((a) => a.id === id);
}

export function saveAsset(asset: Omit<AssetItem, 'id' | 'createdAt' | 'updatedAt'>, id?: string): AssetItem {
  const assets = read<AssetItem>(KEYS.assets);
  if (id) {
    const idx = assets.findIndex((a) => a.id === id);
    if (idx === -1) throw new Error('Asset not found');
    const updated: AssetItem = { ...assets[idx], ...asset, updatedAt: nowIso() };
    assets[idx] = updated;
    write(KEYS.assets, assets);
    return updated;
  }
  const created: AssetItem = { ...asset, id: newId(), createdAt: nowIso(), updatedAt: nowIso() };
  assets.push(created);
  write(KEYS.assets, assets);
  return created;
}

export function deleteAsset(id: string): void {
  write(
    KEYS.assets,
    read<AssetItem>(KEYS.assets).filter((a) => a.id !== id),
  );
}

// ---------- Backup / restore ----------

export function exportBackup(): BackupData {
  return {
    version: 1,
    exportedAt: nowIso(),
    items: read<StockItem>(KEYS.items),
    transactions: read<StockTransaction>(KEYS.transactions),
    assets: read<AssetItem>(KEYS.assets),
  };
}

export function importBackup(data: BackupData): void {
  if (!data || !Array.isArray(data.items) || !Array.isArray(data.assets)) {
    throw new Error('Invalid backup file');
  }
  write(KEYS.items, data.items);
  write(KEYS.transactions, data.transactions ?? []);
  write(KEYS.assets, data.assets);
}

export function clearAllData(): void {
  localStorage.removeItem(KEYS.items);
  localStorage.removeItem(KEYS.transactions);
  localStorage.removeItem(KEYS.assets);
}
