"""A4 lift poster with a QR code to the complaint portal.

Usage: python3 make_poster.py "https://ankurnapa.github.io/rwa-safety/"
No URL gives a DRAFT poster with a dummy code, so it cannot be printed by mistake.
"""
import sys
from datetime import date

from reportlab.graphics import renderPDF
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

SOCIETY = "Godrej Park Retreat residents' safety initiative"
# Copperline palette
GREEN, CREAM, INK, MUTED = HexColor('#4e79a7'), HexColor('#f6f7f9'), HexColor('#2b3137'), HexColor('#667085')
RUST = HexColor('#d65a57')
AMBER_BG, AMBER = HexColor('#fff4e0'), HexColor('#e8b765')
W, H = A4


def qr(c, url, x, y, size):
    widget = QrCodeWidget(url, barLevel='M')
    x0, y0, x1, y1 = widget.getBounds()
    d = Drawing(size, size, transform=[size / (x1 - x0), 0, 0, size / (y1 - y0), 0, 0])
    d.add(widget)
    renderPDF.draw(d, c, x, y)


def centred(c, text, y, font, size, colour=INK):
    c.setFont(font, size)
    c.setFillColor(colour)
    c.drawCentredString(W / 2, y, text)


def build(url, out):
    draft = not url
    c = canvas.Canvas(out, pagesize=A4)
    c.setTitle('Report a safety problem: lift poster')
    c.setAuthor('Ankur Napa')
    c.setSubject(SOCIETY + ' complaint portal')

    c.setFillColor(CREAM)
    c.rect(0, 0, W, H, stroke=0, fill=1)

    # Header band
    c.setFillColor(GREEN)
    c.rect(0, H - 78 * mm, W, 78 * mm, stroke=0, fill=1)
    centred(c, SOCIETY.upper(), H - 18 * mm, 'Helvetica-Bold', 10, white)
    centred(c, 'Safety problem', H - 40 * mm, 'Helvetica-Bold', 40, white)
    centred(c, 'in the building?', H - 56 * mm, 'Helvetica-Bold', 40, white)
    centred(c, 'Lift, fire, gas, wiring or cracks? Report it in one minute.', H - 69 * mm, 'Helvetica', 15, white)

    # QR card
    card, qsize = 100 * mm, 86 * mm
    cx, cy = (W - card) / 2, H - 78 * mm - 10 * mm - card
    c.setFillColor(white)
    c.setStrokeColor(GREEN)
    c.setLineWidth(3)
    c.roundRect(cx, cy, card, card, 6 * mm, stroke=1, fill=1)
    qr(c, url or 'https://example.com/draft', cx + (card - qsize) / 2, cy + (card - qsize) / 2, qsize)
    centred(c, 'Scan with your phone camera', cy - 9 * mm, 'Helvetica-Bold', 16, GREEN)

    # Three steps
    steps = [('1', 'Scan the code'), ('2', 'Add details and a photo'), ('3', 'Get a ticket number')]
    col = W / 3
    sy = cy - 24 * mm
    for i, (n, label) in enumerate(steps):
        x = col * i + col / 2
        c.setFillColor(GREEN)
        c.circle(x, sy, 6.5 * mm, stroke=0, fill=1)
        c.setFillColor(white)
        c.setFont('Helvetica-Bold', 16)
        c.drawCentredString(x, sy - 2 * mm, n)
        c.setFillColor(INK)
        c.setFont('Helvetica', 12)
        c.drawCentredString(x, sy - 13 * mm, label)

    centred(c, 'No login. No name needed. Voice notes and photos welcome.', sy - 24 * mm,
            'Helvetica', 12, MUTED)
    centred(c, 'Emergency right now? Call 112. Fire 101. Ambulance 108.', sy - 34 * mm, 'Helvetica-Bold', 14, RUST)
    centred(c, 'English, Hindi, Kannada, Bangla, Odia, Punjabi, Tamil, Telugu, Malayalam, Marathi, Gujarati',
            sy - 42 * mm, 'Helvetica', 9.5, MUTED)

    # Child safety strip
    by = 24 * mm
    c.setFillColor(AMBER_BG)
    c.setStrokeColor(AMBER)
    c.setLineWidth(1.2)
    c.roundRect(16 * mm, by, W - 32 * mm, 17 * mm, 3 * mm, stroke=1, fill=1)
    centred(c, 'Children working or in danger? Call 1098 (Childline) or 112.', by + 9.5 * mm, 'Helvetica-Bold', 12)
    centred(c, 'You can stay anonymous. Please do not photograph children.', by + 4 * mm, 'Helvetica', 10, MUTED)

    centred(c, "A residents' initiative. Not an official app of the society, its committee or Godrej Properties.",
            12 * mm, 'Helvetica', 8.5, MUTED)
    centred(c, 'Printed ' + date.today().strftime('%d %B %Y'), 7.5 * mm, 'Helvetica', 7.5, MUTED)

    if draft:
        c.saveState()
        c.setFillColor(HexColor('#b42318'))
        c.setFillAlpha(0.25)
        c.setFont('Helvetica-Bold', 120)
        c.translate(W / 2, H / 2)
        c.rotate(35)
        c.drawCentredString(0, -40, 'DRAFT')
        c.restoreState()

    c.showPage()
    c.save()


if __name__ == '__main__':
    url = sys.argv[1].strip() if len(sys.argv) > 1 else ''
    if url and not url.startswith(('https://script.google.com/', 'https://ankurnapa.github.io/')):
        sys.exit('Use the GitHub Pages address or the Apps Script web app URL.')
    build(url, 'Lift_Poster.pdf' if url else 'Lift_Poster_DRAFT.pdf')
