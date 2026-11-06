import React, { useState, useEffect, useCallback } from 'react';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import RefreshButton from '../components/common/RefreshButton';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import PageSpinner from '../components/common/PageSpinner';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import PriceTag from '../components/common/PriceTag';
import EmptyState from '../components/common/EmptyState';
import SearchFilterBar from '../components/common/SearchFilterBar';
import RoomFormModal from '../components/RoomFormModal';
import BookingLinkCard from '../components/BookingLinkCard';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { bookingAPI } from '../services/api';
import { BedDouble, Plus, Pencil, Trash2, Users as UsersIcon, ImageOff } from 'lucide-react';

const ROOM_TYPE_LABELS = {
  SINGLE: 'Single Room', DOUBLE: 'Double Room', SUITE: 'Suite',
  DELUXE: 'Deluxe Room', CONFERENCE: 'Conference Room', OTHER: 'Other',
};

const RoomsList = () => {
  const { can } = usePermissions();
  const { user } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [propertyFilter, setPropertyFilter] = useState('ALL');

  const [showForm, setShowForm] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [roomsRes, propsRes] = await Promise.all([bookingAPI.getRooms(), bookingAPI.getProperties()]);
      setRooms(roomsRes.data || []);
      setProperties(propsRes.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  const live = useAutoRefresh(fetchData);

  const filtered = rooms.filter(r => {
    const matchSearch = r.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || (statusFilter === 'ACTIVE' ? r.is_active : !r.is_active);
    const matchProperty = propertyFilter === 'ALL' || String(r.property) === propertyFilter;
    return matchSearch && matchStatus && matchProperty;
  });

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await bookingAPI.deleteRoom(deleteTarget.id);
      await fetchData();
      setDeleteTarget(null);
    } catch (err) { alert(err.response?.data?.error || 'Failed to delete room'); }
    finally { setDeleteLoading(false); }
  };

  if (loading) return <PageSpinner label="Loading rooms..." />;

  return (
    <div className="h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 flex flex-col">
      <Navbar />
      <div className="flex flex-1 min-h-0">
        <Sidebar userRole={user.role} collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(p => !p)} />

        <div className="flex-1 p-6 overflow-y-auto min-h-0">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BedDouble className="w-6 h-6 text-green-500" /> Rooms
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">{filtered.length} of {rooms.length} rooms</p>
            </div>
            <div className="flex items-center gap-3">
              {can('rooms.manage') && <Button icon={Plus} onClick={() => { setEditingRoom(null); setShowForm(true); }}>Add Room</Button>}
              <RefreshButton onClick={live.refresh} refreshing={live.refreshing} lastUpdated={live.lastUpdated} />
            </div>
          </div>

          <BookingLinkCard />

          <SearchFilterBar search={search} onSearchChange={setSearch} placeholder="Search rooms...">
            <select
              value={propertyFilter} onChange={e => setPropertyFilter(e.target.value)}
              className="px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="ALL">All Properties</option>
              {properties.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
            </select>
            <select
              value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Listed</option>
              <option value="INACTIVE">Unlisted</option>
            </select>
          </SearchFilterBar>

          {filtered.length === 0 ? (
            <Card><EmptyState icon={BedDouble} title="No rooms yet" description="Add your first room to start accepting bookings." /></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(room => {
                const primaryImg = room.images.find(i => i.is_primary) || room.images[0];
                return (
                  <Card key={room.id} hover className="overflow-hidden group relative">
                    <div className="aspect-video bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                      {primaryImg ? <img src={primaryImg.image} alt={room.name} className="w-full h-full object-cover" /> : <ImageOff className="w-8 h-8 text-slate-400" />}
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <h3 className="font-semibold text-slate-900 dark:text-white">{room.name}</h3>
                        <Badge tone={room.is_active ? 'green' : 'slate'}>{room.is_active ? 'Listed' : 'Unlisted'}</Badge>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                        {room.property_name && <span className="font-medium">{room.property_name}</span>}
                        {room.property_name && ' · '}
                        {ROOM_TYPE_LABELS[room.room_type] || room.room_type}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400"><UsersIcon className="w-3.5 h-3.5" /> {room.capacity} guest{room.capacity !== 1 ? 's' : ''}</span>
                        <PriceTag amount={room.price_per_night} suffix="/ night" className="font-semibold text-slate-900 dark:text-white text-sm" />
                      </div>
                      {can('rooms.manage') && <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => { setEditingRoom(room); setShowForm(true); }}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white text-xs font-medium rounded-lg transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button
                          onClick={() => setDeleteTarget(room)}
                          className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <RoomFormModal isOpen={showForm} onClose={() => setShowForm(false)} onSuccess={fetchData} room={editingRoom} />

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Delete Room</h3>
            <p className="text-slate-600 dark:text-slate-300 text-sm mb-1">Delete <strong className="text-slate-900 dark:text-white">{deleteTarget.name}</strong>?</p>
            <p className="text-xs text-slate-500 dark:text-slate-500 mb-5">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} disabled={deleteLoading} className="flex-1 px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white text-sm font-medium rounded-lg disabled:opacity-50">Cancel</button>
              <button onClick={confirmDelete} disabled={deleteLoading} className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg disabled:opacity-50">
                {deleteLoading ? 'Deleting...' : 'Delete Room'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomsList;
