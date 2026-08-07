import { useState } from 'react';
import type { AssetCondition, AssetItem } from '../types';
import { ASSET_CATEGORIES } from '../types';
import { saveAsset } from '../storage';
import Modal from './Modal';

const CONDITIONS: AssetCondition[] = ['Good', 'Needs Repair', 'Under Repair', 'Damaged', 'Disposed'];

export default function AssetFormModal({
  asset,
  onClose,
  onSaved,
}: {
  asset?: AssetItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!asset;
  const [name, setName] = useState(asset?.name ?? '');
  const [assetCategory, setAssetCategory] = useState(asset?.assetCategory ?? ASSET_CATEGORIES[0]);
  const [serialNo, setSerialNo] = useState(asset?.serialNo ?? '');
  const [quantity, setQuantity] = useState(asset?.quantity ?? 1);
  const [location, setLocation] = useState(asset?.location ?? '');
  const [custodian, setCustodian] = useState(asset?.custodian ?? '');
  const [purchaseDate, setPurchaseDate] = useState(asset?.purchaseDate ?? '');
  const [cost, setCost] = useState<number | ''>(asset?.cost ?? '');
  const [condition, setCondition] = useState<AssetCondition>(asset?.condition ?? 'Good');
  const [warrantyTill, setWarrantyTill] = useState(asset?.warrantyTill ?? '');
  const [remarks, setRemarks] = useState(asset?.remarks ?? '');
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Asset name is required.');
      return;
    }
    if (quantity < 0) {
      setError('Quantity cannot be negative.');
      return;
    }
    try {
      saveAsset(
        {
          name: name.trim(),
          assetCategory,
          serialNo: serialNo.trim() || undefined,
          quantity: Number(quantity),
          location: location.trim() || undefined,
          custodian: custodian.trim() || undefined,
          purchaseDate: purchaseDate || undefined,
          cost: cost === '' ? undefined : Number(cost),
          condition,
          warrantyTill: warrantyTill || undefined,
          remarks: remarks.trim() || undefined,
        },
        asset?.id,
      );
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save asset.');
    }
  }

  return (
    <Modal title={isEdit ? 'Edit Asset' : 'Add Non-Disposable / Permanent Asset'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {error && <div className="form-error">{error}</div>}
        <div className="form-grid">
          <div className="form-field full">
            <label htmlFor="aname">Asset Name *</label>
            <input id="aname" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>

          <div className="form-field">
            <label htmlFor="acat">Category</label>
            <select id="acat" value={assetCategory} onChange={(e) => setAssetCategory(e.target.value)}>
              {ASSET_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="serial">Serial / Asset Tag No.</label>
            <input id="serial" value={serialNo} onChange={(e) => setSerialNo(e.target.value)} />
          </div>

          <div className="form-field">
            <label htmlFor="qty">Quantity</label>
            <input id="qty" type="number" min={0} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
          </div>

          <div className="form-field">
            <label htmlFor="condition">Condition</label>
            <select id="condition" value={condition} onChange={(e) => setCondition(e.target.value as AssetCondition)}>
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="location">Location / Room</label>
            <input id="location" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>

          <div className="form-field">
            <label htmlFor="custodian">Custodian / In-charge</label>
            <input id="custodian" value={custodian} onChange={(e) => setCustodian(e.target.value)} />
          </div>

          <div className="form-field">
            <label htmlFor="pdate">Purchase Date</label>
            <input id="pdate" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
          </div>

          <div className="form-field">
            <label htmlFor="cost">Cost (Rs.)</label>
            <input
              id="cost"
              type="number"
              min={0}
              step="0.01"
              value={cost}
              onChange={(e) => setCost(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>

          <div className="form-field">
            <label htmlFor="warranty">Warranty Till</label>
            <input id="warranty" type="date" value={warrantyTill} onChange={(e) => setWarrantyTill(e.target.value)} />
          </div>

          <div className="form-field full">
            <label htmlFor="aremarks">Remarks</label>
            <textarea id="aremarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            {isEdit ? 'Save Changes' : 'Add Asset'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
