# Neon Drop VR

A color-matching drop puzzle game built with [IWSDK](https://github.com/aspect-build/aspect-build.github.io) (Immersive Web SDK) for VR and browser play.

## Play

🎮 [**Play Now**](https://ellyz2426.github.io/neon-drop/) — works in any browser or VR headset via WebXR.

## About

Neon Drop is a match-3 drop puzzle game inspired by classics like Columns and Puyo Puyo, reimagined for virtual reality. Drop neon orbs into a 7×12 grid, match 3 or more of the same color to clear them, and chain cascading combos for massive scores.

## Features

### Core Gameplay
- **7×12 grid** with 6 neon orb colors
- **Match-3+ detection** — horizontal, vertical, and diagonal
- **Cascade/gravity system** with chain scoring and combo multipliers
- **Ghost orb preview** showing where your drop will land
- **Board clear bonus** (+1,000 points for emptying the grid)
- **Match-size bonuses** for 4+ and 5+ group matches

### 11 Game Modes
| Mode | Description |
|------|-------------|
| Classic | Standard play, game over when grid fills |
| Endless | No game over, play forever |
| Time Attack | 2 minutes to score as high as possible |
| Sprint | Clear 40 orbs as fast as you can |
| Zen | Relaxed mode, no pressure |
| Survival | Speed increases every level |
| Cascade Challenge | Only cascade clears score (double multiplier) |
| Color Limit | Starts with 3 colors, gains more over time |
| Gravity | Half drop timer for rapid reflex gameplay |
| Daily Challenge | Seeded daily puzzle, compete with yourself |
| Puzzle | Hand-crafted sequences with seeded RNG |

### Progression
- **XP system** with 20 player titles (Novice → Omega)
- **3 difficulty settings** (Easy/Normal/Hard) affecting speed and score
- **90 achievements** across multiple categories
- **Daily challenge streaks** with progressive achievements
- **Per-mode high score tracking**

### 6 Power-ups
Earned through combo chains:
- **Row Bomb** — clears the lowest occupied row
- **Color Bomb** — removes all orbs of a random color
- **Wild Orb** — next orb matches the most common color
- **Shuffle** — randomizes all orbs on the board
- **Freeze Timer** — pauses auto-drop for 10 seconds
- **Column Clear** — clears an entire column

### 8 Orb Skins
Each with unique geometry and material properties:
Neon · Crystal · Flame · Ice · Plasma · Toxic · Chrome · Void

### 8 Holodeck Themes
Midnight · Cyber · Matrix · Sunset · Void · Arctic · Solar · Deep Sea

### Visual Effects
- Combo flash lighting with point light bursts
- Score burst particles (additive blended)
- Grid border glow on combo chains
- Landing impact flash when orbs settle
- Orb glow pulsing (emissive breathing)
- Landing squish animation
- Screen shake on big combos
- Column highlight pulse
- Clear animations with expanding rings
- Particle effects (object pooled for performance)

### Audio
- 11 SFX types: drop, clear, cascade, combo, game over, select, move, level up, countdown, power-up, achievement
- Ambient arpeggiator cycling through sine tones
- Background drone

### Controls
| Action | Keyboard | VR Controller |
|--------|----------|---------------|
| Move | ←→ / A/D | Thumbstick |
| Drop | ↓ | Trigger |
| Instant drop | Space | A Button |
| Pause | Esc / P | B Button |
| Power-up 1/2/3 | 1/2/3 | Squeeze |

### UI
All game UI uses IWSDK's spatial PanelUI system — 14 panels total, no HTML DOM overlays:
- World-space menus: main menu, mode select, game over, pause, settings, help, achievements, stats, skins, tutorial
- Head-locked HUD: score, level, combo, clears
- ScreenSpace panels: next orb preview, power-up HUD
- Notification toasts with queued display

## Tech Stack

- **IWSDK** (Immersive Web SDK) for WebXR and 3D rendering
- **TypeScript** — single-file architecture (~2,300 lines)
- **PanelUI** with `.uikitml` templates compiled via `@iwsdk/vite-plugin-uikitml`
- **localStorage** for save persistence with backward-compatible migration
- **GitHub Pages** for deployment

## Development

```bash
npm install
npm run dev    # Start dev server
npm run build  # Production build
```

## License

MIT
