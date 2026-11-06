import React from 'react';
import { Link } from 'react-router-dom';
import { BedDouble, Users } from 'lucide-react';
import { amenityIcon } from './amenities';
import { ROOM_TYPE_LABELS, formatMoney, nightsBetween, primaryImage } from './guestUtils';

const RoomCard = ({ room, to, checkIn, checkOut }) => {
  const img = primaryImage(room);
  const nights = nightsBetween(checkIn, checkOut);
  const unavailable = room.available === false;

  return (
    <Link
      to={to}
      className={`group block rounded-2xl overflow-hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:shadow-xl hover:-translate-y-0.5 transition-all ${unavailable ? 'opacity-70' : ''}`}
    >
      <div className="relative aspect-[4/3] bg-slate-100 dark:bg-slate-700 overflow-hidden">
        {img ? (
          <img src={img} alt={room.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400"><BedDouble className="w-10 h-10" /></div>
        )}
        <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/95 text-slate-800 shadow-sm">
          {ROOM_TYPE_LABELS[room.room_type] || 'Room'}
        </span>
        {room.available === true && (
          <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-600 text-white shadow-sm">Available</span>
        )}
        {unavailable && (
          <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-900/80 text-white">Booked for your dates</span>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900 dark:text-white truncate">{room.name}</h3>
            {room.property_name && <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{room.property_name}</p>}
          </div>
          <span className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 flex-shrink-0">
            <Users className="w-4 h-4" /> {room.capacity}
          </span>
        </div>
        {room.amenities?.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
            {room.amenities.slice(0, 4).map(a => {
              const Icon = amenityIcon(a);
              return (
                <li key={a} className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                  <Icon className="w-3.5 h-3.5" />{a}
                </li>
              );
            })}
            {room.amenities.length > 4 && <li className="text-xs text-slate-400">+{room.amenities.length - 4} more</li>}
          </ul>
        )}
        <div className="mt-4 flex items-end justify-between">
          <p>
            <span className="text-lg font-bold text-slate-900 dark:text-white">{formatMoney(room.price_per_night)}</span>
            <span className="text-sm text-slate-500 dark:text-slate-400"> / night</span>
          </p>
          {nights > 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {formatMoney(room.price_per_night * nights)} total
            </p>
          )}
        </div>
      </div>
    </Link>
  );
};

export default RoomCard;
