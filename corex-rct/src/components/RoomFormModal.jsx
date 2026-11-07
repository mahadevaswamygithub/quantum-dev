import React, { useState, useEffect } from 'react';
import { Loader2, X as XIcon, Star } from 'lucide-react';
import Modal from './common/Modal';
import { bookingAPI } from '../services/api';

const inputCls = "w-full px-3 py-2.5 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500";

const Field = ({ label, required, children }) => (
  <div>
    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">{label}{required && ' *'}</label>
    {children}
  </div>
);

const ROOM_TYPES = [
  { value: 'SINGLE', label: 'Single Room' },
  { value: 'DOUBLE', label: 'Double Room' },
  { value: 'SUITE', label: 'Suite' },
  { value: 'DELUXE', label: 'Deluxe Room' },
  { value: 'CONFERENCE', label: 'Conference Room' },
  { value: 'OTHER', label: 'Other' },
];

const emptyForm = () => ({
  name: '', property: '', room_type: 'SINGLE', description: '', capacity: 1,
  price_per_night: '', amenities: [], is_active: true,
});

const RoomFormModal = ({ isOpen, onClose, onSuccess, room }) => {
  const [form, setForm] = useState(emptyForm);
  const [properties, setProperties] = useState([]);
  const [amenityInput, setAmenityInput] = useState('');
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setForm(room ? {
        name: room.name, property: room.property || '', room_type: room.room_type, description: room.description || '',
        capacity: room.capacity, price_per_night: room.price_per_night, amenities: room.amenities || [],
        is_active: room.is_active,
      } : emptyForm());
      setImages(room?.images || []);
      setError('');
      setAmenityInput('');
      bookingAPI.getProperties().then(({ data }) => setProperties(data || [])).catch(() => setProperties([]));
    }
  }, [isOpen, room]);

  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(f => ({ ...f, [k]: v }));
  };

  const addAmenity = () => {
    const v = amenityInput.trim();
    if (v && !form.amenities.includes(v)) setForm(f => ({ ...f, amenities: [...f.amenities, v] }));
    setAmenityInput('');
  };

  const removeAmenity = (a) => setForm(f => ({ ...f, amenities: f.amenities.filter(x => x !== a) }));

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !room) return;
    setUploading(true);
    try {
      const { data } = await bookingAPI.uploadRoomImage(room.id, file, images.length === 0);
      setImages(prev => [...prev, data]);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload image');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleImageDelete = async (imageId) => {
    if (!room) return;
    try {
      await bookingAPI.deleteRoomImage(room.id, imageId);
      setImages(prev => prev.filter(i => i.id !== imageId));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete image');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const payload = { ...form, property: Number(form.property), capacity: Number(form.capacity), price_per_night: Number(form.price_per_night) };
      if (room) await bookingAPI.updateRoom(room.id, payload);
      else await bookingAPI.createRoom(payload);
      onSuccess(); onClose();
    } catch (err) {
      setError(err.response?.data?.name?.[0] || err.response?.data?.property?.[0] || err.response?.data?.price_per_night?.[0] || err.response?.data?.error || 'Failed to save room');
    } finally { setLoading(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={room ? 'Edit Room' : 'Add Room'} wide>
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-600 dark:text-red-400 text-sm">{error}</div>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Room Name" required><input type="text" value={form.name} onChange={set('name')} required placeholder="Deluxe Ocean View" className={inputCls} /></Field>
          <Field label="Property / Building" required>
            <select value={form.property} onChange={set('property')} required className={inputCls}>
              <option value="">Select a property...</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {properties.length === 0 && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">Add a property first (Properties page) before adding rooms.</p>
            )}
          </Field>
          <Field label="Room Type" required>
            <select value={form.room_type} onChange={set('room_type')} className={inputCls}>
              {ROOM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Capacity (guests)" required><input type="number" min="1" value={form.capacity} onChange={set('capacity')} required className={inputCls} /></Field>
          <Field label="Price / Night (₹)" required><input type="number" min="0" step="0.01" value={form.price_per_night} onChange={set('price_per_night')} required className={inputCls} /></Field>
          <div className="md:col-span-2">
            <Field label="Description"><textarea rows={3} value={form.description} onChange={set('description')} placeholder="Describe the room..." className={inputCls} /></Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Amenities">
              <div className="flex gap-2 mb-2">
                <input
                  type="text" value={amenityInput} onChange={e => setAmenityInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAmenity(); } }}
                  placeholder="e.g. WiFi - press Enter to add" className={inputCls}
                />
                <button type="button" onClick={addAmenity} className="px-4 py-2.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-white text-sm font-medium rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600">Add</button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {form.amenities.map(a => (
                  <span key={a} className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/10 text-green-600 dark:text-green-400 rounded-full text-xs">
                    {a}
                    <button type="button" onClick={() => removeAmenity(a)}><XIcon className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            </Field>
          </div>
          <div className="md:col-span-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.is_active} onChange={set('is_active')} className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 text-green-500 focus:ring-2 focus:ring-green-500" />
              <span className="text-sm text-slate-600 dark:text-slate-300">Listed / bookable</span>
            </label>
          </div>

          {room && (
            <div className="md:col-span-2">
              <Field label="Photos">
                <div className="flex flex-wrap gap-2 mb-2">
                  {images.map(img => (
                    <div key={img.id} className="relative w-20 h-20 rounded-lg overflow-hidden group">
                      <img src={img.image} alt="" className="w-full h-full object-cover" />
                      {img.is_primary && <Star className="absolute top-1 left-1 w-3.5 h-3.5 fill-amber-400 text-amber-400" />}
                      <button
                        type="button" onClick={() => handleImageDelete(img.id)}
                        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                      >
                        <XIcon className="w-5 h-5 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
                <label className="inline-flex items-center gap-2 px-3 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-white text-sm rounded-lg cursor-pointer hover:bg-slate-300 dark:hover:bg-slate-600">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Upload photo'}
                  <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} className="hidden" />
                </label>
              </Field>
            </div>
          )}
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white text-sm font-medium rounded-lg transition-all">Cancel</button>
          <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-sm font-semibold rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : room ? 'Save Changes' : 'Add Room'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default RoomFormModal;
