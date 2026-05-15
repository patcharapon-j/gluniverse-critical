# GLUniverse Critical — Specification

PF2e-only Foundry VTT v13 module. JRPG-inspired fullscreen cinematic animations on Critical Success rolls.

This file is the locked decision log from the grilling session. Implementation is built against this spec — if something here is wrong, update this file *before* the code.

---

## 1. Detection

### 1.1 Crit definition
Only PF2e `Critical Success` degree-of-success counts. Raw nat 20s that resolve to a regular Success do **not** fire.

### 1.2 Roll types
| Roll type | v1 default | Configurable? |
|---|---|---|
| Strike (attack roll) | ON | no |
| Spell Attack | ON | no |
| Saving Throw | ON | no |
| Skill Check | ON | yes (world setting) |
| Perception | OFF | yes (world setting) |
| Flat check | NEVER | hardcoded block |
| Damage roll, Initiative | NEVER | hardcoded block |

### 1.3 Actor scope
- **PCs (player-owned actors):** always trigger
- **NPCs:** default OFF, per-actor opt-in via `flags.gluniverse-critical.enabled`
- **Unlinked unowned untagged mooks:** blocked
- **Secret / blind GM rolls:** NEVER trigger (filter on chat message `whisper` / `blind` / `rollMode`)

### 1.4 System scope
PF2e only. Module no-ops with a single console warning on non-PF2e systems. `module.json` declares the system relationship.

---

## 2. Visuals

### 2.1 Frame contents
**No text whatsoever.** Animation = portrait + motion + color.

- PC crit portrait: per-actor override → actor `img` → silhouette fallback.
- NPC crit portrait: per-NPC override → single module-level "GM Avatar" image used for all NPCs.

### 2.2 Per-actor customization
Each actor can override template slug + color palette (primary / accent / bg).

### 2.3 Render technology
PixiJS / WebGL. Use Foundry's bundled Pixi (`globalThis.PIXI`); do not ship our own.

### 2.4 Render layer
Dedicated overlay `PIXI.Application` on a `position: fixed` canvas, `z-index: 99999`, `pointer-events: none`. Created once on `ready`, `app.stop()` when queue empty. Non-blocking — input continues, `game.paused` untouched.

### 2.5 Built-in templates (v1)
| Slug | Inspiration | Notes |
|---|---|---|
| `ink-slash` | Persona 5 Royal critical cut-in | Hard graphic-design motion, ink splatter |
| `sigil-pulse` | Persona 3 Reloaded Theurgy | Magic circle radial expansion |
| `title-slide` | FFVII/X Limit Break title-slide | Light bars substitute for the banner text |
| `aether-burst` | Genshin Impact elemental burst | Portrait is the focal anchor; no separate symbol |

### 2.6 Faction modes
Every template implements both `hero` and `antagonist` modes — distinct palettes and motion curves — under the same slug. Engine passes `faction` based on actor ownership (player-owned → `hero`, NPC → `antagonist`).

---

## 3. Audio

Two user-uploaded SFX (`.ogg` or `.mp3`) at module level:
- **PC Critical SFX** — plays for all PC crits
- **GM Critical SFX** — plays for all NPC crits

Module ships silent. Volume slider + mute toggle client-scoped. Routed through `core.globalInterfaceVolume`. No bundled audio. Audio is decoupled from templates.

---

## 4. Timing & Queue

- **Wait for Dice So Nice if installed** (`diceSoNiceRollComplete` hook); otherwise fire on `createChatMessage`.
- Do **not** wait for damage rolls.
- **Duration:** 2500ms default, configurable 1500–4000ms (world setting). Templates author against `t ∈ [0, 1]` normalized timeline.
- **Queue:** cap 3. 4th arrival drops the *oldest queued* (currently-playing never interrupted).
- **Dedupe:** same `messageId` arriving within 500ms is dropped.

---

## 5. Multiplayer broadcast

- All clients see the cinematic by default.
- Originating client emits socket `module.gluniverse-critical` with `{ messageId, actorId, templateSlug, faction, colors, portraitSrc, durationMs, startTimestamp }`.
- Loose sync (~150ms tolerance), no drift correction.
- **Client setting** "Show critical cinematics" — default ON. Per-user opt-out.
- **GM setting** "Allow players to disable cinematics" — default ON.
- No late-join replay.

