import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from './common/Modal';
import LocationField from './LocationField';
import { bookingAPI } from '../services/api';

const inputCls = "w-full px-3 py-2.5 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500";

const Field = ({ label, required, children }) => (
  <div>
    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">{label}{required && ' *'}</label>
    {children}
  </div>
);

const emptyForm = () => ({ name: '', description: '', address: '', latitude: null, longitude: null, is_active: true });

const PropertyFormModal = ({ isOpen, onClose, onSuccess, property }) => {
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setForm(property ? {
        name: property.name, description: property.description || '', address: property.address || '',
        latitude: property.latitude, longitude: property.longitude, is_active: property.is_active,
      } : emptyForm());
      setError('');
    }
  }, [isOpen, property]);

  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(f => ({ ...f, [k]: v }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      if (property) await bookingAPI.updateProperty(property.id, form);
      else await bookingAPI.createProperty(form);
      onSuccess(); onClose();
    } catch (err) {
      setError(err.response?.data?.name?.[0] || err.response?.data?.error || 'Failed to save property');
    } finally { setLoading(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={property ? 'Edit Property' : 'Add Property'} wide>
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-600 dark:text-red-400 text-sm">{error}</div>}
        <Field label="Property / Building Name" required>
          <input type="text" value={form.name} onChange={set('name')} required placeholder="Block A, Yatri Niwas 1..." className={inputCls} />
        </Field>
        <Field label="Description">
          <textarea rows={2} value={form.description} onChange={set('description')} placeholder="Optional notes about this building" className={inputCls} />
        </Field>
        <Field label="Street Address (optional, shown to guests)">
          <input type="text" value={form.address} onChange={set('address')} placeholder="123 Temple Road" className={inputCls} />
        </Field>
        <LocationField
          latitude={form.latitude}
          longitude={form.longitude}
          onResolved={(lat, lng) => setForm(f => ({ ...f, latitude: lat, longitude: lng }))}
          onClear={() => setForm(f => ({ ...f, latitude: null, longitude: null }))}
        />
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={form.is_active} onChange={set('is_active')} className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 text-green-500 focus:ring-2 focus:ring-green-500" />
          <span className="text-sm text-slate-600 dark:text-slate-300">Listed / bookable</span>
        </label>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white text-sm font-medium rounded-lg transition-all">Cancel</button>
          <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-sm font-semibold rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : property ? 'Save Changes' : 'Add Property'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default PropertyFormModal;
