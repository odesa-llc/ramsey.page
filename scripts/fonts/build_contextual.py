"""Add stable, photographed a/al alternates without replacing existing outlines."""
from pathlib import Path
from copy import deepcopy
import io
import json
import sys

import argparse
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output-dir', type=Path, required=True)
parser.add_argument('--proof', action='store_true', help='Render before/after PNG; requires Pillow')
args = parser.parse_args()
REPO = Path(__file__).resolve().parents[2]
ROOT = args.output_dir.resolve()
ROOT.mkdir(parents=True, exist_ok=True)
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables import otTables
from fontTools.ttLib.tables._g_l_y_f import GlyphCoordinates
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.transformPen import TransformPen
from fontTools.feaLib.builder import addOpenTypeFeaturesFromString
import uharfbuzz as hb

SOURCE = REPO / 'site/assets/fonts/NotebookHand-QuietJoins-Regular.ttf'
DEST = ROOT / 'fonts'
DEST.mkdir(exist_ok=True)
font = TTFont(SOURCE)
baseline = TTFont(SOURCE)
old_order = list(font.getGlyphOrder())
order = list(old_order)

def add(name, glyph, metrics, kind=1):
    font['glyf'][name] = glyph
    font['hmtx'][name] = metrics
    order.append(name)
    font.setGlyphOrder(list(order))
    glyph.recalcBounds(font['glyf'])
    if 'GDEF' in font and font['GDEF'].table.GlyphClassDef:
        font['GDEF'].table.GlyphClassDef.classDefs[name] = kind

# The rounder a is the genuine traced form from "and" in the supplied letter.
# Fit its width to the regular a, retaining its original height and baseline.
alternate = deepcopy(font['glyf']['a.alt'])
alternate.coordinates = GlyphCoordinates([
    (round(32 + (x - 32) * 466 / 450), y)
    for x, y in alternate.coordinates
])
add('a.vary', alternate, font['hmtx']['a'])

# Both photographed strokes overlap at their existing pen-weight entry/exit.
# Preserve the original joined pair's advance and left/right bounds.
pen = TTGlyphPen(font.getGlyphSet())
font['glyf']['a.alt'].draw(TransformPen(pen, (1, 0, 0, 1, 66, 0)), font['glyf'])
font['glyf']['l'].draw(TransformPen(pen, (1, 0, 0, 1, 494, 0)), font['glyf'])
add('a_l.vary', pen.glyph(), font['hmtx']['a_l'], kind=2)

normal = ['a', 'a_l']
variants = ['a.vary', 'a_l.vary']
for name in old_order:
    glyph = font['glyf'][name]
    if not glyph.isComposite() or not any(c.glyphName == 'a' for c in glyph.components):
        continue
    alternate_name = name + '.vary'
    copy = deepcopy(glyph)
    for component in copy.components:
        if component.glyphName == 'a':
            component.glyphName = 'a.vary'
    add(alternate_name, copy, font['hmtx'][name])
    normal.append(name)
    variants.append(alternate_name)

protected = [n for n in ['a_r', 'a_n_d', 'A'] if n in order]
skip = [n for n in order if n not in normal + variants + protected]
seed = [n for n in ['d', 'd.alt', 'f', 'h', 'j', 'k', 'l', 'l_y',
                    'n', 'n.alt', 'r', 'r.alt', 't', 't.alt', 'v'] if n in order]
cls = lambda names: '[' + ' '.join(names) + ']'
rules = [
    'languagesystem DFLT dflt;', 'languagesystem latn dflt;',
    '@A0 = ' + cls(normal) + ';', '@A1 = ' + cls(variants) + ';',
    '@AnyA = [@A0 @A1];', '@ToA0 = [@A0 @A0];', '@ToA1 = [@A1 @A1];',
    '@History0 = [@A0 ' + ' '.join(protected) + '];', '@History1 = [@A1];',
    '@SkipA = ' + cls(skip) + ';', '@SeedA = ' + cls(seed) + ';',
    'lookup NormalizeA { sub a.alt by a; } NormalizeA;',
    'lookup SeedA { lookupflag IgnoreMarks; sub @SeedA @A0\' by @A1; } SeedA;',
    'lookup CycleA {', 'lookupflag IgnoreMarks;',
]
for gap in range(17):
    between = ' @SkipA' * gap
    rules.append("sub @History0" + between + " @AnyA' by @ToA1;")
    rules.append("sub @History1" + between + " @AnyA' by @ToA0;")
