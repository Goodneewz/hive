# make_icons.py - creates icons/icon-192.png and icons/icon-512.png
import math, os, struct, zlib

NAVY = (5, 15, 30)       # #050F1E
YELLOW = (255, 184, 0)   # #FFB800

def hex_points(cx, cy, r):
    return [(cx + r * math.cos(math.radians(-90 + 60 * k)),
             cy + r * math.sin(math.radians(-90 + 60 * k))) for k in range(6)]

def inside(x, y, pts):
    sign = None
    for k in range(6):
        x1, y1 = pts[k]
        x2, y2 = pts[(k + 1) % 6]
        cross = (x2 - x1) * (y - y1) - (y2 - y1) * (x - x1)
        if cross == 0:
            continue
        s = cross > 0
        if sign is None:
            sign = s
        elif sign != s:
            return False
    return True

def render(size):
    c = size / 2
    outer = hex_points(c, c, size * 0.36)
    inner = hex_points(c, c, size * 0.17)
    raw = bytearray()
    for y in range(size):
        raw.append(0)  # PNG filter byte
        for x in range(size):
            px, py = x + 0.5, y + 0.5
            if inside(px, py, inner):
                raw += bytes(NAVY)
            elif inside(px, py, outer):
                raw += bytes(YELLOW)
            else:
                raw += bytes(NAVY)
    return bytes(raw)

def write_png(path, size, raw):
    def chunk(kind, data):
        return (struct.pack('>I', len(data)) + kind + data +
                struct.pack('>I', zlib.crc32(kind + data) & 0xFFFFFFFF))
    header = struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)
    with open(path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n')
        f.write(chunk(b'IHDR', header))
        f.write(chunk(b'IDAT', zlib.compress(raw, 9)))
        f.write(chunk(b'IEND', b''))

os.makedirs('icons', exist_ok=True)
for size in (192, 512):
    path = os.path.join('icons', f'icon-{size}.png')
    write_png(path, size, render(size))
    print('Wrote', path)