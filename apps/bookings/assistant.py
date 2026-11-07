"""Guest assistant for the public booking site.

Hybrid by design:
1. A built-in helper answers the common questions instantly from live data
   (find stays by place / price / guests / amenities / dates, live
   availability, the guest's own bookings, check-in times, cancellation,
   payment and contact details).
2. Anything it doesn't recognise goes to a private LLM (Ollama) together with
   a short list of public FACTS - the model gets no tools, so it can only
   phrase what we hand it. If the LLM is off or unreachable the helper falls
   back to its menu.

Anonymous visitors can use it; "my bookings" needs a logged-in guest.
"""
import calendar
import logging
import re
import time
from datetime import date, timedelta

import httpx
from django.conf import settings

from .models import Booking, BookingSettings
from .public_stays import public_stays
from . import services

logger = logging.getLogger(__name__)

DEFAULT_SUGGESTIONS = ['Find a stay', 'Rooms free tonight', 'My bookings', 'Cancellation policy']
AMENITY_WORDS = {
    'pool': ['pool', 'swim'], 'wifi': ['wifi', 'wi-fi', 'internet'], 'ac': ['ac', 'air con', 'a/c'],
    'parking': ['parking'], 'breakfast': ['breakfast'], 'gym': ['gym', 'fitness'], 'spa': ['spa'],
    'restaurant': ['restaurant'], 'tv': ['tv'], 'geyser': ['geyser', 'hot water'],
}
SEARCH_WORDS = (
    'room', 'rooms', 'stay', 'stays', 'hotel', 'hotels', 'resort', 'resorts', 'available', 'availability', 'vacancy',
    'book', 'cheap', 'cheapest', 'budget', 'price', 'prices', 'rate', 'rates', 'tariff', 'best', 'top rated', 'find',
)
MONTHS = {m.lower(): i for i, m in enumerate(calendar.month_abbr) if m}


# ── Small helpers ─────────────────────────────────────────────────────────────

def inr(amount):
    """1234567 -> '₹12,34,567' (Indian grouping)."""
    n = int(round(float(amount or 0)))
    s = str(abs(n))
    if len(s) > 3:
        head, tail = s[:-3], s[-3:]
        head = re.sub(r'(\d)(?=(\d\d)+$)', r'\1,', head)
        s = f'{head},{tail}'
    return f"{'-' if n < 0 else ''}₹{s}"


def short_place(address=''):
    parts = [re.sub(r'\b\d{5,6}\b', '', p).strip() for p in (address or '').split(',')]
    parts = [p for p in parts if p]
    return parts[-1] if len(parts) > 1 else (parts[0] if parts else '')


def nice_date(d):
    return f"{d:%a}, {d.day} {d:%b}"


def has(text, *words):
    return any(re.search(rf'\b{re.escape(w)}\b', text) for w in words)


def parse_dates(text, today):
    """(check_in, check_out) mentioned in the message, or (None, None)."""
    found = []
    for y, m, d in re.findall(r'\b(\d{4})-(\d{2})-(\d{2})\b', text):
        try:
            found.append(date(int(y), int(m), int(d)))
        except ValueError:
            pass
    month = r'(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*'
    pattern = rf'\b(\d{{1,2}})(?:st|nd|rd|th)?\s+{month}\b|\b{month}\s+(\d{{1,2}})(?:st|nd|rd|th)?\b'
    for m in re.finditer(pattern, text):
        day, mon = (m.group(1), m.group(2)) if m.group(1) else (m.group(4), m.group(3))
        try:
            d = date(today.year, MONTHS[mon[:3]], int(day))
        except ValueError:
            continue
        if d < today:
            d = d.replace(year=today.year + 1)
        found.append(d)

    check_in = check_out = None
    if found:
        check_in = found[0]
        check_out = found[1] if len(found) > 1 and found[1] > found[0] else None
    elif has(text, 'tonight', 'today'):
        check_in = today
    elif has(text, 'day after tomorrow'):
        check_in = today + timedelta(days=2)
    elif has(text, 'tomorrow'):
        check_in = today + timedelta(days=1)
    elif has(text, 'weekend', 'this weekend'):
        check_in = today + timedelta(days=(5 - today.weekday()) % 7)
        check_out = check_in + timedelta(days=2)
    if not check_in:
        return None, None
    nights = re.search(r'\b(\d{1,2})\s*nights?\b', text)
    if nights and not check_out:
        check_out = check_in + timedelta(days=max(1, int(nights.group(1))))
    check_out = check_out or check_in + timedelta(days=1)
    if check_in < today:
        return None, None
    return check_in, check_out


