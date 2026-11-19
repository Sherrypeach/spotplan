"""Extract the seating layout library from the seating arrangement deck (.pptx).

Usage: python3 scripts/extract-layouts.py <deck.pptx> src/modules/layouts/library.json

Requires Python 3.9+ and nothing outside the standard library. A full run
takes a couple of minutes, most of it decoding the carpet pictures.

Coordinates are in desk units: 1.0 = the long side of a single student desk.
The origin is the top-left of the stage (the area right of the info panel),
with FRONT along the top edge. Angles are degrees clockwise.

Furniture is drawn from its local outline, centered on (0, 0) with size w x h:
mirror it horizontally when `flipH` is set, rotate it by `rotation`, then move
it to (x, y). Local outlines:
  desk, rectangle-table, supply-desk, storage: a w x h rectangle
  trapezoid-table: the long side at local bottom; the short side at local top
    is inset by `inset` x w at each end
  triangle-table: right angle at local bottom-left, long side from local
    top-left to bottom-right
  carpet: see `shape`; semicircle and wedge are circle sectors whose center is
    the middle of the carpet's top edge, with radius h and the given `sweep`

A seat's `facing` is the direction the student looks (0 = toward the front).
"""
import json
import math
import posixpath
import re
import struct
import sys
import zipfile
import zlib
import xml.etree.ElementTree as ET

NS_P = '{http://schemas.openxmlformats.org/presentationml/2006/main}'
NS_A = '{http://schemas.openxmlformats.org/drawingml/2006/main}'
NS_R = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'

DESK_EMU = 690000          # long side of a desk shape
CHAIR_EMU = 264300         # diameter of a chair dot
STAGE_X = 1746600          # left edge of the stage (right of the info panel)
STAGE_W = 9144000 - STAGE_X
STAGE_H = 5143500
FRONT_BAR_BOTTOM = 160000  # anything above this is the FRONT label

SECTIONS = [
    (24, 62, 'desks'),
    (64, 71, 'rectangle-tables'),
    (73, 83, 'trapezoid-tables'),
    (85, 95, 'triangle-tables'),
    (97, 122, 'carpets'),
]

# Preset geometry defaults from the OOXML spec, used when a shape doesn't set its own.
DEFAULT_TRAPEZOID_ADJ = 25000

CARPET_SECTORS = {'semicircle': 180, 'wedge': 90}


class ExtractError(Exception):
    pass


# --- Shape geometry -------------------------------------------------------

def read_xfrm(el):
    off = el.find(NS_A + 'off')
    ext = el.find(NS_A + 'ext')
    d = dict(x=int(off.get('x')), y=int(off.get('y')),
             w=int(ext.get('cx')), h=int(ext.get('cy')),
             rot=int(el.get('rot', '0')) / 60000,
             fh=el.get('flipH') == '1', fv=el.get('flipV') == '1')
    ch_off = el.find(NS_A + 'chOff')
    ch_ext = el.find(NS_A + 'chExt')
    if ch_off is not None:
        d.update(cx=int(ch_off.get('x')), cy=int(ch_off.get('y')),
                 cw=int(ch_ext.get('cx')) or 1, ch=int(ch_ext.get('cy')) or 1)
    return d


def flip_rotate(x, y, cx, cy, fh, fv, rot):
    """Apply an OOXML flip then rotation about (cx, cy)."""
    if fh:
        x = 2 * cx - x
    if fv:
        y = 2 * cy - y
    if rot:
        r = math.radians(rot)
        dx, dy = x - cx, y - cy
        x = cx + dx * math.cos(r) - dy * math.sin(r)
        y = cy + dx * math.sin(r) + dy * math.cos(r)
    return x, y


def to_slide(groups, x, y):
    """Map a point from innermost group space to slide space."""
    for g in groups:
        x = g['x'] + (x - g['cx']) * g['w'] / g['cw']
        y = g['y'] + (y - g['cy']) * g['h'] / g['ch']
        x, y = flip_rotate(x, y, g['x'] + g['w'] / 2, g['y'] + g['h'] / 2, g['fh'], g['fv'], g['rot'])
    return x, y