rules += ['} CycleA;']
# Retain the existing contextual choices for the other photographed letters.
# Only intervene when the same letter occurs again within three glyphs: make
# the nearest repeat use the other genuine form. Joined words stay intact.
repeat_letters = ['e', 'n', 'o', 'r', 's', 't', 'u', 'w', 'd']
repeat_lookups = []
for letter in repeat_letters:
    pair = [letter, letter + '.alt']
    skip_repeat = [n for n in order if n not in pair and '_' not in n]
    tag = letter.upper()
    rules += [f'@Repeat{tag} = ' + cls(pair) + ';',
              f'@Plain{tag} = ' + cls([letter, letter]) + ';',
              f'@Other{tag} = ' + cls([letter + '.alt', letter + '.alt']) + ';',
              f'@Skip{tag} = ' + cls(skip_repeat) + ';',
              f'lookup Repeat{tag} {{', 'lookupflag IgnoreMarks;']
    for gap in range(4):
        between = f' @Skip{tag}' * gap
        rules.append(f"sub {letter}{between} @Repeat{tag}' by @Other{tag};")
        rules.append(f"sub {letter}.alt{between} @Repeat{tag}' by @Plain{tag};")
    rules += [f'}} Repeat{tag};']
    repeat_lookups.append(f'lookup Repeat{tag};')
rules += ['feature calt { lookup NormalizeA; lookup SeedA; lookup CycleA; '
          + ' '.join(repeat_lookups) + ' } calt;']
feature_source = '\n'.join(rules) + '\n'
(ROOT / 'contextual-a.fea').write_text(feature_source)

# Compile separately, then append only the new substitutions to retain the
# selected photographed joins, discretionary words and all original kerning.
temporary = deepcopy(font)
addOpenTypeFeaturesFromString(temporary, feature_source, tables=['GSUB'])
new = temporary['GSUB'].table
existing = font['GSUB'].table
offset = len(existing.LookupList.Lookup)

def shift_references(node, seen=None):
    if seen is None:
        seen = set()
    if id(node) in seen:
        return
    seen.add(id(node))
    if isinstance(node, otTables.SubstLookupRecord):
        node.LookupListIndex += offset
    if isinstance(node, (list, tuple)):
        for value in node:
            shift_references(value, seen)
    elif hasattr(node, '__dict__'):
        for value in vars(node).values():
            shift_references(value, seen)

for lookup in new.LookupList.Lookup:
    shift_references(lookup)
existing.LookupList.Lookup.extend(new.LookupList.Lookup)
existing.LookupList.LookupCount = len(existing.LookupList.Lookup)
indices = next(r.Feature.LookupListIndex for r in new.FeatureList.FeatureRecord if r.FeatureTag == 'calt')
for record in existing.FeatureList.FeatureRecord:
    if record.FeatureTag == 'calt':
        record.Feature.LookupListIndex += [i + offset for i in indices]
        record.Feature.LookupCount = len(record.Feature.LookupListIndex)

# New a forms inherit the original a's kerning, including T/V/W pairs.
# Preserve every original record and add aliases only for the new glyphs.
aliases = dict(zip(normal, variants))
for lookup in font['GPOS'].table.LookupList.Lookup:
    if lookup.LookupType != 2:
        continue
    for subtable in lookup.SubTable:
        assert subtable.Format == 1, 'Review any new class-based kerning first'
        for pair_set in subtable.PairSet:
            extra = []
            for record in pair_set.PairValueRecord:
                if record.SecondGlyph in aliases:
                    copy = deepcopy(record)
                    copy.SecondGlyph = aliases[record.SecondGlyph]
                    extra.append(copy)
            pair_set.PairValueRecord.extend(extra)
            pair_set.PairValueRecord.sort(key=lambda r: font.getGlyphID(r.SecondGlyph))
            pair_set.PairValueCount = len(pair_set.PairValueRecord)

font['maxp'].numGlyphs = len(order)
font['glyf'].glyphOrder = order
font['head'].fontRevision = 1.104
for name_id, value in {3: 'NotebookHandQuietJoins-Regular-1.104', 5: 'Version 1.104'}.items():
    font['name'].setName(value, name_id, 3, 1, 0x409)
    font['name'].setName(value, name_id, 1, 0, 0)
font.flavor = None
target = DEST / 'NotebookHand-Contextual-Regular.ttf'
font.save(target)
font.flavor = 'woff2'
font.save(DEST / 'NotebookHand-Contextual-Regular.woff2')

def shape(path, text, calt=1):
    f = TTFont(path)
    buffer = hb.Buffer()
    buffer.add_str(text)
    buffer.guess_segment_properties()
    hb.shape(hb.Font(hb.Face(path.read_bytes())), buffer,
             {'calt': calt, 'liga': 1, 'dlig': 1, 'kern': 1})
    return [(f.getGlyphName(i.codepoint), p.x_advance, p.x_offset, p.y_offset)
            for i, p in zip(buffer.glyph_infos, buffer.glyph_positions)]

