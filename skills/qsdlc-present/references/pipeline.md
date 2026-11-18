# The pipeline, step by step

`Inspect → Bind → Roll → Pitch → Build → Verify`

Every step writes a small JSON or text file into `.qsdlc/<slug>/artifacts/.craft/` so a run is resumable and auditable. Identity is fixed per feature (one `brand-bind.json`), structure is rolled per artifact (one `roll-<kind>.json` each). That is why five artifacts read as one family without looking like one template filled five times.

```
.qsdlc/<slug>/artifacts/.craft/
├── brand-bind.json        Inspect + Bind    tokens, shape, type, conflicts, contrast
├── roll-<kind>.json       Roll              archetype, BI cards, motion, finish, signature
├── refs.json              Roll (online)     at most 3 distilled references
├── pitch.md               Pitch             the 2-3 ideas offered and the one chosen
└── shots/                 Verify            frames and the shoot report
```

All commands run from the qsdlc repo; `<proj>` is the project being worked on (not the qsdlc repo). `S=skills/qsdlc-present/scripts`.

## 1. Inspect

```
node $S/brand_probe.mjs --root <proj> --slug <slug>
```

Reads tiers A to F (see `brand-binding.md`). Prints a one-line summary: `confidence`, conflict count, contrast failures.

- **Exit 0**: bound. Read `brand-bind.json` before using it: the `conflicts` and `contrastReport` lists are the part that matters.
- **Exit 3**: no brand source found. Ask one question: *use the neutral unbranded set, or point me at a brand file?* If the user names a file outside the repo, add it to `~/.qsdlc/brand-sources.json` (`{"files": ["<abs path>"]}`) and re-run. Never invent a palette.
- Nothing is read from `.env*`, `node_modules` or build output. Nothing is written outside `.craft/`.

## 2. Bind

The probe has already produced `rootBlock`: a `:root{}` token block with a provenance comment on every line. Paste it as the artifact's token block (or use `--css` to print only that).

1. **Product names win.** If the product calls it `--color-primary`, keep that name and alias the engine tokens to it.
2. **Engine tokens** (so `html-motion` engines work unchanged): `--bg --surface --panel --line --ink --muted --hi --ok --alt --risk`, plus `--radius --border --shadow --font-display --font-sans --font-mono`.
3. **Theme lock.** Dark-only product: build dark only, paint the body from `var(--bg)`. Both themes: complete light palette on bare `:root`, then redefine only tokens under `@media (prefers-color-scheme: dark)` guarded by `:root:not([data-theme="light"])` and again under `:root[data-theme="dark"]`.
4. **Add** `<meta name="brand-source" content="<path of the winning source | unbranded>">`.
5. **Text-safe values.** If a document's own muted colour fails 4.5:1 for small text, the probe emits a text-safe variant and records the conflict. Use the variant. Report the failing doc value upstream; do not silently copy it and do not silently "fix" the doc.

## 3. Roll

```
node $S/roll.mjs --kind <kind> --slug <slug> --has metrics=6,counts,baseline \
     --prev <archetype of the previous artifact> --out <proj>/.qsdlc/<slug>/artifacts/.craft/roll-<kind>.json
```

- Same `slug|kind|rollIndex` always gives the same deal. Bump `--roll-index` only to refresh the look on purpose.
- `--has` lists the data that actually exists. Cards whose `needs` are unmet are dropped (no `flow-sankey` without flow data). Leave it out and needs are assumed met, recorded as `needsAssumed`.
- `--prev` keeps the archetype different from the previous artifact in the same feature.
- Recurring dashboards: add `--pin`. History is ignored and the layout never reshuffles between runs. Staff build muscle memory.
- `--history file` with `--record` makes recent cards less likely over time.
- The kind fixes the narrative spine. It is a requirement, not a taste choice.

Rhythm rules enforced by the roll: at most one high-cost card, at most one decorative layer (`field` or `streams`), one signature moment (two on `--long`), no card whose `avoid` list names a card already dealt, BI cards compatible with the data present.

### Live wildcard (online, optional)

The offline roll is always sufficient. When the network is up, add exactly one researched reference. It never changes tokens.

```
node $S/roll.mjs --kind <kind> --slug <slug> --queries --deny-from <proj>/.qsdlc/<slug>/Intent.md
```

prints the privacy-gated queries and the search plan. Then:

1. **Privacy gate first.** Queries are built only from kind and archetype keywords. The script refuses (prints `skipped: privacy-gate`) if a query contains any word from the slug, `--deny`, or the title line of `--deny-from` files. Fail closed: if it skips, run no live step.
2. **Discover**: at most 3 `WebSearch` calls (`mode: standard`), as listed in the plan. The queries are sampled with the roll's seed from the kind's recipe plus the dealt cards' names and FT relationships, one per source family (Pinterest, Dribbble/Behance, Awwwards, and a grammar source: FT Visual Vocabulary, Codrops or Evidence), so different features surface different directions while one seed always gives the same plan.
3. **Read**: at most 3 fetches, only hosts marked fetchable in `inspiration-atlas.md`.
4. **Look**: if a browser tool is present, open the pick and view it. Otherwise treat it as name-only.
5. **Distil** to one sentence of grammar (not a look): *"annotation sits on the chart; the headline is the finding"*. Store `{url, title, host, retrieved, borrowed, neverBorrowed:["palette","type","imagery"]}` in `refs.json`.
6. **Apply** the sentence as a constraint on the rolled archetype. If it cannot be expressed in the bound tokens, discard it.

Never copy imagery, logos, copy or code from a reference. Keep at most 3 per artifact. Skip on any error or rate limit (429).

## 4. Pitch

Offer two or three directions in one or two sentences each: the image, the structure, why it fits. Name the bet and its risk. Build the first rolled direction as the baseline and make at least one other reach past the obvious (use the signature card). Write the choice to `pitch.md`.

With "run autonomously", pick the first, state it in one line, and build.

Pre-build gate (from `html-motion`): the fact → channel → range table is filled; the page passes the one-glance test and the stranger test.

## 5. Build

Start from the archetype skeleton named in the roll (`skeleton` field) in `assets/archetypes/`, or write from scratch when the roll has none.

```
cp skills/qsdlc-present/assets/archetypes/<skeleton> <proj>/.qsdlc/<slug>/artifacts/<artifact>.html
# fill content, paste the rootBlock from brand-bind.json, embed data as <script type="application/json">
node $S/inline.mjs <artifact>.html kit diagram [engines...] --render
node $S/embed_font.mjs <artifact>.html --file <local font> --family "<Name>"      # only if the product ships a font file
```

Rules:

- Everything inline. Opens from `file://`. No CDN, no fetch, no remote font.
- Data lives in `<script type="application/json" id="...">`. Every stat carries `data-source="<key>"` naming where its number comes from. Illustrative data says "illustrative" on the page.
- Charts come from `Kit.chart.*` (or `data-chart` blocks pre-rendered by `inline.mjs --render`); every chart ships its `<details>` table. Diagrams come from `Diagram.layout`. Mermaid is not used. Archify, if installed, is an optional upgrade, and its output must also lint clean.
- Motion maps to a fact. Delete the animation in your head: if the page says the same thing, cut it.
- Slop gate (enforced by lint where possible): no gradient text, no emoji icons, no `01 / 02 / 03` on non-sequences, no centred-everything, one accent, one documented radius scale, no accent bar on every card, no filler stat tiles.
- **Product copy and claims** (release notes, pitch, anything a customer or stakeholder reads): honour any audience, tone and voice rules `brand_probe` surfaced from the target repo's docs and guidelines (`rules` in `brand-bind.json`). Write for the reader's outcome, not the implementation. Never overstate what `eval.md` (or `.qsdlc/factory/verify/` output, where the factory ran) actually proves. Use "now", "available", "in progress"; never "fully automated" or similar without evidence. Run `lint.mjs --claims` and resolve every flag.

## 6. Verify

```
node $S/lint.mjs <artifact>.html --brand <.craft>/brand-bind.json --claims
node $S/shoot.mjs <artifact>.html --out <.craft>/shots
```

- Lint must exit 0. Fix errors; read warnings and decide.
- `shoot.mjs` renders 1440×900 and 390×844, dark and light when supported, at `?t=0.05,0.5,1.0`; checks console, overflow, reduced motion, no-JS, and network leaks. It exits 4 and prints manual steps when Playwright is missing; in that case say nothing was rendered.
- Then a human step remains: **open the frames and look at them**. Never describe a render you have not seen.
- Record in the artifact's HTML comment header: seed, archetype, refs. Add a line to `state.md`.