def local_outline(geom, w, h, adj):
    """Outline of a preset shape in its own box, before any flip or rotation."""
    if geom == 'trapezoid':
        inset = min(w, h) * adj / 100000
        return [(inset, 0), (w - inset, 0), (w, h), (0, h)]
    if geom == 'rtTriangle':
        return [(0, 0), (w, h), (0, h)]
    return [(0, 0), (w, 0), (w, h), (0, h)]


def orientation(groups, d):
    """Rotation and mirroring of a shape on the slide, as (degrees, mirrored).

    Mirroring is expressed as a horizontal flip applied before the rotation;
    a vertical flip is the same as a horizontal flip plus 180 degrees.
    """
    # Track where the shape's local x and y axes end up.
    ax = flip_rotate(1, 0, 0, 0, d['fh'], d['fv'], d['rot'])
    ay = flip_rotate(0, 1, 0, 0, d['fh'], d['fv'], d['rot'])
    for g in groups:
        ax = flip_rotate(ax[0], ax[1], 0, 0, g['fh'], g['fv'], g['rot'])
        ay = flip_rotate(ay[0], ay[1], 0, 0, g['fh'], g['fv'], g['rot'])
    mirrored = ax[0] * ay[1] - ax[1] * ay[0] < 0
    # With a horizontal flip first, the rotated local x axis points opposite to ax.
    ux, uy = (-ax[0], -ax[1]) if mirrored else ax
    return math.degrees(math.atan2(uy, ux)) % 360, mirrored


def read_adj(sppr):
    gd = sppr.find(f'{NS_A}prstGeom/{NS_A}avLst/{NS_A}gd')
    if gd is None:
        return DEFAULT_TRAPEZOID_ADJ
    return int(gd.get('fmla').split()[-1])


def walk_shapes(tree, groups=()):
    for el in tree:
        if el.tag == NS_P + 'grpSp':
            g = read_xfrm(el.find(NS_P + 'grpSpPr').find(NS_A + 'xfrm'))
            yield from walk_shapes(el, (g,) + tuple(groups))
        elif el.tag in (NS_P + 'sp', NS_P + 'pic'):
            sppr = el.find(NS_P + 'spPr')
            xfrm = sppr.find(NS_A + 'xfrm') if sppr is not None else None
            if xfrm is None or xfrm.find(NS_A + 'off') is None:
                continue
            yield describe_shape(el, sppr, read_xfrm(xfrm), groups)


def describe_shape(el, sppr, d, groups):
    cx, cy = to_slide(groups, d['x'] + d['w'] / 2, d['y'] + d['h'] / 2)
    scale_x = scale_y = 1.0
    for g in groups:
        scale_x *= g['w'] / g['cw']
        scale_y *= g['h'] / g['ch']
    rotation, mirrored = orientation(groups, d)

    geom_el = sppr.find(NS_A + 'prstGeom')
    geom = geom_el.get('prst') if geom_el is not None else None
    adj = read_adj(sppr) if geom == 'trapezoid' else None
    outline = []
    for px, py in local_outline(geom, d['w'], d['h'], adj):
        px, py = flip_rotate(d['x'] + px, d['y'] + py, d['x'] + d['w'] / 2, d['y'] + d['h'] / 2,
                             d['fh'], d['fv'], d['rot'])
        outline.append(to_slide(groups, px, py))

    fill = sppr.find(NS_A + 'solidFill')
    blip = el.find('.//' + NS_A + 'blip')
    return dict(
        kind=el.tag[len(NS_P):],
        geom=geom,
        adj=adj,
        local_w=d['w'],
        local_h=d['h'],
        fill=fill[0].get('val') if fill is not None and len(fill) else None,
        cx=cx, cy=cy, w=d['w'] * scale_x, h=d['h'] * scale_y,
        rot=rotation, mirrored=mirrored, outline=outline,
        embed=blip.get(NS_R + 'embed') if blip is not None else None,
        paras=[''.join(t.text or '' for t in p.iter(NS_A + 't')).strip()
               for p in el.iter(NS_A + 'p')],
    )


# --- Carpet pictures ------------------------------------------------------

