"""Booking confirmation PDF ("voucher") that guests and staff can download."""
import io
from zoneinfo import ZoneInfo

from django.conf import settings
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from . import services

GREEN = colors.HexColor('#16a34a')
INK = colors.HexColor('#0f172a')
MUTED = colors.HexColor('#64748b')
LINE = colors.HexColor('#e2e8f0')
SOFT = colors.HexColor('#f8fafc')

STATUS_TEXT = {
    'PENDING': 'AWAITING CONFIRMATION', 'CONFIRMED': 'CONFIRMED', 'CHECKED_IN': 'CHECKED IN',
    'CHECKED_OUT': 'COMPLETED', 'CANCELLED': 'CANCELLED',
}


def booking_reference(booking):
    return f'CX-{booking.id:06d}'


def _money(value):
    # The PDF's built-in fonts have no ₹ glyph, so amounts read "INR 1,000.00".
    return f'INR {value:,.2f}'


def _date(d):
    return d.strftime('%a, %d %b %Y')


def _time(t):
    return t.strftime('%I:%M %p').lstrip('0')


def _qr(text, size=28 * mm):
    widget = QrCodeWidget(text)
    x1, y1, x2, y2 = widget.getBounds()
    drawing = Drawing(size, size, transform=[size / (x2 - x1), 0, 0, size / (y2 - y1), 0, 0])
    drawing.add(widget)
    return drawing