phrases = ['physical', 'digital', 'physical x digital', 'a a a a',
           'natural analog data', 'a l', 'à à à', 'à la carte à paris',
           'ramsey hatoum', 'handmade handbag', 'paper + clips',
           'thanks for your attention :)', 'and we would share fondly',
           'e e e e', 'n n n n', 'o o o o', 'r r r r', 's s s s',
           't t t t', 'u u u u', 'w w w w', 'd d d d',
           'see more ↓', 'breadboard', 'soldered circuit',
           'merci pour votre attention :)']
checks = {s: shape(target, s) for s in phrases}
names = lambda s: [g[0] for g in checks[s]]
assert 'a_l' in names('physical') and 'a_l.vary' in names('digital')
assert [g for g in names('a a a a') if g != 'space'] == ['a', 'a.vary', 'a', 'a.vary']
assert 'a_l' not in names('a l') and 'a_l.vary' not in names('a l')
for phrase in ['physical', 'digital', 'physical x digital']:
    assert sum(p[1] for p in checks[phrase]) == sum(p[1] for p in shape(SOURCE, phrase))
for letter in repeat_letters:
    assert [g[0] for g in checks[' '.join([letter] * 4)] if g[0] != 'space'] == [letter, letter+'.alt', letter, letter+'.alt']
for updated, original in zip(font['GPOS'].table.LookupList.Lookup,
                             baseline['GPOS'].table.LookupList.Lookup):
    for current_sub, old_sub in zip(updated.SubTable, original.SubTable):
        assert current_sub.Coverage.glyphs == old_sub.Coverage.glyphs
        for current_pairs, old_pairs in zip(current_sub.PairSet, old_sub.PairSet):
            original_names = {r.SecondGlyph for r in old_pairs.PairValueRecord}
            kept = [r for r in current_pairs.PairValueRecord if r.SecondGlyph in original_names]
            assert [r.__dict__ for r in kept] == [r.__dict__ for r in old_pairs.PairValueRecord]
for name in old_order:
    assert font['glyf'][name].compile(font['glyf']) == baseline['glyf'][name].compile(baseline['glyf']), name
    assert font['hmtx'][name] == baseline['hmtx'][name], name
assert font.getBestCmap() == baseline.getBestCmap()
for path in DEST.glob('*'):
    f = TTFont(path, checkChecksums=2)
    f.ensureDecompiled()
    assert f.getBestCmap() == baseline.getBestCmap()
assert not any('.vary' in g[0] for g in shape(target, 'a a digital', calt=0))
report = {'version': '1.104', 'new_glyphs': order[len(old_order):],
          'provenance': 'Existing photographed a.alt from and; original photographed l stroke. No generated outlines.',
          'lookback': 16, 'headline_advance_preserved': True,
          'other_letters': repeat_letters, 'other_letter_repeat_lookback': 3,
          'original_outlines_metrics_and_kerning_unchanged': True,
          'shaping': checks}
(ROOT / 'validation.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')

if args.proof:
    from PIL import Image, ImageDraw, ImageFont
    def rendering_font(path, size):
        f = TTFont(path)
        for table in f['cmap'].tables:
            if table.isUnicode():
                for i, name in enumerate(f.getGlyphOrder()):
                    table.cmap[0xe000 + i] = name
        stream = io.BytesIO()
        f.flavor = None
        f.save(stream)
        return f, ImageFont.truetype(io.BytesIO(stream.getvalue()), size)
    
    sheet = Image.new('RGB', (1500, 1900), '#faf9f3')
    draw = ImageDraw.Draw(sheet)
    label = ImageFont.load_default(size=18)
    samples = [('physical x digital', 150), ('natural analog data', 76),
               ('à la carte à paris', 76), ('handmade handbag', 76),
               ('thanks for your attention :)', 50),
               ('see more ↓   breadboard   soldered circuit', 32),
               ('merci pour votre attention :)', 32)]
    y = 24
    for text, size in samples:
        draw.text((30, y), text, font=label, fill='#777')
        for row, path in enumerate([SOURCE, target]):
            f, ft = rendering_font(path, size)
            baseline_y = y + 40 + size * (row + 1)
            draw.text((30, baseline_y - size // 2), 'before' if row == 0 else 'after', font=label, fill='#999')
            x = 115
            for name, advance, dx, dy in shape(path, text):
                draw.text((x + dx * size / 1000, baseline_y - dy * size / 1000),
                          chr(0xe000 + f.getGlyphID(name)), font=ft, anchor='ls', fill='#343a30')
                x += advance * size / 1000
        y += 2 * size + 95
    sheet.crop((0, 0, 1500, min(y, sheet.height))).save(ROOT / 'before-after.png')
print(json.dumps({'new_glyphs': report['new_glyphs'], 'headline': checks['physical x digital'],
                  'checks': 'passed', 'files': [str(p) for p in DEST.glob('*')]}, ensure_ascii=False))