def decode_png(data):
    """Minimal decoder for 8-bit RGB/RGBA non-interlaced PNGs."""
    w, h, depth, ctype, _, _, interlace = struct.unpack('>IIBBBBB', data[16:29])
    if depth != 8 or ctype not in (2, 6) or interlace:
        raise ExtractError(f'unsupported PNG (depth {depth}, color type {ctype}, interlace {interlace})')
    bpp = 4 if ctype == 6 else 3
    idat = b''
    i = 8
    while i < len(data):
        n, = struct.unpack('>I', data[i:i + 4])
        if data[i + 4:i + 8] == b'IDAT':
            idat += data[i + 8:i + 8 + n]
        i += 12 + n
    raw = zlib.decompress(idat)
    stride = w * bpp
    out = bytearray(h * stride)
    prev = bytearray(stride)
    for y in range(h):
        start = y * (stride + 1)
        line = bytearray(raw[start + 1:start + 1 + stride])
        unfilter(raw[start], line, prev, bpp)
        out[y * stride:(y + 1) * stride] = line
        prev = line
    return w, h, bpp, out


def unfilter(kind, line, prev, bpp):
    if kind == 0:
        return
    if kind > 4:
        raise ExtractError(f'unknown PNG filter {kind}')
    for x in range(len(line)):
        left = line[x - bpp] if x >= bpp else 0
        up = prev[x]
        up_left = prev[x - bpp] if x >= bpp else 0
        if kind == 1:
            predicted = left
        elif kind == 2:
            predicted = up
        elif kind == 3:
            predicted = (left + up) // 2
        else:
            predicted = paeth(left, up, up_left)
        line[x] = (line[x] + predicted) & 255


def paeth(a, b, c):
    p = a + b - c
    pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
    if pa <= pb and pa <= pc:
        return a
    if pb <= pc:
        return b
    return c


def carpet_spots(png):
    """Find the light-gray spot circles in a carpet picture; returns centroids in 0..1."""
    w, h, bpp, px = decode_png(png)
    mask = bytearray(w * h)
    for k in range(w * h):
        i = k * bpp
        r, g, b = px[i], px[i + 1], px[i + 2]
        alpha = px[i + 3] if bpp == 4 else 255
        if alpha > 200 and 200 <= r <= 218 and 200 <= g <= 218 and 200 <= b <= 220:
            mask[k] = 1

    blobs = []
    for start in range(w * h):
        if not mask[start]:
            continue
        mask[start] = 0
        stack = [start]
        n = sum_x = sum_y = 0
        while stack:
            q = stack.pop()
            qy, qx = divmod(q, w)
            n += 1
            sum_x += qx
            sum_y += qy
            neighbors = []
            if qx > 0:
                neighbors.append(q - 1)
            if qx < w - 1:
                neighbors.append(q + 1)
            if qy > 0:
                neighbors.append(q - w)
            if qy < h - 1:
                neighbors.append(q + w)
            for nb in neighbors:
                if mask[nb]:
                    mask[nb] = 0
                    stack.append(nb)
        blobs.append((n, sum_x / n / w, sum_y / n / h))
    if not blobs:
        return []
    # Line ends and anti-aliasing leave a few tiny specks of the same gray.
    biggest = max(b[0] for b in blobs)
    return [(x, y) for n, x, y in blobs if n > biggest * 0.4]


# --- Layout pieces --------------------------------------------------------

def units(v):
    return round(v / DESK_EMU, 3)


def angle(v):
    """Round an angle to one decimal in [0, 360)."""
    return round(v % 360, 1) % 360


def stage_point(x, y):
    return units(x - STAGE_X), units(y)


def slug(name):
    return re.sub(r'[^a-z0-9]+', '-', name.lower().replace('’', '')).strip('-')


def title_case(name):
    small = {'of', 'with', 'the', 'and'}
    words = name.lower().split()
    return ' '.join(w if (i and w in small) else w[:1].upper() + w[1:] for i, w in enumerate(words))


def piece_kind(s):
    if s['fill'] == 'B7B7B7':
        return 'supply-desk' if s['w'] > 660000 else 'storage'
    if s['fill'] != '999999':
        return None
    if s['geom'] == 'trapezoid':
        return 'trapezoid-table'
    if s['geom'] == 'rtTriangle':
        return 'triangle-table'
    if s['geom'] == 'roundRect':
        return 'desk' if s['w'] < 900000 else 'rectangle-table'
    return None