def parse_guests(text):
    m = re.search(r'\b(\d{1,2})\s*(?:guests?|people|persons?|adults?|pax|members?)\b', text) or \
        re.search(r'\bfor\s+(\d{1,2})\b(?!\s*nights?)', text)
    return max(1, min(20, int(m.group(1)))) if m else None


def parse_budget(text):
    m = re.search(r'\b(?:under|below|less than|within|upto|up to|max(?:imum)?|budget(?: of)?)\s*(?:rs\.?|inr|₹)?\s*(\d[\d,]*)\s*(k)?', text)
    if not m:
        return None
    value = int(m.group(1).replace(',', ''))
    return value * 1000 if m.group(2) else value


def stay_card(s):
    return {
        'id': s['id'], 'name': s['name'], 'place': short_place(s.get('address')),
        'cover_image': s.get('cover_image'), 'min_price': s.get('min_price'),
        'rating_avg': s.get('rating_avg'), 'rating_count': s.get('rating_count', 0),
        'available_rooms': s.get('available_rooms'),
    }


def stay_query(check_in=None, check_out=None, guests=None, q=None):
    parts = []
    if q:
        parts.append(f'q={q}')
    if check_in and check_out:
        parts += [f'check_in={check_in.isoformat()}', f'check_out={check_out.isoformat()}']
    if guests and guests > 1:
        parts.append(f'guests={guests}')
    return f"?{'&'.join(parts)}" if parts else ''


def reply(text, *, stays=None, bookings=None, actions=None, suggestions=None, source='assistant'):
    return {
        'reply': text, 'stays': stays or [], 'bookings': bookings or [], 'actions': actions or [],
        'suggestions': DEFAULT_SUGGESTIONS if suggestions is None else suggestions, 'source': source,
    }


# ── The assistant ─────────────────────────────────────────────────────────────

