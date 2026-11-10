# Contextual notebook handwriting (v1.104)

The selected font's photographed letterforms come from Ramsey's notebook reference. This update reuses its genuine rounder `a.alt` (from “and”) and original `l` stroke for a second joined `al`. It preserves the existing photographed joins and adds matching accented a forms. The new forms retain their original pair widths and inherit the regular a kerning.

The `calt` feature makes a/al variants alternate with the nearest a within 16 glyphs, with word-context seeds so independently rendered “physical” and “digital” use different al forms. For e, n, o, r, s, t, u, w, and d, the original contextual choices remain; repeated letters within three intervening glyphs use the other genuine form. Existing ligatures stay intact. Choices are deterministic and contain no per-load randomness or DOM character wrappers.

All authored pages share `typography.css`. Keep `liga`, `calt`, `kern`, and `dlig` enabled. The monospace exceptions remain for character diagrams.

To rebuild (font development only): install fonttools[woff], brotli, uharfbuzz, and optionally Pillow, then run:

```sh
python scripts/fonts/build_contextual.py --output-dir /tmp/notebook-contextual --proof
```

The script reads the retained `NotebookHand-QuietJoins-Regular.ttf` reference and produces the contextual TTF/WOFF2, feature source, shaping validation and optional before/after proof. It verifies original outlines/metrics/kerning, intact joins, headline width, feature disabling, repeated-letter cycling and accented forms. The regular website build serves the committed fonts without requiring these font-development dependencies.