def is_chair(s):
    return s['geom'] == 'ellipse' and s['fill'] == 'lt1' and abs(s['w'] - CHAIR_EMU) < 20000


def read_info_panel(info):
    """Title, printed counts, pros/cons and directions from the left panel."""
    titles = [p for s in info if s['geom'] == 'roundRect' and s['cy'] < 1100000
              for p in s['paras'] if p]
    if not titles:
        raise ExtractError('no layout title found')

    values = {}
    for s in info:
        label = ' '.join(s['paras']).strip().lower()
        if not (label.startswith('number of') or label == 'arrangement'):
            continue
        boxes = [o for o in info if o['geom'] == 'roundRect' and o['cy'] > s['cy']]
        if boxes:
            box = min(boxes, key=lambda o: o['cy'] - s['cy'])
            values[label.replace('number of ', '')] = ' '.join(box['paras']).strip()

    pros, cons, directions = [], [], []
    for s in info:
        first = s['paras'][0].upper() if s['paras'] else ''
        if first.startswith('PROS'):
            pros, cons = split_pros_cons(s['paras'])
        elif first.startswith('DIRECTIONS'):
            directions = [without_slide_numbers(p) for p in s['paras'][1:] if p]

    return dict(name=titles[0], values=values, pros=pros, cons=cons, directions=directions)


def without_slide_numbers(text):
    """The app never shows slide numbers; point to the class list instead."""
    return re.sub(r'from SLIDE \d+', 'from your class list', text)


def split_pros_cons(paras):
    pros, cons, current = [], [], None
    for p in paras:
        text = p.strip()
        if text.upper().startswith('PROS'):
            current = pros
        elif text.upper().startswith('CONS'):
            current = cons
        elif text and current is not None:
            current.append(text.lstrip('●').strip())
    return pros, cons


def build_furniture(stage):
    """Desks, tables and storage, each with its outline on the stage kept aside."""
    furniture, outlines = [], {}
    for s in stage:
        kind = piece_kind(s)
        if kind is None:
            continue
        x, y = stage_point(s['cx'], s['cy'])
        piece = dict(id=f'f{len(furniture) + 1}', kind=kind, x=x, y=y,
                     w=units(s['w']), h=units(s['h']),
                     rotation=angle(s['rot']), flipH=s['mirrored'])
        if kind == 'trapezoid-table':
            inset = min(s['local_w'], s['local_h']) * s['adj'] / 100000
            piece['inset'] = round(inset / s['local_w'], 4)
        label = ' '.join(p for p in s['paras'] if p)
        if label and kind in ('storage', 'supply-desk'):
            piece['label'] = label
        furniture.append(piece)
        outlines[piece['id']] = [stage_point(px, py) for px, py in s['outline']]
    return furniture, outlines


def nearest_edge(point, outline):
    """Distance from a point to a polygon's closest edge, and that edge."""
    best = None
    for i in range(len(outline)):
        a, b = outline[i], outline[(i + 1) % len(outline)]
        ex, ey = b[0] - a[0], b[1] - a[1]
        length_sq = ex * ex + ey * ey
        t = ((point[0] - a[0]) * ex + (point[1] - a[1]) * ey) / length_sq
        t = max(0.0, min(1.0, t))
        dist = math.hypot(point[0] - (a[0] + t * ex), point[1] - (a[1] + t * ey))
        if best is None or dist < best[0]:
            best = (dist, a, b)
    return best


def inward_facing(edge_a, edge_b, outline):
    """Facing angle perpendicular to an edge, pointing into the polygon."""
    ex, ey = edge_b[0] - edge_a[0], edge_b[1] - edge_a[1]
    nx, ny = -ey, ex
    mid_x, mid_y = (edge_a[0] + edge_b[0]) / 2, (edge_a[1] + edge_b[1]) / 2
    center_x = sum(p[0] for p in outline) / len(outline)
    center_y = sum(p[1] for p in outline) / len(outline)
    if nx * (center_x - mid_x) + ny * (center_y - mid_y) < 0:
        nx, ny = -nx, -ny
    return angle(math.degrees(math.atan2(nx, -ny)))