class GuestAssistant:
    def __init__(self, user, build_url, context=None, history=None, today=None):
        self.user = user if getattr(user, 'is_authenticated', False) else None
        self.is_guest = bool(self.user and self.user.role == 'CUSTOMER')
        self.build_url = build_url
        self.context = context or {}
        self.history = history or []
        self.today = today or date.today()
        self._stays = None

    # Data -------------------------------------------------------------------
    def stays(self, check_in=None, check_out=None, guests=None):
        if check_in or guests or self._stays is None:
            data = public_stays(self.build_url, check_in, check_out, guests)
            if not (check_in or guests):
                self._stays = data
            return data
        return self._stays

    def context_org(self, stays):
        org_id = self.context.get('org_id')
        return next((s for s in stays if str(s['id']) == str(org_id)), None)

    def mentioned(self, text, stays):
        """Stays named in the message, or in a place named in the message."""
        named = [s for s in stays if s['name'].lower() in text]
        if named:
            return named, None
        for s in stays:
            place = short_place(s.get('address')).lower()
            if place and len(place) > 2 and re.search(rf'\b{re.escape(place)}\b', text):
                return [x for x in stays if short_place(x.get('address')).lower() == place], short_place(s['address'])
        return None, None

    def my_bookings(self):
        upcoming = list(
            Booking.objects.filter(customer=self.user, check_out__gte=self.today)
            .exclude(status__in=['CANCELLED', 'CHECKED_OUT'])
            .select_related('organization', 'room').order_by('check_in')[:5]
        )
        return upcoming

    # Entry point -------------------------------------------------------------
    def answer(self, message):
        text = ' '.join(message.lower().split())
        if not text:
            return self.menu()
        for check, handler in (
            (lambda: has(text, 'my booking', 'my bookings', 'my trip', 'my trips', 'my reservation', 'my stay', 'booking status', 'my order'), self.bookings),
            (lambda: has(text, 'cancel', 'cancellation', 'refund'), self.cancellation),
            (lambda: has(text, 'check-in', 'check in', 'checkin', 'check-out', 'check out', 'checkout') and has(text, 'time', 'when', 'timing', 'timings', 'what time'), self.times),
            (lambda: has(text, 'pay', 'payment', 'upi', 'card', 'cash', 'razorpay', 'advance'), self.payment),
            (lambda: has(text, 'contact', 'phone', 'call', 'email', 'number', 'address', 'location', 'reach'), self.contact),
            (lambda: self.looks_like_search(text), self.search),
            (lambda: has(text, 'hi', 'hello', 'hey', 'namaste', 'help', 'menu', 'what can you do', 'good morning', 'good evening', 'good afternoon'), lambda _t: self.menu(greet=True)),
        ):
            if check():
                return handler(text)
        return self.ask_llm(message)

    def looks_like_search(self, text):
        if parse_dates(text, self.today)[0] or parse_budget(text) or parse_guests(text):
            return True
        if has(text, *SEARCH_WORDS) or any(has(text, *words) for words in AMENITY_WORDS.values()):
            return True
        # Just a place or property name ("Ooty", "Lake View Inn") is a search;
        # a longer question that merely mentions one ("is Goa nice in December?") isn't.
        return len(text.split()) <= 3 and bool(self.mentioned(text, self.stays())[0])

    # Handlers ----------------------------------------------------------------
    def menu(self, greet=False):
        name = f' {self.user.first_name}' if self.is_guest and self.user.first_name else ''
        intro = f"Hi{name}! 👋 I'm the CoreX Stays assistant." if greet else "I can help with that kind of question:"
        return reply(
            f"{intro} I can find stays by place, price or dates, check live room availability, "
            "show your bookings, and explain check-in, payment and cancellation rules.",
        )

    def search(self, text):
        check_in, check_out = parse_dates(text, self.today)
        if not check_in and self.context.get('check_in') and self.context.get('check_out'):
            try:
                check_in = date.fromisoformat(self.context['check_in'])
                check_out = date.fromisoformat(self.context['check_out'])
                if check_in < self.today or check_out <= check_in:
                    check_in = check_out = None
            except ValueError:
                check_in = check_out = None
        guests = parse_guests(text) or (int(self.context['guests']) if str(self.context.get('guests', '')).isdigit() else None)
        budget = parse_budget(text)
        stays = self.stays(check_in, check_out, guests)

        picked, place = self.mentioned(text, stays)
        org = self.context_org(stays)
        if picked is None:
            picked = [org] if org and not has(text, 'other', 'all', 'any', 'cheapest', 'best') else stays
        results = list(picked)
        if guests:
            results = [s for s in results if (s.get('max_capacity') or 0) >= guests]
        if budget:
            results = [s for s in results if float(s['min_price'] or 0) <= budget]
        wanted = [k for k, words in AMENITY_WORDS.items() if has(text, *words)]
        for k in wanted:
            results = [s for s in results if any(any(w in a.lower() for w in AMENITY_WORDS[k]) for a in s.get('amenities', []))]
        sold_out = []
        if check_in:
            sold_out = [s for s in results if not s.get('available_rooms')]
            results = [s for s in results if s.get('available_rooms')]

        if has(text, 'cheap', 'cheapest', 'budget', 'lowest', 'low price') or budget:
            results.sort(key=lambda s: float(s['min_price'] or 0))
        else:
            results.sort(key=lambda s: (-(s.get('rating_avg') or 0), float(s['min_price'] or 0)))

        bits = []
        if place:
            bits.append(f'in {place}')
        if budget:
            bits.append(f'under {inr(budget)}/night')
        if guests:
            bits.append(f'for {guests} guest{"s" if guests > 1 else ""}')
        if wanted:
            bits.append('with ' + ', '.join(w.upper() if w in ('ac', 'tv') else w for w in wanted))
        when = f' from {nice_date(check_in)} to {nice_date(check_out)}' if check_in else ''
        scope = (' ' + ' '.join(bits)) if bits else ''
        see_all = {'label': 'See all results', 'to': f"/book/stays{stay_query(check_in, check_out, guests, place)}"}

        if not results:
            msg = f"I couldn't find stays{scope}{' with rooms free' + when if check_in else ''}."
            if sold_out:
                msg += f" {len(sold_out)} matching propert{'y is' if len(sold_out) == 1 else 'ies are'} fully booked for those dates - try other dates."
            else:
                msg += ' Try a higher budget, fewer filters or another place.'
            return reply(msg, actions=[see_all], suggestions=['Rooms free this weekend', 'Cheapest stays', 'Find a stay'])

        if len(results) == 1 and org and results[0]['id'] == org['id']:
            s = results[0]
            if check_in:
                msg = (f"Good news - {s['name']} has {s['available_rooms']} room{'s' if s['available_rooms'] > 1 else ''} "
                       f"free{when}, from {inr(s['min_price'])}/night.")
            else:
                msg = f"{s['name']} has rooms from {inr(s['min_price'])}/night. Tell me your dates and I'll check what's free."
            actions = [{'label': 'See rooms', 'to': f"/book/{s['id']}{stay_query(check_in, check_out, guests)}"}]
            return reply(msg, stays=[stay_card(s)], actions=actions,
                         suggestions=None if check_in else ['Rooms free tonight', 'Rooms free tomorrow', 'This weekend'])

        count = len(results)
        msg = f"I found {count} stay{'s' if count != 1 else ''}{scope}"
        msg += f" with rooms free{when}." if check_in else '.'
        if not check_in:
            msg += " Add your dates (e.g. “tomorrow for 2 nights”) and I'll check live availability."
        return reply(msg, stays=[stay_card(s) for s in results[:4]], actions=[see_all],
                     suggestions=None if check_in else ['Rooms free tonight', 'This weekend', 'Cheapest stays'])

    def bookings(self, _text=''):
        if not self.is_guest:
            return reply(
                'Log in with your guest account and I can show your bookings, payments due and cancellation deadlines.',
                actions=[{'label': 'Log in', 'to': '/book/login?next=/book/me/trips'}],
                suggestions=['Find a stay', 'Cancellation policy'],
            )
        upcoming = self.my_bookings()
        if not upcoming:
            return reply("You don't have any upcoming bookings. Want me to find a stay?",
                         actions=[{'label': 'My trips', 'to': '/book/me/trips'}],
                         suggestions=['Find a stay', 'Rooms free this weekend'])
        rows = []
        for b in upcoming:
            due = services.balance_due(b)
            rows.append({
                'id': b.id, 'property': b.organization.name, 'room': b.room.name,
                'check_in': b.check_in.isoformat(), 'check_out': b.check_out.isoformat(),
                'status': b.status, 'status_label': b.get_status_display(),
                'balance_due': str(due), 'can_cancel': services.guest_can_cancel(b),
            })
        first = upcoming[0]
        msg = (f"You have {len(upcoming)} upcoming booking{'s' if len(upcoming) > 1 else ''}. "
               f"Next: {first.organization.name}, {nice_date(first.check_in)} → {nice_date(first.check_out)} "
               f"({first.get_status_display().lower()}).")
        return reply(msg, bookings=rows, actions=[{'label': 'Open My trips', 'to': '/book/me/trips'}],
                     suggestions=['Cancellation policy', 'Check-in time', 'Find a stay'])

    def _rules(self, org_id):
        from apps.tenants.models import Organization
        org = Organization.objects.filter(pk=org_id).first()
        return (org, BookingSettings.for_org(org)) if org else (None, None)

    def cancellation(self, _text=''):
        lines = []
        if self.is_guest:
            for b in self.my_bookings()[:3]:
                if services.guest_can_cancel(b):
                    deadline = services.cancellation_deadline(b)
                    lines.append(f"• {b.organization.name} ({nice_date(b.check_in)}): free cancellation until "
                                 f"{deadline:%a, %d %b, %I:%M %p}.")
                else:
                    lines.append(f"• {b.organization.name} ({nice_date(b.check_in)}): the free-cancellation window has passed - "
                                 + ('your cancellation request is waiting for the property.' if b.cancel_request_status == 'PENDING'
                                    else 'you can send a cancellation request from My trips.'))
        org_id = self.context.get('org_id')
        if org_id:
            org, rules = self._rules(org_id)
            if org:
                hours = rules.free_cancellation_hours
                rule = f'until {hours} hours before check-in' if hours else 'until check-in time'
                msg = f"At {org.name} you can cancel for free {rule}, from My trips."
                if rules.cancellation_policy:
                    msg += f" Their policy: {rules.cancellation_policy.strip()[:400]}"
                if lines:
                    msg += '\n\nYour bookings:\n' + '\n'.join(lines)
                return reply(msg, actions=[{'label': 'My trips', 'to': '/book/me/trips'}])
        msg = ('Each property sets its own free-cancellation window (usually up to 24 hours before check-in). '
               "You'll see it on the property page and in your confirmation, and you can cancel from My trips. "
               'After that window you can still send the property a cancellation request from My trips. '
               'Refunds for online payments go back to the original payment method.')
        if lines:
            msg += '\n\nYour bookings:\n' + '\n'.join(lines)
        return reply(msg, actions=[{'label': 'My trips', 'to': '/book/me/trips'}])

    def times(self, _text=''):
        org_id = self.context.get('org_id')
        if org_id:
            org, rules = self._rules(org_id)
            if org:
                return reply(f"At {org.name}, check-in is from {rules.check_in_time:%I:%M %p} and check-out is by "
                             f"{rules.check_out_time:%I:%M %p}. For early check-in or late check-out, contact the property.",
                             suggestions=['Contact the property', 'Cancellation policy', 'Rooms free tonight'])
        rows = BookingSettings.objects.select_related('organization').filter(
            organization_id__in=[s['id'] for s in self.stays()])[:5]
        if not rows:
            return reply('Check-in is usually from 2:00 PM and check-out by 11:00 AM - each property shows its times on its page.')
        listing = '\n'.join(f"• {r.organization.name}: in from {r.check_in_time:%I:%M %p}, out by {r.check_out_time:%I:%M %p}" for r in rows)
        return reply(f'Check-in and check-out times by property:\n{listing}')

    def payment(self, _text=''):
        from .razorpay_client import get_client
        online = get_client() is not None
        how = ('You can pay securely online (card, UPI or net banking) or pay at the property, '
               if online else 'Payment is made at the property when you arrive, ')
        org_id = self.context.get('org_id')
        extra = ''
        if org_id:
            org, rules = self._rules(org_id)
            if org:
                extra = (f" {org.name} confirms bookings instantly." if rules.auto_confirm
                         else f" {org.name} reviews each request first - you'll be able to pay once it's confirmed.")
        return reply(how + 'depending on the property. There are no booking fees - the price you see is what the property charges.' + extra,
                     suggestions=['My bookings', 'Cancellation policy', 'Find a stay'])

    def contact(self, _text=''):
        org_id = self.context.get('org_id')
        if org_id:
            org, _ = self._rules(org_id)
            if org:
                parts = [p for p in (
                    f'📞 {org.contact_phone}' if org.contact_phone else '',
                    f'✉️ {org.contact_email}' if org.contact_email else '',
                    f'📍 {org.address}' if org.address else '',
                ) if p]
                if parts:
                    return reply(f'You can reach {org.name} at:\n' + '\n'.join(parts))
                return reply(f"{org.name} hasn't added contact details yet - you can reach the front desk on arrival.")
        stays = self.stays()[:6]
        return reply('Which property would you like to contact? Open its page and I can share its phone, email and address.',
                     stays=[stay_card(s) for s in stays[:4]], suggestions=[s['name'] for s in stays[:4]] or None)

    # LLM fallback --------------------------------------------------------------
    def facts(self):
        lines = [f'Today is {self.today:%A, %d %B %Y}.', 'Site: CoreX Stays - book rooms directly with the property, no booking fees.']
        org_id = self.context.get('org_id')
        for s in self.stays()[:15]:
            lines.append(
                f"- {s['name']} ({short_place(s.get('address')) or 'location on request'}): from {inr(s['min_price'])}/night, "
                f"rating {s['rating_avg'] or 'new'}, sleeps up to {s['max_capacity']}, amenities: {', '.join(s['amenities'][:6]) or 'not listed'}, "
                f"free cancellation until {s['free_cancellation_hours'] or 0}h before check-in, "
                f"{'instant confirmation' if s['auto_confirm'] else 'confirmed by the property'}."
                + (' [the page the guest is viewing]' if str(s['id']) == str(org_id) else '')
            )
        if self.is_guest:
            for b in self.my_bookings()[:3]:
                lines.append(f"- Guest's booking: {b.organization.name}, {b.check_in} to {b.check_out}, {b.get_status_display()}.")
        return '\n'.join(lines)

    def ask_llm(self, message):
        global _llm_down_until
        if not getattr(settings, 'GUEST_ASSISTANT_LLM', False) or time.monotonic() < _llm_down_until:
            return self.menu()
        system = (
            'You are the friendly booking assistant for CoreX Stays, a site where guests book rooms directly with properties. '
            'Answer ONLY using the FACTS below. If the answer is not in the facts, say you are not sure and suggest contacting the property '
            'or using the search. Never invent prices, availability, policies or contact details. You cannot make, change or cancel bookings - '
            'point the guest to the property page or My trips instead. Reply in 1-4 short sentences, in the language the guest uses.\n\nFACTS:\n'
            + self.facts()
        )
        msgs = [{'role': 'system', 'content': system}]
        for turn in self.history[-6:]:
            role = turn.get('role')
            if role in ('user', 'assistant') and isinstance(turn.get('content'), str):
                msgs.append({'role': role, 'content': turn['content'][:500]})
        msgs.append({'role': 'user', 'content': message[:500]})
        try:
            resp = httpx.post(
                f"{settings.GUEST_ASSISTANT_LLM_URL.rstrip('/')}/api/chat",
                json={'model': settings.GUEST_ASSISTANT_MODEL, 'messages': msgs, 'stream': False,
                      # Keep the model loaded so the next guest doesn't wait for a cold start.
                      'keep_alive': '30m',
                      'options': {'temperature': 0.2, 'num_predict': 300}},
                timeout=settings.GUEST_ASSISTANT_LLM_TIMEOUT,
            )
            resp.raise_for_status()
            content = (resp.json().get('message') or {}).get('content', '').strip()
            if content:
                return reply(content, source='ai')
        except Exception as exc:  # unreachable / model missing / timeout - use the built-in helper
            logger.warning('Guest assistant LLM unavailable: %s', exc)
            _llm_down_until = time.monotonic() + 60
        return self.menu()


_llm_down_until = 0.0
