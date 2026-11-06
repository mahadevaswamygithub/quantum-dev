import {
  AirVent, Bath, Car, Check, Coffee, Dumbbell, Flame, Refrigerator, Shirt, ShowerHead, Tv, Utensils, WavesLadder, Wifi, Wind,
} from 'lucide-react';

// Amenities are free text entered by staff; match common words to an icon.
const RULES = [
  [/wi-?fi|internet/i, Wifi],
  [/\bac\b|air ?con/i, AirVent],
  [/tv|television/i, Tv],
  [/park/i, Car],
  [/breakfast|coffee|tea/i, Coffee],
  [/kitchen|meal|food|restaurant/i, Utensils],
  [/gym|fitness/i, Dumbbell],
  [/pool|swim/i, WavesLadder],
  [/geyser|hot water|heater/i, Flame],
  [/shower/i, ShowerHead],
  [/bath|toilet|washroom/i, Bath],
  [/fridge|refrigerator/i, Refrigerator],
  [/laundry|iron/i, Shirt],
  [/fan/i, Wind],
];

export const amenityIcon = (name = '') => (RULES.find(([re]) => re.test(name)) || [null, Check])[1];
