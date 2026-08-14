/**
 * Business vertical for STP organizations (room booking, hotel, hospital, ...).
 * Mirrors Organization.ORG_TYPE_CHOICES in apps/tenants/models.py — keep in sync.
 * MSP organizations never have one.
 */
export const ORG_TYPES = [
  { value: 'ROOM_BOOKING', label: 'Room Booking & Reservations' },
  { value: 'HOTEL', label: 'Hotel & Resort Management' },
  { value: 'HOSPITAL', label: 'Hospital & Healthcare Management' },
  { value: 'OTHER', label: 'Other' },
];

export const orgTypeLabel = (value) => ORG_TYPES.find(t => t.value === value)?.label || value;
