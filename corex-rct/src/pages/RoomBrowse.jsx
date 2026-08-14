import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CustomerLayout from '../components/CustomerLayout';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import PriceTag from '../components/common/PriceTag';
import EmptyState from '../components/common/EmptyState';
import SearchFilterBar from '../components/common/SearchFilterBar';
import DateRangePicker from '../components/common/DateRangePicker';
import PageSpinner from '../components/common/PageSpinner';
import { useOrgInfo } from '../hooks/useOrgInfo';
import { bookingAPI } from '../services/api';
import { BedDouble, Users as UsersIcon, ImageOff } from 'lucide-react';

const ROOM_TYPE_LABELS = {
  SINGLE: 'Single Room', DOUBLE: 'Double Room', SUITE: 'Suite',
  DELUXE: 'Deluxe Room', CONFERENCE: 'Conference Room', OTHER: 'Other',
};

const RoomBrowse = () => {
  const { orgId, propertyId } = useParams();
  const navigate = useNavigate();
  const { org } = useOrgInfo(orgId);
  const [property, setProperty] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dates, setDates] = useState({ checkIn: '', checkOut: '' });

  const fetchRooms = useCallback(async () => {
    try {
      const [roomsRes, propRes] = await Promise.all([
        bookingAPI.getRooms({ property: propertyId }),
        bookingAPI.getProperty(propertyId),
      ]);
      setRooms(roomsRes.data || []);
      setProperty(propRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [propertyId]);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  const filtered = rooms.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));

  const goToRoom = (roomId) => {
    const params = new URLSearchParams();
    if (dates.checkIn) params.set('check_in', dates.checkIn);
    if (dates.checkOut) params.set('check_out', dates.checkOut);
    navigate(`/book/${orgId}/properties/${propertyId}/rooms/${roomId}${params.toString() ? `?${params}` : ''}`);
  };

  return (
    <CustomerLayout orgName={org?.name}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{property?.name || 'Available Rooms'}</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Pick your dates, then choose a room</p>
      </div>

      <SearchFilterBar search={search} onSearchChange={setSearch} placeholder="Search rooms...">
        <DateRangePicker checkIn={dates.checkIn} checkOut={dates.checkOut} onChange={setDates} className="flex-1 min-w-[280px]" />
      </SearchFilterBar>

      {loading ? (
        <PageSpinner label="Loading rooms..." />
      ) : filtered.length === 0 ? (
        <Card><EmptyState icon={BedDouble} title="No rooms available" description="Check back soon, or try a different search." /></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(room => {
            const primaryImg = room.images.find(i => i.is_primary) || room.images[0];
            return (
              <Card key={room.id} hover className="overflow-hidden cursor-pointer" onClick={() => goToRoom(room.id)}>
                <div className="aspect-video bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                  {primaryImg ? <img src={primaryImg.image} alt={room.name} className="w-full h-full object-cover" /> : <ImageOff className="w-8 h-8 text-slate-400" />}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h3 className="font-semibold text-slate-900 dark:text-white">{room.name}</h3>
                    <Badge tone="blue">{ROOM_TYPE_LABELS[room.room_type] || room.room_type}</Badge>
                  </div>
                  {room.description && <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">{room.description}</p>}
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400"><UsersIcon className="w-3.5 h-3.5" /> Sleeps {room.capacity}</span>
                    <PriceTag amount={room.price_per_night} suffix="/ night" className="font-semibold text-slate-900 dark:text-white text-sm" />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </CustomerLayout>
  );
};

export default RoomBrowse;
