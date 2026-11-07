import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BedDouble, Users } from 'lucide-react';
import { AmenityStrip } from './StayCards';
import { ROOM_TYPE_LABELS, formatMoney, nightsBetween, primaryImage } from './guestUtils';
import { BTN_PRIMARY, BTN_SECONDARY } from './site';

const RoomCard = ({ room, to, checkIn, checkOut }) => {
  const img = primaryImage(room);
  const nights = nightsBetween(checkIn, checkOut);
  const unavailable = room.available === false;

  return (
    <Link
      to={to}
      className={`group flex flex-col h-full rounded-2xl overflow-hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ${unavailable ? 'opacity-75' : ''}`}
    >
      <div className="relative aspect-[4/3] bg-slate-100 dark:bg-slate-700 overflow-hidden">
        {img ? (
          <img src={img} alt={room.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400"><BedDouble className="w-10 h-10" /></div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent" />
        <span className="absolute top-3 left-3 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide bg-white/95 text-slate-800 shadow-sm">
          {ROOM_TYPE_LABELS[room.room_type] || 'Room'}
        </span>
        {room.available === true && (
          <span className="absolute top-3 right-3 px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-600 text-white shadow-sm">Available</span>
        )}
        {unavailable && (
          <span className="absolute top-3 right-3 px-2.5 py-1 rounded-md text-[11px] font-bold bg-rose-600 text-white">Booked for your dates</span>
        )}
        <span className="absolute left-3 bottom-3 inline-flex items-center gap-1 text-xs font-semibold text-white">
          <Users className="w-3.5 h-3.5" /> Up to {room.capacity} guest{room.capacity === 1 ? '' : 's'}
        </span>
        <span className="absolute right-3 bottom-3 px-2.5 py-1 rounded-lg bg-black/55 backdrop-blur text-white text-sm font-bold">
          {formatMoney(room.price_per_night)}<span className="text-[11px] font-medium text-white/75"> /night</span>
        </span>
      </div>
      <div className="flex flex-col flex-1 p-4 gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-bold text-lg text-slate-900 dark:text-white truncate">{room.name}</h3>
            {room.property_name && <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{room.property_name}</p>}
          </div>
          {nights > 0 && (
            <p className="text-right text-sm text-slate-500 dark:text-slate-400 flex-shrink-0">
              <span className="block font-bold text-slate-900 dark:text-white">{formatMoney(room.price_per_night * nights)}</span>
              {nights} night{nights > 1 ? 's' : ''}
            </p>
          )}
        </div>
        <AmenityStrip amenities={room.amenities} />
        {unavailable
          ? <span className={`${BTN_SECONDARY} mt-auto h-11`}>View details</span>
          : <span className={`${BTN_PRIMARY} mt-auto h-11`}>Book now <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" /></span>}
      </div>
    </Link>
  );
};

export default RoomCard;