---

## 6. Template authoring contract

```ts
export abstract class BaseCritTemplate {
  static slug: string;
  static displayName: string;
  static defaultHeroColors: ColorPalette;
  static defaultAntagonistColors: ColorPalette;
  static previewThumbnail: string;

  abstract preload(): Promise<void>;
  abstract setup(ctx: CritContext): void;
  abstract update(t: number, dt: number): void;
  abstract teardown(): void;
}

interface CritContext {
  pixiApp: PIXI.Application;
  stage: PIXI.Container;
  portraitTexture: PIXI.Texture;
  colors: ColorPalette;
  faction: 'hero' | 'antagonist';
  duration: number;
}

interface ColorPalette { primary: number; accent: number; bg: number }
```

- Built-ins register on `init`.
- External modules register between `init` and `ready` via `game.modules.get('gluniverse-critical').api.registerTemplate(...)`.
- Colors are Pixi color numbers (`0xRRGGBB`); shader uniforms bind to the same numbers.

---

## 7. Configuration UI

### 7.1 Per-actor (header button → modal)
Header button on every actor sheet opens a `FormApplication`:
- **PC:** template dropdown, primary/accent/bg color pickers, portrait override (FilePicker), "Test cinematic" button (local-only, no broadcast).
- **NPC:** "Enable cinematic for this NPC" checkbox (GM-only). Other fields disabled until enabled. Each NPC may override the global GM avatar / template / colors.
- Permission: `OWNER` on the actor opens the modal; the NPC opt-in checkbox is GM-gated.

### 7.2 World settings (GM-only)
- GM Avatar (image FilePicker)
- GM Default Template (dropdown)
- GM Default Color Palette
- PC Default Template (dropdown)
- PC Default Color Palette
- PC Critical SFX (audio FilePicker)
- GM Critical SFX (audio FilePicker)
- Cinematic duration (slider 1500–4000ms)
- Enable Skill Check crits (default ON)
- Enable Perception crits (default OFF)
- Allow players to disable cinematics (default ON)

The image/audio/color-heavy settings live behind a single `FormApplication` "GM Configuration" menu so the stock settings page stays readable.

### 7.3 Client settings (per-user)
- Show critical cinematics (default ON)
- Audio enabled (default ON)
- Cinematic volume (0–100%, default 80%)

---

## 8. Stack

- **Language:** TypeScript 5.x
- **Bundler:** Vite (single `module.js` ES output)
- **Lint/format:** Biome
- **Test:** Vitest, scoped to pure detector logic only
- **Foundry types:** `@league-of-foundry-developers/foundry-vtt-types` (v13 line)
- **PF2e types:** local `src/types/pf2e.d.ts` covering only the `flags.pf2e.context` subset we read
- **Build target:** Foundry's user-data modules directory (no copy step needed since we develop in place)
- **No CI for v1**

---

## 9. Data persistence

- Per-actor: `flags.gluniverse-critical.*`
  - `schemaVersion` (number)
  - `enabled` (bool, NPC opt-in)
  - `templateSlug` (string | null)
  - `colorPrimary`, `colorAccent`, `colorBg` (number | null — null = use module default)
  - `portraitOverride` (string | null)
- World: `game.settings` under namespace `gluniverse-critical`.
- v1 ships at `schemaVersion = 1`. Migration runner on `ready` lifts older actors when the schema changes.

---

## 10. Localization

All UI strings via `game.i18n.localize`. `lang/en.json` is the shipped default. No in-cinematic text exists, so no localization needed for animations.

---

## 11. Accessibility (deferred from v1)

- **Keep:** WCAG 2.3.1 flash-rate clamp at the engine layer (post-processing filter; templates cannot override).
- **Deferred:** reduced-motion fallback, low-spec mode, first-launch photosensitivity warning.

---

## 12. Identifiers

| Thing | Value |
|---|---|
| Module ID | `gluniverse-critical` |
| Socket channel | `module.gluniverse-critical` |
| Settings namespace | `gluniverse-critical` |
| Actor flag namespace | `flags.gluniverse-critical` |
| Public API | `game.modules.get('gluniverse-critical').api` |
