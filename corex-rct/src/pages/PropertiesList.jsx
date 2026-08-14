import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import PageSpinner from '../components/common/PageSpinner';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import EmptyState from '../components/common/EmptyState';
import SearchFilterBar from '../components/common/SearchFilterBar';
import PropertyFormModal from '../components/PropertyFormModal';
import { useAuth } from '../context/AuthContext';
import { bookingAPI, userAPI } from '../services/api';
import { Building2, Plus, Pencil, Trash2, BedDouble, MapPin } from 'lucide-react';

const PropertiesList = () => {
  const { user } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [properties, setProperties] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingProperty, setEditingProperty] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [propsRes, usersRes] = await Promise.all([bookingAPI.getProperties(), userAPI.getUsers()]);
      setProperties(propsRes.data || []);
      setAllUsers(usersRes.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = properties.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await bookingAPI.deleteProperty(deleteTarget.id);
      await fetchData();
      setDeleteTarget(null);
    } catch (err) { alert(err.response?.data?.error || 'Failed to delete property'); }
    finally { setDeleteLoading(false); }
  };

  if (loading) return <PageSpinner label="Loading properties..." />;

  return (
    <div className="h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 flex flex-col">
      <Navbar />
      <div className="flex flex-1 min-h-0">
        <Sidebar userRole={user.role} users={allUsers} collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(p => !p)} />

        <div className="flex-1 p-6 overflow-y-auto min-h-0">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-6 h-6 text-green-500" /> Properties
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
                {filtered.length} of {properties.length} buildings — guests pick one of these before choosing a room
              </p>
            </div>
            <Button icon={Plus} onClick={() => { setEditingProperty(null); setShowForm(true); }}>Add Property</Button>
          </div>

          <SearchFilterBar search={search} onSearchChange={setSearch} placeholder="Search properties..." />

          {filtered.length === 0 ? (
            <Card>
              <EmptyState
                icon={Building2} title="No properties yet"
                description="Add each building/branch first — rooms belong to a property, and guests choose one before browsing rooms."
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(prop => (
                <Card key={prop.id} hover className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h3 className="font-semibold text-slate-900 dark:text-white">{prop.name}</h3>
                    <Badge tone={prop.is_active ? 'green' : 'slate'}>{prop.is_active ? 'Listed' : 'Unlisted'}</Badge>
                  </div>
                  {prop.address && (
                    <p className="flex items-start gap-1 text-xs text-slate-500 dark:text-slate-400 mb-2">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {prop.address}
                    </p>
                  )}
                  {prop.description && <p className="text-sm text-slate-500 dark:text-slate-400 mb-3 line-clamp-2">{prop.description}</p>}
                  <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mb-3">
                    <BedDouble className="w-3.5 h-3.5" /> {prop.room_count} room{prop.room_count !== 1 ? 's' : ''}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setEditingProperty(prop); setShowForm(true); }}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white text-xs font-medium rounded-lg transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => setDeleteTarget(prop)}
                      className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <PropertyFormModal isOpen={showForm} onClose={() => setShowForm(false)} onSuccess={fetchData} property={editingProperty} />

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Delete Property</h3>
            <p className="text-slate-600 dark:text-slate-300 text-sm mb-1">Delete <strong className="text-slate-900 dark:text-white">{deleteTarget.name}</strong>?</p>
            <p className="text-xs text-slate-500 dark:text-slate-500 mb-5">Rooms in this property will be deleted too. This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} disabled={deleteLoading} className="flex-1 px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white text-sm font-medium rounded-lg disabled:opacity-50">Cancel</button>
              <button onClick={confirmDelete} disabled={deleteLoading} className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg disabled:opacity-50">
                {deleteLoading ? 'Deleting...' : 'Delete Property'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PropertiesList;
