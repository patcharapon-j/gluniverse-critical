# GLUniverse Critical

JRPG-inspired fullscreen critical-hit cinematics for **Foundry VTT v13** + the **Pathfinder 2e** system. Inspired by Persona 5 Royal, Persona 3 Reloaded, Final Fantasy, and Genshin Impact.

When a critical fires, the screen dims, an aspect-fit banner image of the actor sweeps in with a horizontal mask wipe + opacity, holds with a slow zoom, then scales up and fades out. The whole thing is roughly a second.

## Install

In Foundry: **Game Settings → Add-on Modules → Install Module → Manifest URL**:

```
https://github.com/patcharapon-j/gluniverse-critical/releases/latest/download/module.json
```

This URL always resolves to the latest release, so Foundry's built-in update check will keep you current.

**Requires:** Foundry VTT v13, PF2e system v6.0.0+ (verified on v7).

## Features

- **Aspect-fit fullscreen reveal** — works with portraits, wide banner art, or square images. No cropping.
- **Two trigger modes** (Module Settings → Trigger Mode):
  - **PF2e Degree of Success** *(default)* — fires on the PF2e `criticalSuccess` outcome (Strikes, Spell Attacks, Saves, optionally Skills/Perception).
  - **Natural 20 Only** — fires on any active d20 result of 20, regardless of degree of success or roll type.
- **Per-actor sheet header button** ⚡ — every actor sheet gets a "Critical Cinematic" header button:
  - GMs can enable/disable the cinematic for each NPC (default OFF for NPCs, always ON for PCs).
  - Set a per-actor **Image Override** (replaces the actor art for that one actor's cinematic).
  - **Test** button plays the cinematic locally without broadcasting.
- **GM Configuration menu** (gear icon in Module Settings):
  - NPC Default Image (used for any enabled NPC without an override)
  - PC Critical SFX / NPC Critical SFX
  - Cinematic Duration (600–3000 ms slider)
- **Networked broadcast** — public-roll cinematics fire on every connected client. Whispered / GM-roll cinematics fire **only on the rolling client** so they don't leak hidden NPC rolls to players.
- **Respects secret rolls** — `blindroll` mode and the `blind` flag are never broadcast or rendered.
- **Per-client opt-out** — players can disable cinematics on their own client (toggle in client settings, gated by a world setting).

## Configure

### World settings (GM)

| Setting | Default | Notes |
|---|---|---|
| **Trigger Mode** | PF2e Degree of Success | PF2e DoS or Nat-20 Only |
| **NPC Default Image** | — | Shown for enabled NPCs without an override |
| **PC / NPC Critical SFX** | — | Optional audio files |
| **Cinematic Duration** | 1000 ms | 600–3000 ms |
| **Enable Skill Check criticals** | ON | Only relevant in PF2e DoS mode |
| **Enable Perception criticals** | OFF | Only relevant in PF2e DoS mode |
| **Allow players to disable cinematics** | ON | Controls whether the client opt-out is exposed |

### Client settings (each player)

- **Show critical cinematics** — local visual toggle
- **Cinematic audio** — local SFX toggle
- **Cinematic volume** — 0–100%

### Per-actor (sheet header button)

- **Enable cinematic for this NPC** *(NPCs only)*
- **Image Override** — file picker; falls back to actor art (PCs) or NPC Default Image (NPCs) when empty

## Roll-type matrix (PF2e DoS mode)

| Roll type | Fires on Critical Success? |
|---|---|
| Strike (attack roll) | Yes |
| Spell Attack | Yes |
| Saving Throw | Yes |
| Skill Check | Yes (toggle) |
| Perception | Optional (toggle) |
| Flat check | Never |
| Damage roll | Never |
| Initiative | Never |

In **Natural 20 Only** mode the matrix doesn't apply — any active d20 showing 20 fires the cinematic.

## Public API

```js
const api = game.modules.get('gluniverse-critical').api;
api.version;                  // '1.0.0'
api.triggerLocal(actorId);    // play the cinematic for this actor locally only
```

## Development

```bash
npm install
npm run build       # vite build → module.js at repo root
npm run test        # vitest
npm run typecheck   # tsc --noEmit
npm run lint        # biome
```

Bundled output (`module.js`) is committed so the repo loads directly in Foundry as a dev install (symlink the repo into `Data/modules/`). For release packaging, see the manifest's `download` URL — it points at `module.zip` built via `git archive`.

## License

No license file included; treat as all rights reserved unless one is added.