def table_seats(chairs, furniture, outlines):
    """Seats at desks and tables, facing across the edge they sit at."""
    tables = [f for f in furniture if f['kind'] not in ('storage', 'supply-desk')]
    if chairs and not tables:
        raise ExtractError('chairs but no desks or tables')
    seats = []
    for c in sorted(chairs, key=lambda s: (round(s['cy'] / 50000), s['cx'])):
        x, y = stage_point(c['cx'], c['cy'])

        def closeness(f):
            # Chairs where two tables meet touch both; prefer the one whose middle is closer.
            edge_dist = nearest_edge((x, y), outlines[f['id']])[0]
            return round(edge_dist, 2), math.hypot(f['x'] - x, f['y'] - y)

        table = min(tables, key=closeness)
        _, a, b = nearest_edge((x, y), outlines[table['id']])
        seats.append(dict(id=f's{len(seats) + 1}', x=x, y=y, furnitureId=table['id'],
                          facing=inward_facing(a, b, outlines[table['id']])))
    return seats


def carpet_piece(pic, shape):
    x, y = stage_point(pic['cx'], pic['cy'])
    piece = dict(id='f1', kind='carpet', shape=shape, x=x, y=y,
                 w=units(pic['w']), h=units(pic['h']), rotation=angle(pic['rot']), flipH=False)
    if shape in CARPET_SECTORS:
        piece['sweep'] = CARPET_SECTORS[shape]
    return piece


def carpet_seats(pic, shape, png):
    """Seats from the spots baked into a carpet picture, numbered in reading order."""
    left = pic['cx'] - pic['w'] / 2
    top = pic['cy'] - pic['h'] / 2
    # Students on a ring face its middle; on a sector they face its center at the
    # front edge; on a rectangle they face the front.
    if shape in ('oval', 'circle'):
        focus = (0.5, 0.5)
    elif shape in CARPET_SECTORS:
        focus = (0.5, 0.0)
    else:
        focus = None

    spots = []
    for fx, fy in carpet_spots(png):
        facing = 0.0
        if focus:
            dx = (focus[0] - fx) * pic['w']
            dy = (focus[1] - fy) * pic['h']
            facing = math.degrees(math.atan2(dx, -dy))
        x, y = stage_point(left + fx * pic['w'], top + fy * pic['h'])
        spots.append(dict(x=x, y=y, facing=angle(facing), fx=fx, fy=fy))

    if shape in ('oval', 'circle'):
        # Clockwise around the ring, starting at the top.
        ordered = sorted(spots, key=lambda s: angle(math.degrees(math.atan2(s['fx'] - 0.5, 0.5 - s['fy']))))
    elif focus:
        # Rings out from the front, left to right within each ring.
        for s in spots:
            s['radius'] = math.hypot((s['fx'] - 0.5) * pic['w'], s['fy'] * pic['h']) / DESK_EMU
        ordered = in_bands(spots, 'radius', 'x')
    else:
        ordered = in_bands(spots, 'y', 'x')

    return [dict(id=f's{i + 1}', x=s['x'], y=s['y'], furnitureId='f1', facing=s['facing'])
            for i, s in enumerate(ordered)]


def in_bands(items, band_key, within_key, gap=0.3):
    """Sort into bands (rows or rings) by one key, then by another within each band."""
    bands = []
    for item in sorted(items, key=lambda i: i[band_key]):
        if bands and item[band_key] - bands[-1][0][band_key] <= gap:
            bands[-1].append(item)
        else:
            bands.append([item])
    return [item for band in bands for item in sorted(band, key=lambda i: i[within_key])]


def spot_pile(chairs):
    """The stack of loose spots on a blank carpet slide, for the teacher to place."""
    x, y = stage_point(sum(c['cx'] for c in chairs) / len(chairs),
                       sum(c['cy'] for c in chairs) / len(chairs))
    return dict(x=x, y=y, count=len(chairs), diameter=units(CHAIR_EMU))