def build_voucher_pdf(booking):
    org = booking.organization
    rules = getattr(org, 'booking_settings', None)
    check_in_time = rules.check_in_time if rules else None
    check_out_time = rules.check_out_time if rules else None
    tz = ZoneInfo(getattr(settings, 'PROPERTY_TIMEZONE', 'Asia/Kolkata'))
    ref = booking_reference(booking)

    styles = getSampleStyleSheet()
    h_org = ParagraphStyle('org', parent=styles['Title'], alignment=0, fontSize=20, leading=24, textColor=INK, spaceAfter=2)
    small = ParagraphStyle('small', parent=styles['Normal'], fontSize=9, leading=12, textColor=MUTED)
    body = ParagraphStyle('body', parent=styles['Normal'], fontSize=10, leading=14, textColor=INK)
    label = ParagraphStyle('label', parent=small, fontSize=8, leading=10, textColor=MUTED)
    section = ParagraphStyle('section', parent=styles['Heading4'], fontSize=11, leading=14, textColor=INK, spaceBefore=10, spaceAfter=4)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=16 * mm,
                            title=f'Booking {ref}', author=org.name)
    story = []

    # Header: property + reference/QR
    contact = ' · '.join(x for x in [org.address, org.contact_phone, org.contact_email] if x)
    left = [Paragraph(org.name, h_org), Paragraph(contact or '&nbsp;', small), Spacer(1, 6),
            Paragraph(f'<font color="#16a34a"><b>BOOKING CONFIRMATION</b></font> &nbsp; '
                      f'<font color="#64748b">{STATUS_TEXT.get(booking.status, booking.status)}</font>', body)]
    right = [_qr(f'{ref} | {org.name} | {booking.check_in.isoformat()}'),
             Paragraph(f'<b>{ref}</b>', ParagraphStyle('ref', parent=body, alignment=1))]
    header = Table([[left, right]], colWidths=[doc.width - 34 * mm, 34 * mm])
    header.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('ALIGN', (1, 0), (1, 0), 'CENTER')]))
    story += [header, Spacer(1, 8)]

    def kv_grid(pairs, cols=3):
        cells = [[Paragraph(k.upper(), label), Paragraph(v or '-', body)] for k, v in pairs]
        rows = []
        for i in range(0, len(cells), cols):
            chunk = cells[i:i + cols] + [['', '']] * (cols - len(cells[i:i + cols]))
            rows.append([c for c in chunk])
        flat = [[cell for cell in row] for row in rows]
        t = Table([[Table([[c[0]], [c[1]]], colWidths=[doc.width / cols - 4]) if c[0] else '' for c in row] for row in flat],
                  colWidths=[doc.width / cols] * cols)
        t.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                               ('BACKGROUND', (0, 0), (-1, -1), SOFT), ('BOX', (0, 0), (-1, -1), 0.5, LINE),
                               ('LEFTPADDING', (0, 0), (-1, -1), 8), ('TOPPADDING', (0, 0), (-1, -1), 6)]))
        return t

    nights = (booking.check_out - booking.check_in).days
    story += [Paragraph('Your stay', section), kv_grid([
        ('Check-in', _date(booking.check_in) + (f', from {_time(check_in_time)}' if check_in_time else '')),
        ('Check-out', _date(booking.check_out) + (f', by {_time(check_out_time)}' if check_out_time else '')),
        ('Nights', str(nights)),
        ('Room', f'{booking.room.name} ({booking.room.get_room_type_display()})'),
        ('Property', booking.property.name if booking.property else org.name),
        ('Guests', str(booking.guests)),
    ])]

    story += [Paragraph('Guest', section), kv_grid([
        ('Name', booking.guest_name or booking.customer.get_full_name()),
        ('Email', booking.guest_email or booking.customer.email),
        ('Phone', booking.guest_phone or (booking.customer.phone or '')),
    ])]

    # Payment summary + received payments
    paid = services.amount_paid(booking)
    due = services.balance_due(booking)
    rows = [['Room charges', f'{nights} night{"s" if nights != 1 else ""}', _money(booking.total_amount)]]
    for p in booking.payments.filter(status__in=['PAID', 'REFUNDED']).order_by('paid_at', 'id'):
        when = p.paid_at.astimezone(tz).strftime('%d %b %Y') if p.paid_at else ''
        refunded = p.status == 'REFUNDED'
        rows.append([f'Payment received - {p.get_method_display()}' + (' (refunded)' if refunded else ''),
                     when, f'refunded {_money(p.amount)}' if refunded else f'- {_money(p.amount)}'])
    rows.append(['Amount paid', '', _money(paid)])
    rows.append(['Balance due', 'Pay at the property' if due > 0 and booking.payment_method == 'AT_PROPERTY' else '', _money(due)])
    pay = Table(rows, colWidths=[doc.width * 0.5, doc.width * 0.25, doc.width * 0.25])
    pay.setStyle(TableStyle([
        ('FONT', (0, 0), (-1, -1), 'Helvetica', 9.5), ('TEXTCOLOR', (0, 0), (-1, -1), INK),
        ('TEXTCOLOR', (1, 0), (1, -1), MUTED), ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
        ('LINEBELOW', (0, 0), (-1, -3), 0.5, LINE), ('LINEABOVE', (0, -2), (-1, -2), 1, INK),
        ('FONT', (0, -1), (-1, -1), 'Helvetica-Bold', 11),
        ('TEXTCOLOR', (2, -1), (2, -1), GREEN if due <= 0 else INK),
        ('TOPPADDING', (0, 0), (-1, -1), 5), ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    story += [Paragraph('Payment', section), pay]

    if booking.special_requests:
        story += [Paragraph('Special requests', section), Paragraph(booking.special_requests, body)]

    if booking.status in ('PENDING', 'CONFIRMED'):  # only relevant before the stay
        hours = rules.free_cancellation_hours if rules else 24
        deadline = services.cancellation_deadline(booking).astimezone(tz)
        rule = (f'Free cancellation until {deadline.strftime("%a, %d %b %Y, %I:%M %p").replace(" 0", " ")}'
                if hours else 'Free cancellation until check-in time.')
        story += [Paragraph('Cancellation', section), Paragraph(rule, body)]
        if rules and rules.cancellation_policy:
            story.append(Paragraph(rules.cancellation_policy.replace('\n', '<br/>'), small))

    story += [Spacer(1, 14), Paragraph(
        f'Please show this confirmation (or the reference <b>{ref}</b>) at check-in. '
        f'Booked on {booking.created_at.astimezone(tz).strftime("%d %b %Y")}. Bookings powered by CoreX.', small)]

    doc.build(story)
    return buf.getvalue()
