# Neon Drop VR

A color-matching drop puzzle game built with IWSDK for VR and browser play.

## Play

- **Live:** [https://ellyz2426.github.io/neon-drop/](https://ellyz2426.github.io/neon-drop/)
- Supports VR headsets (Quest, etc.) and desktop browser (keyboard + mouse)

## Gameplay

Drop colored neon orbs into a 7×12 grid. Match 3 or more of the same color in any direction (horizontal, vertical, diagonal) to clear them. Cleared orbs trigger gravity — remaining orbs fall and can create cascade chains for big combos. Build power-ups through combo chains and climb levels as the speed increases.

### Controls

| Input | Browser | VR Controller |
|-------|---------|---------------|
| Move column | ← → / A D | Right thumbstick |
| Drop orb | ↓ | Trigger |
| Instant drop | Space | A button |
| Use power-up | 1 / 2 / 3 | Squeeze |
| Pause | Esc / P | B button |

## Features

### 11 Game Modes
- **Classic** — Speed increases each level
- **Endless** — No speed increase, drop at your pace
- **Time Attack** — Score max in 120 seconds
- **Sprint** — Clear 40 orbs as fast as possible
- **Zen** — No game over, relax and cascade
- **Survival** — Speed ramps up fast
- **Cascade** — Only cascading clears score
- **Color Limit** — Starts with 3 colors, adds more
- **Gravity** — Half drop delay, rapid gameplay
- **Daily Challenge** — Same seed daily, compare scores
- **Puzzle** — Crafted sequences with fewer colors

### 8 Holodeck Themes
Midnight, Cyber, Matrix, Sunset, Void, Arctic, Solar, Deep Sea

### 8 Orb Skins
Neon, Crystal, Flame, Ice, Plasma, Toxic, Chrome, Void — each with distinct geometry and materials

### 6 Power-Up Types
Row Bomb, Color Bomb, Wild Orb, Shuffle, Freeze Timer, Column Clear — earned via combo chains

### 80 Achievements
From first match to mythic score milestones, combo chains, board clears, mode mastery, XP levels, and more

### XP Progression
20 player titles from Novice to Omega. Earn XP from games, clears, combos, and board clears.

### 3 Difficulty Settings
Easy (1.5x speed, 0.7x score) · Normal · Hard (0.6x speed, 1.5x score)

### Spatial UI
All game UI uses IWSDK's PanelUI system — 13 `.uikitml` templates, zero HTML DOM overlays. Works in both browser and VR.

### Audio
Procedural synthesizer music with arpeggiator and ambient drone. 11 distinct SFX types.

## Technical

- Built with [IWSDK](https://iwsdk.dev) v0.4.1
- Zero external art assets — all visuals are procedural geometry + materials
- All UI is spatial PanelUI (`.uikitml`) — no HTML DOM overlays
- Dual input: keyboard/mouse + XR controller
- localStorage persistence with migration support

## License

MIT
