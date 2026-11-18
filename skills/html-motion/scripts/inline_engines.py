#!/usr/bin/env python
"""Inline html-motion engines into an HTML page. Standard library only; run it with `python` (3.8+).

  python inline_engines.py --list
  python inline_engines.py page.html shader streams [--out other.html]
  python inline_engines.py --update-index        (refresh byte sizes in assets/engines/index.json)

Writes one <script> block (core + the named engines, in index.json order) between
  <!-- html-motion:start ... -->  and  <!-- html-motion:end -->
First run inserts it before the page's last <script> (else before </body>, else at the end). Re-running with a
new list replaces the block, so the command is idempotent. Exit codes: 0 ok, 2 usage / unknown engine / IO error.
Same behaviour as inline_engines.mjs.
"""
import json
import os
import re
import sys

DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'engines')
INDEX = os.path.join(DIR, 'index.json')
START, END = '<!-- html-motion:start', '<!-- html-motion:end -->'


def die(msg):
    sys.stderr.write('inline_engines: %s\n' % msg)
    sys.exit(2)


def read(path):
    with open(path, encoding='utf-8', newline='') as f:
        return f.read()


index = json.loads(read(INDEX))
names = [e['name'] for e in index['engines']]


def list_engines():
    print('core\t%s\talways included' % index['core']['file'])
    for e in index['engines']:
        print('%s\t%s\t%s\t%s' % (e['name'], e['cost'], 'pure' if e['pure'] else 'stateful', e['shows']))


def update_index():
    index['core']['bytes'] = os.path.getsize(os.path.join(DIR, index['core']['file']))
    for e in index['engines']:
        e['bytes'] = os.path.getsize(os.path.join(DIR, e['file']))
    with open(INDEX, 'w', encoding='utf-8', newline='') as f:
        f.write(json.dumps(index, indent=2) + '\n')
    print('index.json updated: core %d B, %s' % (index['core']['bytes'], ', '.join('%s %d' % (e['name'], e['bytes']) for e in index['engines'])))


def block(chosen):
    files = [index['core']['file']] + [e['file'] for e in index['engines'] if e['name'] in chosen]
    code = '\n'.join('/* ---- %s ---- */\n%s' % (f, read(os.path.join(DIR, f)).rstrip()) for f in files)
    if re.search(r'</script', code, re.I):
        die('engine source contains </script')
    return '%s engines=%s -->\n<script>\n%s\n</script>\n%s' % (START, ','.join(chosen) or 'none', code, END)


def inject(html, blk):
    a = html.find(START)
    if a != -1:
        b = html.find(END, a)
        if b == -1:
            die('found start marker without end marker')
        return html[:a] + blk + html[b + len(END):]
    low = html.lower()
    last = low.rfind('<script')
    if last != -1:
        return html[:last] + blk + '\n' + html[last:]
    body = low.rfind('</body>')
    if body != -1:
        return html[:body] + blk + '\n' + html[body:]
    return html + '\n' + blk + '\n'


def main(argv):
    if '--list' in argv:
        list_engines()
        return 0
    if '--update-index' in argv:
        update_index()
        return 0
    if not argv or '-h' in argv or '--help' in argv:
        sys.stderr.write('usage: inline_engines.py --list | --update-index | page.html engine [engine ...] [--out file]\n')
        return 0 if argv else 2
    out, pos, i = None, [], 0
    while i < len(argv):
        if argv[i] == '--out':
            i += 1
            out = argv[i] if i < len(argv) else die('--out needs a path')
        else:
            pos.append(argv[i])
        i += 1
    page, want = (pos[0] if pos else None), pos[1:]
    if not page or not os.path.exists(page):
        die('page not found: %s' % page)
    bad = [n for n in want if n not in names]
    if bad:
        die('unknown engine%s: %s (known: %s)' % ('s' if len(bad) > 1 else '', ', '.join(bad), ', '.join(names)))
    chosen = [n for n in names if n in want]
    html = read(page)
    nxt = inject(html, block(chosen))
    with open(out or page, 'w', encoding='utf-8', newline='') as f:
        f.write(nxt)
    d = len(nxt) - len(html)
    print('inlined core + %s into %s (%s%d chars)' % (', '.join(chosen) or '(no engines)', out or page, '+' if d >= 0 else '', d))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
