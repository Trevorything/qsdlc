#!/usr/bin/env python
"""Embed a LOCAL font file into an HTML page as a base64 @font-face. Standard library only; run with `python`.

  python embed_fonts.py page.html --file Brand-Regular.woff2 --family "Brand Sans" --weight 400
  python embed_fonts.py page.html --file Brand-Var.woff2 --family "Brand Sans" --weight "100 900"   # variable font
  python embed_fonts.py --print --file Brand-Regular.woff2 --family "Brand Sans"                    # CSS to stdout only

Run it once per face. Each face is written between marker comments inside <style data-html-motion-fonts>
(added before </head> if missing), so re-running for the same family/weight/style replaces it (idempotent).

Rules: the font must be a file on disk (woff2, woff, ttf, otf). http(s):// and other URLs are refused: the page
must work offline and the skill never downloads anything. Files over 150 KB print a warning (a base64 font is
33% larger than the file; subset it first). Give every font a fallback stack in your CSS, and check numerals at
display size. Use a variable font (a weight range) when you want to animate weight.
Exit codes: 0 ok, 2 usage / refused / IO error.
"""
import argparse
import base64
import os
import re
import sys

FORMATS = {'.woff2': ('font/woff2', 'woff2'), '.woff': ('font/woff', 'woff'),
           '.ttf': ('font/ttf', 'truetype'), '.otf': ('font/otf', 'opentype')}
LIMIT = 150 * 1024
OPEN = '<style data-html-motion-fonts>'


def die(msg):
    sys.stderr.write('embed_fonts: %s\n' % msg)
    sys.exit(2)


def face_css(path, family, weight, style):
    if re.match(r'^[a-z][a-z0-9+.-]*:', path, re.I) and not re.match(r'^[a-z]:[\\/]', path, re.I):
        die('refusing URL "%s": pass a local font file (no downloads, no CDN)' % path)
    if not os.path.isfile(path):
        die('font file not found: %s' % path)
    ext = os.path.splitext(path)[1].lower()
    if ext not in FORMATS:
        die('unsupported font type "%s" (use woff2, woff, ttf or otf)' % ext)
    with open(path, 'rb') as f:
        raw = f.read()
    if len(raw) > LIMIT:
        sys.stderr.write('embed_fonts: warning: %s is %d KB (> 150 KB). Subset it to the glyphs you use.\n' % (os.path.basename(path), len(raw) // 1024))
    mime, fmt = FORMATS[ext]
    b64 = base64.b64encode(raw).decode('ascii')
    safe = family.replace('"', '').replace('\\', '')
    return ('@font-face{font-family:"%s";font-weight:%s;font-style:%s;font-display:swap;'
            'src:url(data:%s;base64,%s) format("%s");}' % (safe, weight, style, mime, b64, fmt))


def main():
    ap = argparse.ArgumentParser(description='Embed a local font file as a base64 @font-face.')
    ap.add_argument('page', nargs='?', help='HTML page to update (omit with --print)')
    ap.add_argument('--file', required=True, help='local font file (woff2, woff, ttf, otf)')
    ap.add_argument('--family', required=True, help='CSS font-family name')
    ap.add_argument('--weight', default='400', help='400, or a range like "100 900" for a variable font')
    ap.add_argument('--style', default='normal', choices=['normal', 'italic'])
    ap.add_argument('--print', action='store_true', help='print the CSS to stdout instead of editing a page')
    a = ap.parse_args()
    css = face_css(a.file, a.family, a.weight, a.style)
    if a.print:
        print(css)
        return 0
    if not a.page or not os.path.isfile(a.page):
        die('page not found: %s' % a.page)
    with open(a.page, encoding='utf-8', newline='') as f:
        html = f.read()
    key = '%s|%s|%s' % (a.family, a.weight, a.style)
    start, end = '/* html-motion-font:%s */' % key, '/* /html-motion-font */'
    block = '%s\n%s\n%s' % (start, css, end)
    s = html.find(start)
    if s != -1:
        e = html.find(end, s)
        if e == -1:
            die('found a font marker without its end marker')
        html = html[:s] + block + html[e + len(end):]
    elif OPEN in html:
        i = html.find(OPEN) + len(OPEN)
        html = html[:i] + '\n' + block + html[i:]
    else:
        low = html.lower()
        h = low.rfind('</head>')
        if h == -1:
            die('page has no </head> to put the font style in')
        html = html[:h] + OPEN + '\n' + block + '\n</style>\n' + html[h:]
    with open(a.page, 'w', encoding='utf-8', newline='') as f:
        f.write(html)
    print('embedded "%s" %s %s (%d bytes of CSS) into %s' % (a.family, a.weight, a.style, len(css), a.page))
    return 0


if __name__ == '__main__':
    sys.exit(main())