def count_notes(values, furniture, seats, blank):
    """Where a count printed on the slide disagrees with the picture, the picture
    wins; the mismatch is kept in `notes` so the client can confirm it."""
    notes = []
    stated = values.get('students')
    if stated and stated.isdigit() and not blank and int(stated) != len(seats):
        notes.append(f'Slide says {stated} students; the picture shows {len(seats)}.')
    for key in ('desks', 'tables'):
        stated_pieces = values.get(key)
        if not (stated_pieces and stated_pieces.isdigit()):
            continue
        # Supply desks are desks on the slide's count, but not tables.
        counted = [f for f in furniture if f['kind'] not in ('storage', 'carpet')
                   and (f['kind'] != 'supply-desk' or key == 'desks')]
        if int(stated_pieces) != len(counted):
            notes.append(f'Slide says {stated_pieces} {key}; the picture shows {len(counted)}.')
    return notes


def extract_slide(zf, num, category):
    xml = zf.read(f'ppt/slides/slide{num}.xml')
    rels = ET.fromstring(zf.read(f'ppt/slides/_rels/slide{num}.xml.rels'))
    media = {r.get('Id'): r.get('Target') for r in rels}
    tree = ET.fromstring(xml).find(NS_P + 'cSld').find(NS_P + 'spTree')
    all_shapes = list(walk_shapes(tree))

    info = read_info_panel([s for s in all_shapes if s['cx'] < STAGE_X])
    stage = [s for s in all_shapes if s['cx'] >= STAGE_X and s['cy'] > FRONT_BAR_BOTTOM]
    chairs = [s for s in stage if is_chair(s)]
    blank = False

    if category == 'carpets':
        pictures = [s for s in stage if s['kind'] == 'pic']
        if not pictures:
            raise ExtractError('no carpet picture')
        pic = max(pictures, key=lambda s: s['w'] * s['h'])
        shape = info['name'].split()[0].lower()
        furniture = [carpet_piece(pic, shape)]
        blank = bool(chairs)
        seats = []
        if not blank:
            target = media.get(pic['embed'])
            if target is None:
                raise ExtractError('carpet picture has no media file')
            seats = carpet_seats(pic, shape, zf.read(posixpath.normpath('ppt/slides/' + target)))
    else:
        furniture, outlines = build_furniture(stage)
        seats = table_seats(chairs, furniture, outlines)

    stated = {k: v for k, v in info['values'].items() if v and k != 'arrangement'}
    layout_id = f'{category}-{slug(info["name"])}'
    if category == 'carpets':
        layout_id += '-blank' if blank else f'-{len(seats)}'

    layout = dict(
        id=layout_id,
        slide=num,
        name=title_case(info['name']),
        category=category,
        statedCounts=stated,
        pros=info['pros'],
        cons=info['cons'],
        stage=dict(width=units(STAGE_W), height=units(STAGE_H)),
        furniture=furniture,
        seats=seats,
    )
    if info['values'].get('arrangement'):
        layout['arrangement'] = info['values']['arrangement']
    if info['directions']:
        layout['directions'] = info['directions']
    if blank:
        layout['teacherPlacesSpots'] = True
        layout['spotPile'] = spot_pile(chairs)
    notes = count_notes(info['values'], furniture, seats, blank)
    if notes:
        layout['notes'] = notes
    return layout


def main(deck, out):
    zf = zipfile.ZipFile(deck)
    layouts = []
    for first, last, category in SECTIONS:
        for num in range(first, last + 1):
            try:
                layouts.append(extract_slide(zf, num, category))
            except (ExtractError, KeyError, ValueError) as e:
                sys.exit(f'slide {num}: {e}')

    ids = [layout['id'] for layout in layouts]
    if len(set(ids)) != len(ids):
        sys.exit(f'duplicate layout ids: {sorted({i for i in ids if ids.count(i) > 1})}')

    # One layout per line keeps the file small and its diffs readable.
    lines = ['    ' + json.dumps(layout, ensure_ascii=False, separators=(',', ':')) for layout in layouts]
    with open(out, 'w', encoding='utf-8') as f:
        f.write('{\n  "unit": "desk",\n  "layouts": [\n')
        f.write(',\n'.join(lines))
        f.write('\n  ]\n}\n')

    for layout in layouts:
        flag = ' NOTE: ' + ' '.join(layout['notes']) if layout.get('notes') else ''
        print(f"{layout['slide']:>3} {layout['id']:<40} seats={len(layout['seats']):>2} "
              f"pieces={len(layout['furniture']):>2}{flag}")


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
