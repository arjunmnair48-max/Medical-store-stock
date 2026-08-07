import { useState } from 'react';
import type { AssetItem } from '../types';
import { ASSET_CATEGORIES } from '../types';
import { deleteAsset, getAssets } from '../storage';
import { formatDate, toCsv, downloadFile, formatCurrency } from '../utils';
import AssetFormModal from '../components/AssetFormModal';
import ConfirmDialog from '../components/ConfirmDialog';

function conditionClass(condition: string): string {
  switch (condition) {
    case 'Good':
      return 'good';
    case 'Needs Repair':
    case 'Under Repair':
      return 'repair';
    case 'Damaged':
    case 'Disposed':
      return 'damaged';
    default:
      return '';
  }
}

export default function AssetsPage() {
  const [, setRefresh] = useState(0);
  const assets = getAssets();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [conditionFilter, setConditionFilter] = useState('all');

  const [showAdd, setShowAdd] = useState(false);
  const [formAsset, setFormAsset] = useState<AssetItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AssetItem | null>(null);

  function bump() {
    setRefresh((r) => r + 1);
  }

  const filtered = assets.filter((a) => {
    if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !(a.serialNo ?? '').toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (categoryFilter !== 'all' && a.assetCategory !== categoryFilter) return false;
    if (conditionFilter !== 'all' && a.condition !== conditionFilter) return false;
    return true;
  });

  function handleExportCsv() {
    const rows = filtered.map((a) => ({
      Name: a.name,
      Category: a.assetCategory,
      SerialNo: a.serialNo ?? '',
      Quantity: a.quantity,
      Location: a.location ?? '',
      Custodian: a.custodian ?? '',
      PurchaseDate: a.purchaseDate ?? '',
      Cost: a.cost ?? '',
      Condition: a.condition,
      WarrantyTill: a.warrantyTill ?? '',
      Remarks: a.remarks ?? '',
    }));
    downloadFile(`assets-${Date.now()}.csv`, toCsv(rows), 'text/csv');
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Non-Disposable &amp; Permanent Assets</h1>
          <p className="desc">Register of furniture, equipment and instruments with location, custodian and condition.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button className="btn" onClick={handleExportCsv}>Export CSV</button>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Asset</button>
        </div>
      </div>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Search by name or serial no..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: 240 }}
        />
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="all">All Categories</option>
          {ASSET_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={conditionFilter} onChange={(e) => setConditionFilter(e.target.value)}>
          <option value="all">All Conditions</option>
          <option value="Good">Good</option>
          <option value="Needs Repair">Needs Repair</option>
          <option value="Under Repair">Under Repair</option>
          <option value="Damaged">Damaged</option>
          <option value="Disposed">Disposed</option>
        </select>
        <div className="spacer" />
        <span className="text-muted">{filtered.length} of {assets.length} assets</span>
      </div>

      {filtered.length === 0 ? (
        <div className="card empty-state">
          {assets.length === 0
            ? 'No assets yet. Click "+ Add Asset" to register your first item.'
            : 'No assets match your search/filter.'}
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Serial No.</th>
                <th>Qty</th>
                <th>Location</th>
                <th>Custodian</th>
                <th>Purchase Date</th>
                <th>Cost</th>
                <th>Condition</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td>{a.assetCategory}</td>
                  <td>{a.serialNo || '-'}</td>
                  <td>{a.quantity}</td>
                  <td>{a.location || '-'}</td>
                  <td>{a.custodian || '-'}</td>
                  <td>{formatDate(a.purchaseDate)}</td>
                  <td>{formatCurrency(a.cost)}</td>
                  <td><span className={`badge ${conditionClass(a.condition)}`}>{a.condition}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                      <button className="btn btn-sm" onClick={() => setFormAsset(a)}>Edit</button>
                      <button className="btn btn-sm btn-danger" onClick={() => setDeleteTarget(a)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <AssetFormModal
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            bump();
          }}
        />
      )}

      {formAsset && (
        <AssetFormModal
          asset={formAsset}
          onClose={() => setFormAsset(null)}
          onSaved={() => {
            setFormAsset(null);
            bump();
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Asset"
          message={`Delete "${deleteTarget.name}" from the asset register? This cannot be undone.`}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            deleteAsset(deleteTarget.id);
            setDeleteTarget(null);
            bump();
          }}
        />
      )}
    </div>
  );
}
