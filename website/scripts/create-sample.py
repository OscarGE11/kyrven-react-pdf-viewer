"""Regenerate the committed demo PDF with: python scripts/create-sample.py."""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor

root = Path(__file__).resolve().parent.parent
c = canvas.Canvas(str(root / 'public/sample.pdf'), pagesize=(595, 760))
c.setTitle('The Kyrven field guide')
c.setAuthor('Kyrven')
green, ink, muted = '#2CFF05', '#12200D', '#53604C'

def text(x, y, value, size=12, color=ink, font='Helvetica'):
    c.setFillColor(HexColor(color)); c.setFont(font, size); c.drawString(x, y, value)

def base(number):
    c.setFillColor(HexColor('#F4F6EF')); c.rect(0, 0, 595, 760, fill=1, stroke=0)
    text(46, 711, 'kyrven / field guide', 12, ink, 'Helvetica-Bold')
    c.setStrokeColor(HexColor('#C6CFBE')); c.line(46, 690, 549, 690)
    c.line(46, 52, 549, 52)
    text(46, 32, 'A sample document. Made to be explored.', 9, muted)
    text(526, 32, str(number).zfill(2), 9, muted)

base(1)
text(46, 611, 'Good documents.', 40, ink, 'Helvetica-Bold')
text(46, 563, 'Great experiences.', 40, ink, 'Helvetica-Bold')
text(47, 520, 'A small field guide to making room for what matters.', 13, muted)
c.setFillColor(HexColor(green)); c.roundRect(46, 207, 503, 264, 12, fill=1, stroke=0)
for i in range(4):
    c.setStrokeColor(HexColor(ink)); c.setLineWidth(1.4)
    c.roundRect(218+i*14, 248+i*10, 138, 170, 5, fill=0, stroke=1)
c.saveState()
c.translate(242, 380); c.scale(1.5, -1.5)
c.setFillColor(HexColor(ink))
p = c.beginPath(); p.moveTo(7, 12); p.curveTo(17, 12, 25, 16, 29, 23)
p.lineTo(29, 57); p.curveTo(23, 50, 16, 46, 7, 46); p.close()
c.drawPath(p, fill=1, stroke=0)
p = c.beginPath(); p.moveTo(35, 23); p.curveTo(38, 17, 42, 13, 47, 10)
p.lineTo(47, 24); p.lineTo(58, 24); p.lineTo(58, 43)
p.curveTo(48, 45, 40, 50, 35, 57); p.close(); c.drawPath(p, fill=1, stroke=0)
p = c.beginPath(); p.moveTo(51, 9); p.lineTo(60, 20); p.lineTo(51, 20)
p.close(); c.drawPath(p, fill=1, stroke=0)
c.restoreState()
text(67, 229, 'Built for a closer look.', 11, ink, 'Helvetica-Bold')
text(46, 163, 'This is a real PDF.', 18, ink, 'Helvetica-Bold')
text(46, 134, 'Zoom in. Rotate the page. Switch the reading layout.', 12, muted)
text(46, 113, 'Or open a document of your own and make yourself at home.', 12, muted)
c.showPage()
base(2)
text(46, 611, 'Room to read.', 40, ink, 'Helvetica-Bold')
text(46, 570, 'The right controls, exactly when you need them.', 13, muted)
items = [
 ('Find your perspective', ['Zoom into the details or fit the whole page.', 'Rotate a landscape document to get a better view.']),
 ('Read your way', ['Keep scrolling through a continuous document,', 'or focus on a single page at a time.']),
 ('Bring your own document', ['Choose a PDF from your device. This demo renders', 'local files in your browser without uploading them.']),
 ('Make it part of your app', ['A React component with configurable controls,', 'theme settings and labels in your own language.']),
]
for i, (title, lines) in enumerate(items):
    y = 492 - i*94
    c.setFillColor(HexColor(green)); c.circle(53, y+4, 6, fill=1, stroke=0)
    text(77, y, title, 18, ink, 'Helvetica-Bold')
    for j, line in enumerate(lines): text(77, y-25-j*18, line, 12, muted)
c.showPage()
base(3)
text(46, 611, 'A little less setup.', 38, ink, 'Helvetica-Bold')
text(46, 562, 'A lot more reading.', 38, ink, 'Helvetica-Bold')
text(46, 503, 'Install the package in your React application:', 13, muted)
c.setFillColor(HexColor(ink)); c.roundRect(46, 429, 503, 48, 6, fill=1, stroke=0)
text(65, 448, 'npm i @kyrven/react-pdf-viewer', 13, green, 'Courier')
text(46, 375, 'Built on Hayro', 21, ink, 'Helvetica-Bold')
text(46, 342, 'Rust parses and renders PDF pages through WebAssembly.', 12, muted)
text(46, 320, 'A web worker keeps document processing off the main thread.', 12, muted)
text(46, 254, 'Know your tools', 21, ink, 'Helvetica-Bold')
text(46, 221, 'Pages are rasterized. Text selection, search and interactive', 12, muted)
text(46, 199, 'forms are outside the current feature set.', 12, muted)
text(46, 116, 'Explore the documentation to build your own reader.', 13, ink, 'Helvetica-Bold')
c.save()
print(root / 'public/sample.pdf')
