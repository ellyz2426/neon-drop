// Neon Drop VR — Color-matching drop puzzle in VR
// Drop colored neon orbs into a grid, match 3+ to clear
// First match-3/drop-puzzle genre in the IWSDK portfolio

import {
  World, PanelUI, ScreenSpace, Follower, FollowBehavior,
  PanelDocument, UIKitDocument,
  Mesh, Group, BoxGeometry, SphereGeometry, CylinderGeometry,
  PlaneGeometry, TorusGeometry, IcosahedronGeometry, OctahedronGeometry,
  MeshStandardMaterial, MeshBasicMaterial, LineBasicMaterial,
  Color, Vector3, Quaternion, Euler,
  Fog, AmbientLight, PointLight, DirectionalLight,
  BufferGeometry, Float32BufferAttribute,
  EdgesGeometry, LineSegments,
  AdditiveBlending,
  InputComponent,
} from '@iwsdk/core';

// ============================================================
// TYPES
// ============================================================
type GameState = 'title' | 'modeSelect' | 'playing' | 'paused' | 'gameOver' | 'settings' | 'help' | 'achievements' | 'stats' | 'skins' | 'tutorial';
type GameMode = 'classic' | 'endless' | 'timeAttack' | 'sprint' | 'zen' | 'survival' | 'cascade' | 'colorlimit' | 'gravity' | 'daily' | 'puzzle';
type PlayPhase = 'selecting' | 'dropping' | 'clearing' | 'cascading' | 'nextOrb' | 'countdown';
type PowerUpType = 'rowBomb' | 'colorBomb' | 'wildOrb' | 'shuffle' | 'freezeTimer' | 'columnClear';

interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
}

interface PowerUp {
  type: PowerUpType;
  icon: string;
  name: string;
}

interface SaveData {
  highScores: Record<string, number>;
  totalGames: number;
  totalScore: number;
  totalClears: number;
  totalCascades: number;
  totalDrops: number;
  totalPowerUps: number;
  bestCombo: number;
  bestLevel: number;
  unlockedAch: string[];
  skinIdx: number;
  settings: { sfxVol: number; musVol: number; themeIdx: number; difficulty: number };
  xp: number;
  playerLevel: number;
  dailyStreak: number;
  lastDailyDate: string;
  totalBoardClears: number;
}

// ============================================================
// CONSTANTS
// ============================================================
const COLS = 7;
const ROWS = 12;
const CELL = 0.09;
const ORB_R = 0.034;
const GRID_Z = -1.6;
const GRID_CX = 0;
const GRID_BY = 0.55;
const GRID_W = COLS * CELL;
const GRID_H = ROWS * CELL;

const ORB_COLORS = [
  { name: 'Red', hex: '#ff0055', em: '#cc0044' },
  { name: 'Cyan', hex: '#00ffff', em: '#00cccc' },
  { name: 'Green', hex: '#00ff88', em: '#00cc66' },
  { name: 'Yellow', hex: '#ffff00', em: '#cccc00' },
  { name: 'Purple', hex: '#aa00ff', em: '#8800cc' },
  { name: 'Orange', hex: '#ff8800', em: '#cc6600' },
];

const THEMES = [
  { name: 'Midnight', fog: '#050510', amb: '#1a1a2e', grid: '#00ffff', floor: '#0a0a1a' },
  { name: 'Cyber', fog: '#0a0505', amb: '#2e1a1a', grid: '#ff0055', floor: '#1a0a0a' },
  { name: 'Matrix', fog: '#000a05', amb: '#1a2e1a', grid: '#00ff88', floor: '#0a1a0a' },
  { name: 'Sunset', fog: '#0a0805', amb: '#2e2a1a', grid: '#ff8800', floor: '#1a1505' },
  { name: 'Void', fog: '#080010', amb: '#1a1a30', grid: '#aa00ff', floor: '#0a001a' },
  { name: 'Arctic', fog: '#050a10', amb: '#1a2a3e', grid: '#66ccff', floor: '#0a1020' },
  { name: 'Solar', fog: '#100805', amb: '#3e2a1a', grid: '#ffcc00', floor: '#1a1005' },
  { name: 'Deep Sea', fog: '#020810', amb: '#0a1a2e', grid: '#0088ff', floor: '#040a14' },
];

const SKIN_DEFS = [
  { name: 'NEON', desc: 'Classic glowing orbs', roughness: 0.3, metalness: 0.2, emIntensity: 0.6, geoType: 'sphere' as const },
  { name: 'CRYSTAL', desc: 'Faceted gem orbs', roughness: 0.1, metalness: 0.6, emIntensity: 0.8, geoType: 'icosahedron' as const },
  { name: 'FLAME', desc: 'Burning ember orbs', roughness: 0.7, metalness: 0.1, emIntensity: 1.2, geoType: 'sphere' as const },
  { name: 'ICE', desc: 'Frozen crystal orbs', roughness: 0.05, metalness: 0.8, emIntensity: 0.3, geoType: 'octahedron' as const },
  { name: 'PLASMA', desc: 'Electric energy orbs', roughness: 0.4, metalness: 0.3, emIntensity: 1.5, geoType: 'sphere' as const },
  { name: 'TOXIC', desc: 'Radioactive glow orbs', roughness: 0.5, metalness: 0.1, emIntensity: 2.0, geoType: 'sphere' as const },
  { name: 'CHROME', desc: 'Mirror-polished orbs', roughness: 0.0, metalness: 1.0, emIntensity: 0.4, geoType: 'sphere' as const },
  { name: 'VOID', desc: 'Dark matter orbs', roughness: 0.8, metalness: 0.0, emIntensity: 3.0, geoType: 'icosahedron' as const },
];

const POWER_UPS: PowerUp[] = [
  { type: 'rowBomb', icon: '⊞', name: 'Row Bomb' },
  { type: 'colorBomb', icon: '◉', name: 'Color Bomb' },
  { type: 'wildOrb', icon: '★', name: 'Wild Orb' },
  { type: 'shuffle', icon: '⟳', name: 'Shuffle' },
  { type: 'freezeTimer', icon: '❄', name: 'Freeze' },
  { type: 'columnClear', icon: '⬇', name: 'Column Clear' },
];

const BASE_DROP_DELAY = 4.0;
const MIN_DROP_DELAY = 0.8;
const DELAY_DEC = 0.25;
const CLEARS_PER_LVL = 10;
const DROP_ANIM_SPEED = 6.0;
const CLEAR_ANIM_TIME = 0.35;
const CASCADE_DELAY = 0.15;
const NEXT_ORB_DELAY = 0.25;
const COUNTDOWN_TIME = 3.0;
const TIME_ATTACK_SECS = 120;
const SPRINT_TARGET = 40;
const SURVIVAL_SPEEDUP = 0.04;
const NOTIFY_DURATION = 2.5;
const POWERUP_COMBO_THRESHOLD = 3;

// XP system
const XP_PER_GAME = 50;
const XP_PER_CLEAR = 2;
const XP_PER_LEVEL = 25;
const XP_PER_COMBO = 10;
const XP_PER_BOARD_CLEAR = 200;
const XP_BASE_LEVEL_REQ = 200;
const XP_LEVEL_GROWTH = 1.15;
const PLAYER_TITLES = [
  'Novice', 'Rookie', 'Apprentice', 'Dropper', 'Matcher',
  'Chainer', 'Comboist', 'Expert', 'Master', 'Champion',
  'Legend', 'Grandmaster', 'Neon Lord', 'Orb Sage', 'Void Walker',
  'Transcendent', 'Mythic', 'Cosmic', 'Eternal', 'Omega',
];

function xpForLevel(lvl: number): number {
  return Math.floor(XP_BASE_LEVEL_REQ * Math.pow(XP_LEVEL_GROWTH, lvl - 1));
}

function getPlayerTitle(lvl: number): string {
  return PLAYER_TITLES[Math.min(lvl, PLAYER_TITLES.length - 1)];
}

// Difficulty multipliers
const DIFFICULTIES = [
  { name: 'Easy', speedMult: 1.5, scoreMult: 0.7 },
  { name: 'Normal', speedMult: 1.0, scoreMult: 1.0 },
  { name: 'Hard', speedMult: 0.6, scoreMult: 1.5 },
];

const MODE_NAMES: Record<GameMode, string> = {
  classic: 'Classic', endless: 'Endless', timeAttack: 'Time Attack',
  sprint: 'Sprint', zen: 'Zen', survival: 'Survival', cascade: 'Cascade Chal.',
  colorlimit: 'Color Limit', gravity: 'Gravity', daily: 'Daily Challenge',
  puzzle: 'Puzzle',
};

// ============================================================
// SEEDED RANDOM (for daily challenge)
// ============================================================
function mulberry32(seed: number) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function getDailySeed(): number {
  const now = new Date();
  return now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
}

// ============================================================
// ACHIEVEMENTS
// ============================================================
const ACHIEVEMENT_DEFS: AchievementDef[] = [
  { id: 'first_match', name: 'First Match', desc: 'Clear your first match', icon: '★' },
  { id: 'combo_x2', name: 'Double Combo', desc: 'Reach a 2x combo chain', icon: '★' },
  { id: 'combo_x3', name: 'Triple Combo', desc: 'Reach a 3x combo chain', icon: '★' },
  { id: 'combo_x5', name: 'Pentachain', desc: 'Reach a 5x combo chain', icon: '◆' },
  { id: 'combo_x8', name: 'Octachain', desc: 'Reach an 8x combo chain', icon: '◆' },
  { id: 'combo_x10', name: 'Decachain', desc: 'Reach a 10x combo chain', icon: '◇' },
  { id: 'combo_x15', name: 'Hyperchain', desc: 'Reach a 15x combo chain', icon: '◇' },
  { id: 'score_500', name: 'Scorer', desc: 'Score 500 points in one game', icon: '★' },
  { id: 'score_2000', name: 'High Scorer', desc: 'Score 2,000 points in one game', icon: '★' },
  { id: 'score_5000', name: 'Pro Scorer', desc: 'Score 5,000 points in one game', icon: '◆' },
  { id: 'score_10000', name: 'Master Scorer', desc: 'Score 10,000 points in one game', icon: '◆' },
  { id: 'score_25000', name: 'Legend', desc: 'Score 25,000 points in one game', icon: '◇' },
  { id: 'score_50000', name: 'Mythic', desc: 'Score 50,000 points in one game', icon: '◇' },
  { id: 'level_5', name: 'Rising', desc: 'Reach level 5', icon: '★' },
  { id: 'level_10', name: 'Climber', desc: 'Reach level 10', icon: '◆' },
  { id: 'level_20', name: 'Ascended', desc: 'Reach level 20', icon: '◇' },
  { id: 'level_30', name: 'Transcendent', desc: 'Reach level 30', icon: '◇' },
  { id: 'clears_50', name: 'Cleaner', desc: 'Clear 50 orbs in one game', icon: '★' },
  { id: 'clears_100', name: 'Purifier', desc: 'Clear 100 orbs in one game', icon: '◆' },
  { id: 'clears_200', name: 'Annihilator', desc: 'Clear 200 orbs in one game', icon: '◇' },
  { id: 'clears_500', name: 'Obliterator', desc: 'Clear 500 orbs in one game', icon: '◇' },
  { id: 'cascade_5', name: 'Chain Reactor', desc: 'Get 5 cascades in one game', icon: '★' },
  { id: 'cascade_15', name: 'Avalanche', desc: 'Get 15 cascades in one game', icon: '◆' },
  { id: 'cascade_30', name: 'Cataclysm', desc: 'Get 30 cascades in one game', icon: '◇' },
  { id: 'games_5', name: 'Regular', desc: 'Play 5 games', icon: '★' },
  { id: 'games_20', name: 'Dedicated', desc: 'Play 20 games', icon: '◆' },
  { id: 'games_50', name: 'Veteran', desc: 'Play 50 games', icon: '◇' },
  { id: 'games_100', name: 'Centurion', desc: 'Play 100 games', icon: '◇' },
  { id: 'powerup_first', name: 'Empowered', desc: 'Use your first power-up', icon: '★' },
  { id: 'powerup_10', name: 'Power Player', desc: 'Use 10 power-ups', icon: '◆' },
  { id: 'powerup_50', name: 'Arsenal', desc: 'Use 50 power-ups', icon: '◇' },
  { id: 'mode_classic', name: 'Classicist', desc: 'Complete a Classic game', icon: '★' },
  { id: 'mode_endless', name: 'Endurance', desc: 'Score 3,000 in Endless', icon: '★' },
  { id: 'mode_timeattack', name: 'Speed Demon', desc: 'Score 1,000 in Time Attack', icon: '★' },
  { id: 'mode_sprint', name: 'Sprinter', desc: 'Complete Sprint mode', icon: '★' },
  { id: 'mode_survival', name: 'Survivor', desc: 'Reach level 10 in Survival', icon: '◆' },
  { id: 'mode_cascade', name: 'Cascade Master', desc: 'Score 2,000 in Cascade mode', icon: '◆' },
  { id: 'mode_daily', name: 'Daily Player', desc: 'Complete a Daily Challenge', icon: '★' },
  { id: 'mode_puzzle', name: 'Puzzler', desc: 'Complete a Puzzle round', icon: '★' },
  { id: 'all_themes', name: 'Decorator', desc: 'Try all 8 themes', icon: '★' },
  { id: 'big_clear', name: 'Big Bang', desc: 'Clear 7+ orbs in a single match', icon: '◆' },
  { id: 'mega_clear', name: 'Supernova', desc: 'Clear 10+ orbs in a single match', icon: '◇' },
  { id: 'full_board', name: 'Last Second', desc: 'Clear a match with 11 rows filled', icon: '◇' },
  { id: 'board_clear', name: 'Tabula Rasa', desc: 'Clear the entire board', icon: '◇' },
  { id: 'total_clears_500', name: 'Orb Hunter', desc: 'Clear 500 total orbs', icon: '★' },
  { id: 'total_clears_2000', name: 'Orb Slayer', desc: 'Clear 2,000 total orbs', icon: '◆' },
  { id: 'total_clears_5000', name: 'Orb Destroyer', desc: 'Clear 5,000 total orbs', icon: '◇' },
  { id: 'total_score_50k', name: 'Point Hoarder', desc: 'Accumulate 50,000 total score', icon: '◆' },
  { id: 'total_score_200k', name: 'Point Emperor', desc: 'Accumulate 200,000 total score', icon: '◇' },
  { id: 'speed_clear', name: 'Lightning', desc: 'Clear 20 orbs in 30 seconds', icon: '◆' },
  { id: 'no_powerup', name: 'Purist', desc: 'Score 5,000 without using power-ups', icon: '◇' },
  { id: 'match4', name: 'Four of a Kind', desc: 'Clear a 4-match', icon: '★' },
  { id: 'match5', name: 'Quintet', desc: 'Clear a 5-match', icon: '◆' },
  { id: 'match6', name: 'Hextet', desc: 'Clear a 6-match', icon: '◇' },
  { id: 'all_skins', name: 'Fashionista', desc: 'Try all 6 orb skins', icon: '★' },
  { id: 'daily_streak_3', name: 'Consistent', desc: 'Play daily challenge 3 days in a row', icon: '◆' },
  { id: 'daily_streak_7', name: 'Devoted', desc: 'Play daily challenge 7 days in a row', icon: '◇' },
  { id: 'drops_100', name: 'Dropper', desc: 'Drop 100 orbs in one game', icon: '★' },
  { id: 'drops_500', name: 'Rain Maker', desc: 'Drop 500 orbs in one game', icon: '◇' },
  { id: 'triple_powerup', name: 'Fully Loaded', desc: 'Have 3 power-ups at once', icon: '◆' },
  { id: 'player_lvl_5', name: 'Rising Star', desc: 'Reach player level 5', icon: '★' },
  { id: 'player_lvl_10', name: 'Experienced', desc: 'Reach player level 10', icon: '◆' },
  { id: 'player_lvl_20', name: 'Seasoned Pro', desc: 'Reach player level 20', icon: '◇' },
  { id: 'hard_mode', name: 'Hard Mode', desc: 'Score 3,000 on Hard difficulty', icon: '◇' },
  { id: 'board_clear_3', name: 'Clean Sweep', desc: 'Clear the board 3 times total', icon: '◆' },
  { id: 'use_shuffle', name: 'Mixer', desc: 'Use the Shuffle power-up', icon: '★' },
  { id: 'use_freeze', name: 'Ice Age', desc: 'Use the Freeze power-up', icon: '★' },
  { id: 'use_colclear', name: 'Column Crusher', desc: 'Use the Column Clear power-up', icon: '★' },
  { id: 'score_100000', name: 'Score King', desc: 'Score 100,000 in a single game', icon: '◇' },
  { id: 'all_modes', name: 'Mode Master', desc: 'Play every game mode at least once', icon: '◇' },
  { id: 'zen_10k', name: 'Inner Peace', desc: 'Score 10,000 in Zen mode', icon: '◆' },
  { id: 'gravity_5k', name: 'Speed Demon 2', desc: 'Score 5,000 in Gravity mode', icon: '◇' },
  { id: 'total_games_200', name: 'Addicted', desc: 'Play 200 games total', icon: '◇' },
  { id: 'colorlimit_3k', name: 'Color Master', desc: 'Score 3,000 in Color Limit mode', icon: '◆' },
  { id: 'survival_lvl20', name: 'Iron Will', desc: 'Reach level 20 in Survival', icon: '◇' },
  { id: 'xp_10k', name: 'XP Farmer', desc: 'Earn 10,000 total XP', icon: '◆' },
  { id: 'perfect_sprint', name: 'Perfect Sprint', desc: 'Complete Sprint in under 60 seconds', icon: '◇' },
  // Round 7 achievements
  { id: 'combo_x20', name: 'Ultrachain', desc: 'Reach a 20x combo chain', icon: '◇' },
  { id: 'score_200000', name: 'Score Emperor', desc: 'Score 200,000 in a single game', icon: '◇' },
  { id: 'total_clears_5000', name: 'Mass Extinction', desc: 'Clear 5,000 orbs total', icon: '◆' },
  { id: 'total_clears_10000', name: 'Orb Annihilator', desc: 'Clear 10,000 orbs total', icon: '◇' },
  { id: 'daily_streak_7', name: 'Weekly Warrior', desc: 'Reach a 7-day daily streak', icon: '◆' },
  { id: 'daily_streak_30', name: 'Monthly Master', desc: 'Reach a 30-day daily streak', icon: '◇' },
  { id: 'total_score_500k', name: 'Half Million Club', desc: 'Accumulate 500,000 total score', icon: '◇' },
  { id: 'use_all_powerups', name: 'Arsenal', desc: 'Use every power-up type at least once', icon: '◆' },
  { id: 'board_clear_10', name: 'Spotless', desc: 'Clear the board 10 times total', icon: '◇' },
  { id: 'endless_50k', name: 'Eternity', desc: 'Score 50,000 in Endless mode', icon: '◇' },
];

const ACH_PER_PAGE = 8;

// ============================================================
// AUDIO
// ============================================================
class AudioMgr {
  private ctx: AudioContext | null = null;
  sfxVol = 0.8;
  musVol = 0.6;
  private drone: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;

  private ensure() {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  play(type: 'drop' | 'clear' | 'cascade' | 'combo' | 'gameover' | 'select' | 'move' | 'levelup' | 'countdown' | 'powerup' | 'achievement') {
    const c = this.ensure();
    const g = c.createGain();
    g.connect(c.destination);
    const now = c.currentTime;
    switch (type) {
      case 'drop': {
        g.gain.setValueAtTime(0.3 * this.sfxVol, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(180, now);
        o.frequency.exponentialRampToValueAtTime(60, now + 0.15); o.connect(g); o.start(now); o.stop(now + 0.15);
        break;
      }
      case 'clear': {
        g.gain.setValueAtTime(0.25 * this.sfxVol, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        const o = c.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(400, now);
        o.frequency.exponentialRampToValueAtTime(1200, now + 0.3); o.connect(g); o.start(now); o.stop(now + 0.4);
        break;
      }
      case 'cascade': {
        g.gain.setValueAtTime(0.3 * this.sfxVol, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        const o = c.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(600, now);
        o.frequency.exponentialRampToValueAtTime(1800, now + 0.4); o.connect(g); o.start(now); o.stop(now + 0.5);
        break;
      }
      case 'combo': {
        g.gain.setValueAtTime(0.2 * this.sfxVol, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        const o1 = c.createOscillator(); o1.type = 'sine'; o1.frequency.setValueAtTime(523, now);
        o1.connect(g); o1.start(now); o1.stop(now + 0.15);
        const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.setValueAtTime(659, now + 0.15);
        const g2 = c.createGain(); g2.gain.setValueAtTime(0.2 * this.sfxVol, now + 0.15);
        g2.gain.exponentialRampToValueAtTime(0.001, now + 0.4); g2.connect(c.destination);
        o2.connect(g2); o2.start(now + 0.15); o2.stop(now + 0.4);
        break;
      }
      case 'gameover': {
        g.gain.setValueAtTime(0.3 * this.sfxVol, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
        const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(440, now);
        o.frequency.exponentialRampToValueAtTime(80, now + 0.8); o.connect(g); o.start(now); o.stop(now + 1.0);
        break;
      }
      case 'select': {
        g.gain.setValueAtTime(0.15 * this.sfxVol, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = 800; o.connect(g); o.start(now); o.stop(now + 0.08);
        break;
      }
      case 'move': {
        g.gain.setValueAtTime(0.1 * this.sfxVol, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = 600; o.connect(g); o.start(now); o.stop(now + 0.04);
        break;
      }
      case 'levelup': {
        for (let i = 0; i < 4; i++) {
          const t = now + i * 0.1;
          const gi = c.createGain(); gi.gain.setValueAtTime(0.2 * this.sfxVol, t);
          gi.gain.exponentialRampToValueAtTime(0.001, t + 0.15); gi.connect(c.destination);
          const o = c.createOscillator(); o.type = 'triangle';
          o.frequency.setValueAtTime(440 * Math.pow(2, i / 4), t);
          o.connect(gi); o.start(t); o.stop(t + 0.15);
        }
        break;
      }
      case 'countdown': {
        g.gain.setValueAtTime(0.2 * this.sfxVol, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        const o = c.createOscillator(); o.type = 'square'; o.frequency.value = 440; o.connect(g); o.start(now); o.stop(now + 0.2);
        break;
      }
      case 'powerup': {
        g.gain.setValueAtTime(0.25 * this.sfxVol, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        const o = c.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(800, now);
        o.frequency.exponentialRampToValueAtTime(1600, now + 0.2);
        o.connect(g); o.start(now); o.stop(now + 0.5);
        break;
      }
      case 'achievement': {
        for (let i = 0; i < 5; i++) {
          const t = now + i * 0.08;
          const gi = c.createGain(); gi.gain.setValueAtTime(0.15 * this.sfxVol, t);
          gi.gain.exponentialRampToValueAtTime(0.001, t + 0.2); gi.connect(c.destination);
          const o = c.createOscillator(); o.type = 'sine';
          o.frequency.setValueAtTime(523 * Math.pow(2, i / 6), t);
          o.connect(gi); o.start(t); o.stop(t + 0.2);
        }
        break;
      }
    }
  }

  startMusic() {
    if (this.drone) return;
    const c = this.ensure();
    this.droneGain = c.createGain();
    this.droneGain.gain.value = 0.08 * this.musVol;
    this.droneGain.connect(c.destination);
    this.drone = c.createOscillator();
    this.drone.type = 'sine';
    this.drone.frequency.value = 55;
    this.drone.connect(this.droneGain);
    this.drone.start();
    // Second harmonic
    const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = 82.5;
    const g2 = c.createGain(); g2.gain.value = 0.04 * this.musVol; g2.connect(c.destination);
    o2.connect(g2); o2.start();
    // Arpeggiator — subtle ambient notes
    const arpNotes = [110, 146.83, 164.81, 196, 220, 261.63, 329.63];
    let arpIdx = 0;
    const arpInterval = setInterval(() => {
      if (!this.ctx || this.musVol <= 0) return;
      const now = this.ctx.currentTime;
      const arpGain = this.ctx.createGain();
      arpGain.gain.setValueAtTime(0.015 * this.musVol, now);
      arpGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
      arpGain.connect(this.ctx.destination);
      const arpOsc = this.ctx.createOscillator();
      arpOsc.type = 'sine';
      arpOsc.frequency.value = arpNotes[arpIdx % arpNotes.length];
      arpOsc.connect(arpGain);
      arpOsc.start(now);
      arpOsc.stop(now + 1.5);
      arpIdx++;
    }, 2000);
    (this as any)._arpInterval = arpInterval;
  }

  updateMusicVol() {
    if (this.droneGain) this.droneGain.gain.value = 0.08 * this.musVol;
  }
}

// ============================================================
// SAVE/LOAD
// ============================================================
const SAVE_KEY = 'neonDrop_save';
function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Migrate old saves
      if (!parsed.totalScore) parsed.totalScore = 0;
      if (!parsed.totalDrops) parsed.totalDrops = 0;
      if (!parsed.totalPowerUps) parsed.totalPowerUps = 0;
      if (!parsed.bestLevel) parsed.bestLevel = 0;
      if (!parsed.unlockedAch) parsed.unlockedAch = [];
      if (parsed.skinIdx === undefined) parsed.skinIdx = 0;
      if (parsed.xp === undefined) parsed.xp = 0;
      if (parsed.playerLevel === undefined) parsed.playerLevel = 0;
      if (parsed.dailyStreak === undefined) parsed.dailyStreak = 0;
      if (!parsed.lastDailyDate) parsed.lastDailyDate = '';
      if (parsed.totalBoardClears === undefined) parsed.totalBoardClears = 0;
      if (!parsed.settings.difficulty && parsed.settings.difficulty !== 0) parsed.settings.difficulty = 1;
      return parsed;
    }
  } catch { /* ignore */ }
  return {
    highScores: {}, totalGames: 0, totalScore: 0, totalClears: 0,
    totalCascades: 0, totalDrops: 0, totalPowerUps: 0, bestCombo: 0,
    bestLevel: 0, unlockedAch: [], skinIdx: 0,
    settings: { sfxVol: 0.8, musVol: 0.6, themeIdx: 0, difficulty: 1 },
    xp: 0, playerLevel: 0, dailyStreak: 0, lastDailyDate: '', totalBoardClears: 0,
  };
}
function writeSave(s: SaveData) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

// ============================================================
// GRID LOGIC
// ============================================================
function makeGrid(): number[][] {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

function gridToWorld(row: number, col: number): Vector3 {
  const x = GRID_CX - GRID_W / 2 + col * CELL + CELL / 2;
  const y = GRID_BY + row * CELL + CELL / 2;
  return new Vector3(x, y, GRID_Z);
}

function lowestEmptyRow(grid: number[][], col: number): number {
  for (let r = 0; r < ROWS; r++) {
    if (grid[r][col] === 0) return r;
  }
  return -1;
}

function findMatches(grid: number[][]): { cells: [number, number][]; maxGroupSize: number } {
  const matched = new Set<string>();
  const dirs: [number, number][] = [[0, 1], [1, 0], [1, 1], [1, -1]];
  let maxGroupSize = 0;
  for (const [dr, dc] of dirs) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c] === 0) continue;
        const color = grid[r][c];
        const cells: [number, number][] = [[r, c]];
        let nr = r + dr, nc = c + dc;
        while (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && grid[nr][nc] === color) {
          cells.push([nr, nc]);
          nr += dr; nc += dc;
        }
        if (cells.length >= 3) {
          if (cells.length > maxGroupSize) maxGroupSize = cells.length;
          for (const [cr, cc] of cells) matched.add(`${cr},${cc}`);
        }
      }
    }
  }
  return {
    cells: [...matched].map(s => { const p = s.split(','); return [+p[0], +p[1]]; }),
    maxGroupSize,
  };
}

function applyGravity(grid: number[][], meshes: (Mesh | null)[][]): boolean {
  let moved = false;
  for (let c = 0; c < COLS; c++) {
    let w = 0;
    for (let r = 0; r < ROWS; r++) {
      if (grid[r][c] !== 0) {
        if (r !== w) {
          grid[w][c] = grid[r][c]; grid[r][c] = 0;
          meshes[w][c] = meshes[r][c]; meshes[r][c] = null;
          if (meshes[w][c]) {
            const pos = gridToWorld(w, c);
            meshes[w][c]!.position.copy(pos);
          }
          moved = true;
        }
        w++;
      }
    }
  }
  return moved;
}

function highestOccupiedRow(grid: number[][]): number {
  for (let r = ROWS - 1; r >= 0; r--) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] !== 0) return r;
    }
  }
  return -1;
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  const container = document.getElementById('app') as HTMLDivElement;
  const world = await World.create(container, {
    xr: { offer: 'once' as const },
    input: { canvasPointerEvents: true },
    features: { grabbing: false, locomotion: false, physics: false, spatialUI: true },
    render: { near: 0.01, far: 200, camera: { position: [0, 1.5, 0], lookAt: [0, 1.2, -1.6] } },
  } as any);

  const audio = new AudioMgr();
  const save = loadSave();
  audio.sfxVol = save.settings.sfxVol;
  audio.musVol = save.settings.musVol;
  let themeIdx = save.settings.themeIdx;
  let skinIdx = save.skinIdx;
  let difficulty = save.settings.difficulty ?? 1;

  // ---- Scene ----
  const scene = world.scene;
  scene.fog = new Fog(THEMES[themeIdx].fog, 0.5, 25);
  const ambLight = new AmbientLight(THEMES[themeIdx].amb, 0.6);
  scene.add(ambLight);
  const dirLight = new DirectionalLight(0xffffff, 0.4);
  dirLight.position.set(2, 4, 1);
  scene.add(dirLight);

  // Holodeck environment
  const gridColor = new Color(THEMES[themeIdx].grid);
  let holodeckGrp: Group;

  function makeHolodeck(): Group {
    const grp = new Group();
    const floorGeo = new PlaneGeometry(20, 20);
    const floorMat = new MeshStandardMaterial({ color: THEMES[themeIdx].floor, roughness: 0.9 });
    const floor = new Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2; floor.position.y = 0;
    grp.add(floor);
    const linesMat = new LineBasicMaterial({ color: gridColor, transparent: true, opacity: 0.15 });
    for (let i = -10; i <= 10; i++) {
      const g1 = new BufferGeometry().setFromPoints([new Vector3(i, 0.001, -10), new Vector3(i, 0.001, 10)]);
      grp.add(new LineSegments(g1, linesMat));
      const g2 = new BufferGeometry().setFromPoints([new Vector3(-10, 0.001, i), new Vector3(10, 0.001, i)]);
      grp.add(new LineSegments(g2, linesMat));
    }
    const wallMat = new MeshStandardMaterial({ color: THEMES[themeIdx].floor, transparent: true, opacity: 0.3 });
    const wallGeo = new PlaneGeometry(20, 5);
    const bw = new Mesh(wallGeo, wallMat); bw.position.set(0, 2.5, -10); grp.add(bw);
    const lw = new Mesh(wallGeo, wallMat); lw.position.set(-10, 2.5, 0); lw.rotation.y = Math.PI / 2; grp.add(lw);
    const rw = new Mesh(wallGeo, wallMat); rw.position.set(10, 2.5, 0); rw.rotation.y = -Math.PI / 2; grp.add(rw);
    return grp;
  }
  holodeckGrp = makeHolodeck();
  scene.add(holodeckGrp);

  // ---- Grid Frame ----
  const gridFrameGrp = new Group();
  gridFrameGrp.position.set(GRID_CX, GRID_BY, GRID_Z);
  scene.add(gridFrameGrp);

  function buildGridFrame() {
    while (gridFrameGrp.children.length > 0) gridFrameGrp.remove(gridFrameGrp.children[0]);
    const c = new Color(THEMES[themeIdx].grid);
    const mat = new LineBasicMaterial({ color: c, transparent: true, opacity: 0.3 });
    const matBorder = new LineBasicMaterial({ color: c, transparent: true, opacity: 0.6 });
    const hw = GRID_W / 2, hh = GRID_H;
    const border = new BufferGeometry().setFromPoints([
      new Vector3(-hw, 0, 0), new Vector3(hw, 0, 0),
      new Vector3(hw, 0, 0), new Vector3(hw, hh, 0),
      new Vector3(hw, hh, 0), new Vector3(-hw, hh, 0),
      new Vector3(-hw, hh, 0), new Vector3(-hw, 0, 0),
    ]);
    gridFrameGrp.add(new LineSegments(border, matBorder));
    for (let i = 1; i < COLS; i++) {
      const x = -hw + i * CELL;
      const g = new BufferGeometry().setFromPoints([new Vector3(x, 0, 0), new Vector3(x, hh, 0)]);
      gridFrameGrp.add(new LineSegments(g, mat));
    }
    for (let i = 1; i < ROWS; i++) {
      const y = i * CELL;
      const g = new BufferGeometry().setFromPoints([new Vector3(-hw, y, 0), new Vector3(hw, y, 0)]);
      gridFrameGrp.add(new LineSegments(g, mat));
    }
    const panelGeo = new PlaneGeometry(GRID_W, GRID_H);
    const panelMat = new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 });
    const panel = new Mesh(panelGeo, panelMat);
    panel.position.set(0, hh / 2, -0.005);
    gridFrameGrp.add(panel);
    // Re-add selector
    gridFrameGrp.add(selectorMesh);
  }

  // ---- Column Selector ----
  const selectorGeo = new PlaneGeometry(CELL * 0.9, GRID_H);
  const selectorMat = new MeshBasicMaterial({
    color: new Color(THEMES[themeIdx].grid), transparent: true, opacity: 0.12,
  });
  const selectorMesh = new Mesh(selectorGeo, selectorMat);
  selectorMesh.position.set(0, GRID_H / 2, 0.001);
  gridFrameGrp.add(selectorMesh);

  function updateSelectorCol(col: number) {
    selectorMesh.position.x = -GRID_W / 2 + col * CELL + CELL / 2;
  }

  buildGridFrame();

  // ---- Orb Geometry / Material Factory ----
  const orbGeoSphere = new SphereGeometry(ORB_R, 16, 12);
  const orbGeoIcosa = new IcosahedronGeometry(ORB_R, 0);
  const orbGeoOcta = new OctahedronGeometry(ORB_R, 0);

  function getOrbGeo(): BufferGeometry {
    const skin = SKIN_DEFS[skinIdx];
    switch (skin.geoType) {
      case 'icosahedron': return orbGeoIcosa;
      case 'octahedron': return orbGeoOcta;
      default: return orbGeoSphere;
    }
  }

  function createOrbMat(colorIdx: number): MeshStandardMaterial {
    const skin = SKIN_DEFS[skinIdx];
    const c = ORB_COLORS[colorIdx - 1];
    return new MeshStandardMaterial({
      color: c.hex, emissive: c.em,
      emissiveIntensity: skin.emIntensity,
      roughness: skin.roughness, metalness: skin.metalness,
    });
  }

  function createOrbMesh(colorIdx: number): Mesh {
    return new Mesh(getOrbGeo(), createOrbMat(colorIdx));
  }

  // ---- Active Orb ----
  let activeOrb: Mesh | null = null;
  let activeOrbColor = 0;
  let ghostOrb: Mesh | null = null;

  function spawnActiveOrb(colorIdx: number, col: number) {
    if (activeOrb) scene.remove(activeOrb);
    activeOrb = createOrbMesh(colorIdx);
    activeOrbColor = colorIdx;
    const pos = gridToWorld(ROWS, col);
    pos.y += CELL * 0.5;
    activeOrb.position.copy(pos);
    scene.add(activeOrb);
    updateGhostOrb(colorIdx, col);
  }

  function moveActiveOrbToCol(col: number) {
    if (!activeOrb) return;
    const pos = gridToWorld(ROWS, col);
    pos.y += CELL * 0.5;
    activeOrb.position.x = pos.x;
    updateGhostOrb(activeOrbColor, col);
  }

  function removeActiveOrb() {
    if (activeOrb) { scene.remove(activeOrb); activeOrb = null; }
    removeGhostOrb();
  }

  function updateGhostOrb(colorIdx: number, col: number) {
    removeGhostOrb();
    const targetRow = lowestEmptyRow(grid, col);
    if (targetRow < 0) return;
    const skin = SKIN_DEFS[skinIdx];
    const c = ORB_COLORS[colorIdx - 1];
    const mat = new MeshStandardMaterial({
      color: c.hex, emissive: c.em,
      emissiveIntensity: skin.emIntensity * 0.3,
      roughness: skin.roughness, metalness: skin.metalness,
      transparent: true, opacity: 0.2,
    });
    ghostOrb = new Mesh(getOrbGeo(), mat);
    ghostOrb.position.copy(gridToWorld(targetRow, col));
    scene.add(ghostOrb);
  }

  function removeGhostOrb() {
    if (ghostOrb) { scene.remove(ghostOrb); ghostOrb = null; }
  }

  // ---- Particles ----
  interface Particle { mesh: Mesh; vel: Vector3; age: number; life: number; }
  const particles: Particle[] = [];
  const particleGeo = new SphereGeometry(0.008, 6, 4);

  // ---- Combo Flash Effect ----
  let comboFlashIntensity = 0;
  const comboFlashLight = new PointLight(0xffffff, 0, 15);
  comboFlashLight.position.set(GRID_CX, GRID_BY + GRID_H / 2, GRID_Z + 0.5);
  scene.add(comboFlashLight);

  // ---- Landing Impact Flash ----
  const landingFlashLight = new PointLight(0xffffff, 0, 8);
  landingFlashLight.position.set(GRID_CX, GRID_BY, GRID_Z + 0.3);
  scene.add(landingFlashLight);

  function triggerLandingFlash(row: number, col: number, colorIdx: number) {
    const pos = gridToWorld(row, col);
    landingFlashLight.position.set(pos.x, pos.y, pos.z + 0.3);
    landingFlashLight.color.set(ORB_COLORS[colorIdx - 1]?.hex || '#ffffff');
    landingFlashLight.intensity = 1.5;
    landingFlashTimer = 0.25;
  }

  function updateLandingFlash(dt: number) {
    if (landingFlashTimer > 0) {
      landingFlashTimer -= dt;
      landingFlashLight.intensity = Math.max(0, (landingFlashTimer / 0.25) * 1.5);
    }
  }

  // ---- Grid Border Glow ----
  let borderGlowMat: LineBasicMaterial | null = null;

  function triggerBorderGlow(chain: number) {
    borderGlowIntensity = Math.min(1.0, chain * 0.15);
    // Pick glow color from theme
    borderGlowColor.set(THEMES[themeIdx].grid);
  }

  function updateBorderGlow(dt: number) {
    if (borderGlowIntensity > 0) {
      borderGlowIntensity = Math.max(0, borderGlowIntensity - dt * 0.6);
      // Modulate the grid frame border material opacity
      const children = gridFrameGrp.children;
      if (children.length > 0) {
        const firstChild = children[0];
        if ((firstChild as any).material && (firstChild as any).material.opacity !== undefined) {
          const baseBorderOpacity = 0.6;
          (firstChild as any).material.opacity = baseBorderOpacity + borderGlowIntensity * 0.4;
          (firstChild as any).material.color.lerp(borderGlowColor, borderGlowIntensity);
        }
      }
    }
  }

  // ---- Particle Pool System ----
  function initParticlePool() {
    if (particlePoolInited) return;
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      const mat = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
      const m = new Mesh(particleGeo, mat);
      m.visible = false;
      scene.add(m);
      particlePool.push({ mesh: m, vel: new Vector3(), age: 0, life: 0 });
    }
    particlePoolInited = true;
  }

  function spawnParticlesPooled(pos: Vector3, color: Color, count: number) {
    if (!particlePoolInited) initParticlePool();
    let spawned = 0;
    for (let i = 0; i < particlePool.length && spawned < count; i++) {
      const p = particlePool[i];
      if (!p.mesh.visible) {
        p.mesh.position.copy(pos);
        (p.mesh.material as MeshBasicMaterial).color.copy(color);
        (p.mesh.material as MeshBasicMaterial).opacity = 1;
        p.mesh.scale.setScalar(1);
        p.mesh.visible = true;
        p.vel.set((Math.random() - 0.5) * 2, Math.random() * 2 + 0.5, (Math.random() - 0.5) * 0.5);
        p.age = 0;
        p.life = 0.5 + Math.random() * 0.3;
        spawned++;
      }
    }
  }

  function updateParticlesPooled(dt: number) {
    for (const p of particlePool) {
      if (!p.mesh.visible) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.mesh.visible = false;
        (p.mesh.material as MeshBasicMaterial).opacity = 0;
        continue;
      }
      p.vel.y -= 3 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      const t = 1 - p.age / p.life;
      (p.mesh.material as MeshBasicMaterial).opacity = t;
      p.mesh.scale.setScalar(t);
    }
  }

  // ---- Column Highlight Pulse ----
  let columnPulseTime = 0;

  // ---- Screen Shake ----
  let shakeIntensity = 0;
  let shakeTimer = 0;
  const gridBasePos = new Vector3(GRID_CX, GRID_BY, GRID_Z);

  // ---- Orb Landing Squish ----
  interface SquishAnim { mesh: Mesh; timer: number; duration: number; }
  const squishAnims: SquishAnim[] = [];

  function triggerSquish(mesh: Mesh) {
    squishAnims.push({ mesh, timer: 0, duration: 0.2 });
  }

  function updateSquishAnims(dt: number) {
    for (let i = squishAnims.length - 1; i >= 0; i--) {
      const s = squishAnims[i];
      s.timer += dt;
      const t = s.timer / s.duration;
      if (t >= 1) {
        s.mesh.scale.set(1, 1, 1);
        squishAnims.splice(i, 1);
        continue;
      }
      // Squish: flatten vertically then spring back
      const squish = Math.sin(t * Math.PI) * 0.3;
      s.mesh.scale.set(1 + squish * 0.5, 1 - squish, 1 + squish * 0.5);
    }
  }

  function triggerScreenShake(intensity: number) {
    shakeIntensity = Math.min(0.02, intensity);
    shakeTimer = 0.3;
  }

  function updateScreenShake(dt: number) {
    if (shakeTimer > 0) {
      shakeTimer -= dt;
      const t = shakeTimer / 0.3;
      const dx = (Math.random() - 0.5) * 2 * shakeIntensity * t;
      const dy = (Math.random() - 0.5) * 2 * shakeIntensity * t;
      gridFrameGrp.position.set(gridBasePos.x + dx, gridBasePos.y + dy, gridBasePos.z);
    } else if (gridFrameGrp.position.x !== gridBasePos.x || gridFrameGrp.position.y !== gridBasePos.y) {
      gridFrameGrp.position.copy(gridBasePos);
    }
  }

  function triggerComboFlash(chain: number, color: Color) {
    comboFlashLight.color.copy(color);
    comboFlashIntensity = Math.min(3.0, chain * 0.5);
    comboFlashLight.intensity = comboFlashIntensity;
  }

  function updateComboFlash(dt: number) {
    if (comboFlashIntensity > 0) {
      comboFlashIntensity = Math.max(0, comboFlashIntensity - dt * 4);
      comboFlashLight.intensity = comboFlashIntensity;
    }
  }

  // ---- Score Popup System ----
  interface ScorePopup { mesh: Mesh; age: number; }
  const scorePopups: ScorePopup[] = [];

  // Simple text-like visual: glowing sphere with text - we use pooled particles
  function spawnScoreEffect(pos: Vector3, pts: number, color: Color) {
    // Create a burst of particles proportional to points
    const count = Math.min(20, Math.max(4, Math.floor(pts / 50)));
    const burstPos = pos.clone();
    burstPos.y += 0.03;
    spawnParticlesPooled(burstPos, color, count);
  }

  // ---- Clear Animations ----
  const ringGeo = new TorusGeometry(ORB_R * 1.5, 0.003, 8, 24);
  interface ClearAnim { mesh: Mesh; orbMesh: Mesh | null; age: number; }
  const clearAnims: ClearAnim[] = [];

  function startClearAnim(row: number, col: number, colorIdx: number) {
    const pos = gridToWorld(row, col);
    const ringMat = new MeshBasicMaterial({ color: ORB_COLORS[colorIdx - 1].hex, transparent: true, opacity: 0.8 });
    const ring = new Mesh(ringGeo, ringMat);
    ring.position.copy(pos);
    ring.position.z += 0.01;
    scene.add(ring);
    clearAnims.push({ mesh: ring, orbMesh: orbMeshes[row][col], age: 0 });
  }

  function updateClearAnims(dt: number): boolean {
    let active = false;
    for (let i = clearAnims.length - 1; i >= 0; i--) {
      const a = clearAnims[i];
      a.age += dt;
      const t = a.age / CLEAR_ANIM_TIME;
      if (t >= 1) {
        scene.remove(a.mesh);
        if (a.orbMesh) a.orbMesh.scale.setScalar(0);
        clearAnims.splice(i, 1);
        continue;
      }
      active = true;
      a.mesh.scale.setScalar(1 + t * 2);
      (a.mesh.material as MeshBasicMaterial).opacity = 0.8 * (1 - t);
      if (a.orbMesh) a.orbMesh.scale.setScalar(1 - t);
    }
    return active;
  }

  // ---- Game State ----
  let grid = makeGrid();
  let orbMeshes: (Mesh | null)[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  let gameState: GameState = 'title';
  let gameMode: GameMode = 'classic';
  let playPhase: PlayPhase = 'selecting';
  let selectedCol = Math.floor(COLS / 2);
  let currentColor = 1;
  let nextColor = 1;
  let score = 0;
  let level = 1;
  let comboChain = 0;
  let totalClears = 0;
  let totalCascades = 0;
  let bestComboThisGame = 0;
  let dropsThisGame = 0;
  let dropTimer = 0;
  let clearTimer = 0;
  let cascadeTimer = 0;
  let nextOrbTimer = 0;
  let countdownTimer = 0;
  let gameTimer = 0;
  let sprintClears = 0;
  let thumbstickCooldown = 0;
  let pendingMatches: [number, number][] = [];
  let dropTargetRow = -1;
  let dropStartY = 0;
  let dropProgress = 0;
  let achPage = 0;
  let themesUsed = new Set<number>();
  let usedPowerUpsThisGame = 0;
  let maxMatchSize = 0;
  let speedClearCount = 0;
  let speedClearTimer = 0;
  let boardClearedThisGame = false;
  let skinsUsed = new Set<number>();
  let dailyRng: (() => number) | null = null;
  let freezeTimerRemaining = 0;
  let lastXpGained = 0;

  // Grid border glow state
  let borderGlowIntensity = 0;
  let borderGlowColor = new Color('#00ffff');

  // Landing impact flash state
  let landingFlashTimer = 0;
  let landingFlashPos = new Vector3();

  // Tutorial / first-time detection
  let tutorialShown = false;

  // Particle pool
  const PARTICLE_POOL_SIZE = 200;
  const particlePool: Particle[] = [];
  let particlePoolInited = false;

  // Puzzle mode state
  let puzzleLevel = 0;
  const PUZZLE_SEED_BASE = 42;

  // Power-ups
  let heldPowerUps: (PowerUpType | null)[] = [null, null, null];
  let powerUpChargeCombo = 0;

  // Notification queue
  let notifyTimer = 0;
  let notifyQueue: { icon: string; title: string; desc: string }[] = [];
  let notifyShowing = false;

  function randomColor(): number {
    if (gameMode === 'colorlimit') {
      const maxColors = Math.min(ORB_COLORS.length, 3 + Math.floor((level - 1) / 2));
      return Math.floor(Math.random() * maxColors) + 1;
    }
    if (gameMode === 'daily' && dailyRng) {
      return Math.floor(dailyRng() * ORB_COLORS.length) + 1;
    }
    if (gameMode === 'puzzle' && dailyRng) {
      return Math.floor(dailyRng() * Math.min(ORB_COLORS.length, 4 + Math.floor(puzzleLevel / 3))) + 1;
    }
    return Math.floor(Math.random() * ORB_COLORS.length) + 1;
  }

  function getDropDelay(): number {
    const diffMult = DIFFICULTIES[difficulty]?.speedMult ?? 1.0;
    if (gameMode === 'zen' || gameMode === 'endless') return BASE_DROP_DELAY * diffMult;
    if (gameMode === 'survival') return Math.max(MIN_DROP_DELAY, (BASE_DROP_DELAY - (level - 1) * SURVIVAL_SPEEDUP) * diffMult);
    if (gameMode === 'gravity') return Math.max(MIN_DROP_DELAY * 0.5, ((BASE_DROP_DELAY / 2) - (level - 1) * DELAY_DEC) * diffMult);
    return Math.max(MIN_DROP_DELAY, (BASE_DROP_DELAY - (level - 1) * DELAY_DEC) * diffMult);
  }

  function calcScore(count: number, chain: number): number {
    const base = count * 10;
    const groupBonus = count > 3 ? (count - 3) * 20 : 0;
    const matchSizeBonus = count >= 5 ? (count - 4) * 50 : 0;
    const chainMult = Math.max(1, chain);
    const diffMult = DIFFICULTIES[difficulty]?.scoreMult ?? 1.0;
    if (gameMode === 'cascade') {
      return Math.floor(chain > 1 ? (base + groupBonus + matchSizeBonus) * chainMult * 2 * diffMult : 0);
    }
    return Math.floor((base + groupBonus + matchSizeBonus) * chainMult * diffMult);
  }

  // ---- Clear Grid Visuals ----
  function clearAllOrbs() {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (orbMeshes[r][c]) { scene.remove(orbMeshes[r][c]!); orbMeshes[r][c] = null; }
      }
    }
    removeActiveOrb();
    for (const a of clearAnims) scene.remove(a.mesh);
    clearAnims.length = 0;
    // Reset particle pool
    for (const p of particlePool) {
      p.mesh.visible = false;
      (p.mesh.material as MeshBasicMaterial).opacity = 0;
    }
  }

  // ---- Achievement Checking ----
  function checkAchievements() {
    const newlyUnlocked: AchievementDef[] = [];
    for (const ach of ACHIEVEMENT_DEFS) {
      if (save.unlockedAch.includes(ach.id)) continue;
      let unlocked = false;
      switch (ach.id) {
        case 'first_match': unlocked = totalClears > 0; break;
        case 'combo_x2': unlocked = bestComboThisGame >= 2; break;
        case 'combo_x3': unlocked = bestComboThisGame >= 3; break;
        case 'combo_x5': unlocked = bestComboThisGame >= 5; break;
        case 'combo_x8': unlocked = bestComboThisGame >= 8; break;
        case 'combo_x10': unlocked = bestComboThisGame >= 10; break;
        case 'combo_x15': unlocked = bestComboThisGame >= 15; break;
        case 'score_500': unlocked = score >= 500; break;
        case 'score_2000': unlocked = score >= 2000; break;
        case 'score_5000': unlocked = score >= 5000; break;
        case 'score_10000': unlocked = score >= 10000; break;
        case 'score_25000': unlocked = score >= 25000; break;
        case 'score_50000': unlocked = score >= 50000; break;
        case 'level_5': unlocked = level >= 5; break;
        case 'level_10': unlocked = level >= 10; break;
        case 'level_20': unlocked = level >= 20; break;
        case 'level_30': unlocked = level >= 30; break;
        case 'clears_50': unlocked = totalClears >= 50; break;
        case 'clears_100': unlocked = totalClears >= 100; break;
        case 'clears_200': unlocked = totalClears >= 200; break;
        case 'clears_500': unlocked = totalClears >= 500; break;
        case 'cascade_5': unlocked = totalCascades >= 5; break;
        case 'cascade_15': unlocked = totalCascades >= 15; break;
        case 'cascade_30': unlocked = totalCascades >= 30; break;
        case 'games_5': unlocked = save.totalGames >= 5; break;
        case 'games_20': unlocked = save.totalGames >= 20; break;
        case 'games_50': unlocked = save.totalGames >= 50; break;
        case 'games_100': unlocked = save.totalGames >= 100; break;
        case 'powerup_first': unlocked = save.totalPowerUps >= 1; break;
        case 'powerup_10': unlocked = save.totalPowerUps >= 10; break;
        case 'powerup_50': unlocked = save.totalPowerUps >= 50; break;
        case 'mode_classic': unlocked = gameMode === 'classic' && gameState === 'gameOver'; break;
        case 'mode_endless': unlocked = gameMode === 'endless' && score >= 3000; break;
        case 'mode_timeattack': unlocked = gameMode === 'timeAttack' && score >= 1000; break;
        case 'mode_sprint': unlocked = gameMode === 'sprint' && sprintClears >= SPRINT_TARGET; break;
        case 'mode_survival': unlocked = gameMode === 'survival' && level >= 10; break;
        case 'mode_cascade': unlocked = gameMode === 'cascade' && score >= 2000; break;
        case 'mode_daily': unlocked = gameMode === 'daily' && gameState === 'gameOver'; break;
        case 'mode_puzzle': unlocked = gameMode === 'puzzle' && gameState === 'gameOver'; break;
        case 'all_themes': unlocked = themesUsed.size >= 8; break;
        case 'big_clear': unlocked = maxMatchSize >= 7; break;
        case 'mega_clear': unlocked = maxMatchSize >= 10; break;
        case 'full_board': unlocked = highestOccupiedRow(grid) >= 10 && pendingMatches.length > 0; break;
        case 'board_clear': unlocked = boardClearedThisGame; break;
        case 'total_clears_500': unlocked = save.totalClears + totalClears >= 500; break;
        case 'total_clears_2000': unlocked = save.totalClears + totalClears >= 2000; break;
        case 'total_clears_5000': unlocked = save.totalClears + totalClears >= 5000; break;
        case 'total_score_50k': unlocked = save.totalScore + score >= 50000; break;
        case 'total_score_200k': unlocked = save.totalScore + score >= 200000; break;
        case 'speed_clear': unlocked = speedClearCount >= 20; break;
        case 'no_powerup': unlocked = score >= 5000 && usedPowerUpsThisGame === 0; break;
        case 'match4': unlocked = maxMatchSize >= 4; break;
        case 'match5': unlocked = maxMatchSize >= 5; break;
        case 'match6': unlocked = maxMatchSize >= 6; break;
        case 'all_skins': unlocked = skinsUsed.size >= 8; break;
        case 'daily_streak_3': unlocked = (save as any).dailyStreak >= 3; break;
        case 'daily_streak_7': unlocked = (save as any).dailyStreak >= 7; break;
        case 'drops_100': unlocked = dropsThisGame >= 100; break;
        case 'drops_500': unlocked = dropsThisGame >= 500; break;
        case 'triple_powerup': unlocked = heldPowerUps.every(p => p !== null); break;
        case 'player_lvl_5': unlocked = (save.playerLevel || 0) >= 5; break;
        case 'player_lvl_10': unlocked = (save.playerLevel || 0) >= 10; break;
        case 'player_lvl_20': unlocked = (save.playerLevel || 0) >= 20; break;
        case 'hard_mode': unlocked = difficulty === 2 && score >= 3000; break;
        case 'board_clear_3': unlocked = (save.totalBoardClears || 0) >= 3; break;
        case 'use_shuffle': unlocked = (save as any)._usedShuffle === true; break;
        case 'use_freeze': unlocked = (save as any)._usedFreeze === true; break;
        case 'use_colclear': unlocked = (save as any)._usedColClear === true; break;
        case 'score_100000': unlocked = score >= 100000; break;
        case 'all_modes': {
          const modes = ['classic', 'endless', 'timeAttack', 'sprint', 'zen', 'survival', 'cascade', 'colorlimit', 'gravity', 'daily', 'puzzle'];
          unlocked = modes.every(m => (save.highScores[m] || 0) > 0);
          break;
        }
        case 'zen_10k': unlocked = gameMode === 'zen' && score >= 10000; break;
        case 'gravity_5k': unlocked = gameMode === 'gravity' && score >= 5000; break;
        case 'total_games_200': unlocked = save.totalGames >= 200; break;
        case 'colorlimit_3k': unlocked = gameMode === 'colorlimit' && score >= 3000; break;
        case 'survival_lvl20': unlocked = gameMode === 'survival' && level >= 20; break;
        case 'xp_10k': unlocked = (save.xp || 0) + xpForLevel(save.playerLevel || 0) * (save.playerLevel || 0) >= 10000; break;
        case 'perfect_sprint': unlocked = gameMode === 'sprint' && sprintClears >= SPRINT_TARGET && gameTimer < 60; break;
        // Round 7 achievements
        case 'combo_x20': unlocked = comboChain >= 20 || bestComboThisGame >= 20 || save.bestCombo >= 20; break;
        case 'score_200000': unlocked = score >= 200000; break;
        case 'total_clears_5000': unlocked = save.totalClears + totalClears >= 5000; break;
        case 'total_clears_10000': unlocked = save.totalClears + totalClears >= 10000; break;
        case 'daily_streak_7': unlocked = (save.dailyStreak || 0) >= 7; break;
        case 'daily_streak_30': unlocked = (save.dailyStreak || 0) >= 30; break;
        case 'total_score_500k': unlocked = save.totalScore + score >= 500000; break;
        case 'use_all_powerups': unlocked = !!(save as any)._usedRowBomb && !!(save as any)._usedColorBomb && !!(save as any)._usedWildOrb && !!(save as any)._usedShuffle && !!(save as any)._usedFreeze && !!(save as any)._usedColClear; break;
        case 'board_clear_10': unlocked = (save.totalBoardClears || 0) >= 10; break;
        case 'endless_50k': unlocked = gameMode === 'endless' && score >= 50000; break;
      }
      if (unlocked) {
        save.unlockedAch.push(ach.id);
        newlyUnlocked.push(ach);
      }
    }
    if (newlyUnlocked.length > 0) {
      writeSave(save);
      for (const ach of newlyUnlocked) {
        notifyQueue.push({ icon: ach.icon, title: 'ACHIEVEMENT', desc: ach.name });
      }
      audio.play('achievement');
    }
  }

  // ---- Notification System ----
  function showNextNotify() {
    if (notifyQueue.length === 0) { notifyShowing = false; hidePanel('notify'); return; }
    const n = notifyQueue.shift()!;
    const doc = getPanelDoc('notify');
    if (doc) {
      const ic = doc.getElementById('notify-icon');
      if (ic && (ic as any).text) (ic as any).text.value = n.icon;
      const ti = doc.getElementById('notify-title');
      if (ti && (ti as any).text) (ti as any).text.value = n.title;
      const de = doc.getElementById('notify-desc');
      if (de && (de as any).text) (de as any).text.value = n.desc;
    }
    showPanel('notify');
    notifyShowing = true;
    notifyTimer = NOTIFY_DURATION;
  }

  function updateNotify(dt: number) {
    if (!notifyShowing) {
      if (notifyQueue.length > 0) showNextNotify();
      return;
    }
    notifyTimer -= dt;
    if (notifyTimer <= 0) {
      hidePanel('notify');
      notifyShowing = false;
      if (notifyQueue.length > 0) showNextNotify();
    }
  }

  // ---- Power-Up System ----
  function grantPowerUp() {
    const emptySlot = heldPowerUps.indexOf(null);
    if (emptySlot < 0) return; // slots full
    const type = POWER_UPS[Math.floor(Math.random() * POWER_UPS.length)].type;
    heldPowerUps[emptySlot] = type;
    audio.play('powerup');
    notifyQueue.push({ icon: POWER_UPS.find(p => p.type === type)!.icon, title: 'POWER-UP', desc: POWER_UPS.find(p => p.type === type)!.name });
    updatePowerHUD();
  }

  function usePowerUp(slotIdx: number) {
    const type = heldPowerUps[slotIdx];
    if (!type) return;
    heldPowerUps[slotIdx] = null;
    usedPowerUpsThisGame++;
    save.totalPowerUps++;
    // Track specific power-up usage for achievements
    if (type === 'shuffle') (save as any)._usedShuffle = true;
    if (type === 'freezeTimer') (save as any)._usedFreeze = true;
    if (type === 'columnClear') (save as any)._usedColClear = true;
    if (type === 'rowBomb') (save as any)._usedRowBomb = true;
    if (type === 'colorBomb') (save as any)._usedColorBomb = true;
    if (type === 'wildOrb') (save as any)._usedWildOrb = true;
    writeSave(save);

    switch (type) {
      case 'rowBomb': {
        // Clear lowest occupied row
        for (let r = 0; r < ROWS; r++) {
          let hasOrb = false;
          for (let c = 0; c < COLS; c++) if (grid[r][c] !== 0) { hasOrb = true; break; }
          if (hasOrb) {
            for (let c = 0; c < COLS; c++) {
              if (grid[r][c] !== 0) {
                const pos = gridToWorld(r, c);
                spawnParticlesPooled(pos, new Color(ORB_COLORS[grid[r][c] - 1].hex), 4);
                grid[r][c] = 0;
                if (orbMeshes[r][c]) { scene.remove(orbMeshes[r][c]!); orbMeshes[r][c] = null; }
                totalClears++;
              }
            }
            applyGravity(grid, orbMeshes);
            audio.play('clear');
            break;
          }
        }
        break;
      }
      case 'colorBomb': {
        // Remove all orbs of a random color present on the board
        const colorsPresent = new Set<number>();
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (grid[r][c] !== 0) colorsPresent.add(grid[r][c]);
        if (colorsPresent.size > 0) {
          const arr = [...colorsPresent];
          const target = arr[Math.floor(Math.random() * arr.length)];
          for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
            if (grid[r][c] === target) {
              const pos = gridToWorld(r, c);
              spawnParticlesPooled(pos, new Color(ORB_COLORS[target - 1].hex), 4);
              grid[r][c] = 0;
              if (orbMeshes[r][c]) { scene.remove(orbMeshes[r][c]!); orbMeshes[r][c] = null; }
              totalClears++;
            }
          }
          applyGravity(grid, orbMeshes);
          audio.play('cascade');
        }
        break;
      }
      case 'wildOrb': {
        // Next orb matches the most common color on the board
        const counts: Record<number, number> = {};
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
          if (grid[r][c] !== 0) counts[grid[r][c]] = (counts[grid[r][c]] || 0) + 1;
        }
        let best = currentColor, bestCount = 0;
        for (const k in counts) if (counts[+k] > bestCount) { best = +k; bestCount = counts[+k]; }
        currentColor = best;
        removeActiveOrb();
        spawnActiveOrb(currentColor, selectedCol);
        audio.play('powerup');
        break;
      }
      case 'shuffle': {
        // Randomly rearrange all orbs on the board
        const allColors: number[] = [];
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
          if (grid[r][c] !== 0) allColors.push(grid[r][c]);
        }
        // Fisher-Yates shuffle
        for (let i = allColors.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [allColors[i], allColors[j]] = [allColors[j], allColors[i]];
        }
        let idx = 0;
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
          if (grid[r][c] !== 0) {
            grid[r][c] = allColors[idx++];
            if (orbMeshes[r][c]) {
              scene.remove(orbMeshes[r][c]!);
              orbMeshes[r][c] = createOrbMesh(grid[r][c]);
              orbMeshes[r][c]!.position.copy(gridToWorld(r, c));
              scene.add(orbMeshes[r][c]!);
            }
          }
        }
        audio.play('powerup');
        notifyQueue.push({ icon: '⟳', title: 'SHUFFLED', desc: 'Board rearranged!' });
        break;
      }
      case 'freezeTimer': {
        // Pause the drop timer for 10 seconds
        freezeTimerRemaining = 10;
        audio.play('powerup');
        notifyQueue.push({ icon: '❄', title: 'FROZEN', desc: '10s freeze active' });
        break;
      }
      case 'columnClear': {
        // Clear the entire selected column
        for (let r = 0; r < ROWS; r++) {
          if (grid[r][selectedCol] !== 0) {
            const pos = gridToWorld(r, selectedCol);
            spawnParticlesPooled(pos, new Color(ORB_COLORS[grid[r][selectedCol] - 1].hex), 4);
            grid[r][selectedCol] = 0;
            if (orbMeshes[r][selectedCol]) { scene.remove(orbMeshes[r][selectedCol]!); orbMeshes[r][selectedCol] = null; }
            totalClears++;
          }
        }
        applyGravity(grid, orbMeshes);
        audio.play('cascade');
        break;
      }
    }
    checkAchievements();
    updatePowerHUD();
    updateHUD();
  }

  function updatePowerHUD() {
    const doc = getPanelDoc('powerHud');
    if (!doc) return;
    for (let i = 0; i < 3; i++) {
      const el = doc.getElementById(`pw-${i}`);
      const iconEl = doc.getElementById(`pw-${i}-icon`);
      if (!el || !iconEl) continue;
      const pu = heldPowerUps[i];
      if (pu) {
        const def = POWER_UPS.find(p => p.type === pu)!;
        if ((iconEl as any).text) (iconEl as any).text.value = def.icon;
        try {
          (el as any).borderColor = { value: '#ff8800' };
          (el as any).backgroundColor = { value: 'rgba(255, 136, 0, 0.3)' };
        } catch { /* */ }
      } else {
        if ((iconEl as any).text) (iconEl as any).text.value = '·';
        try {
          (el as any).borderColor = { value: '#664400' };
          (el as any).backgroundColor = { value: 'rgba(255, 136, 0, 0.1)' };
        } catch { /* */ }
      }
    }
  }

  // ---- UI Panel Entities ----
  const panels: Record<string, { entity: any; doc: UIKitDocument | null }> = {};

  function createPanel(name: string, config: string, opts: {
    pos?: [number, number, number];
    maxW?: number; maxH?: number;
    follower?: { offset: [number, number, number]; behavior?: any; speed?: number; tolerance?: number };
    screenSpace?: { width?: string; height?: string; bottom?: string; right?: string; top?: string; left?: string };
  }) {
    const entity = world.createTransformEntity(undefined, { persistent: true });
    if (opts.pos) entity.object3D!.position.set(...opts.pos);
    entity.addComponent(PanelUI, { config, maxWidth: opts.maxW ?? 1, maxHeight: opts.maxH ?? 1 });
    if (opts.follower) {
      entity.addComponent(Follower, {
        target: (world as any).player?.head,
        offsetPosition: opts.follower.offset,
        behavior: opts.follower.behavior ?? FollowBehavior.PivotY,
        speed: opts.follower.speed ?? 5,
        tolerance: opts.follower.tolerance ?? 0.3,
      });
    }
    if (opts.screenSpace) {
      entity.addComponent(ScreenSpace, { ...opts.screenSpace, zOffset: 0.25 });
    }
    entity.object3D!.visible = false;
    panels[name] = { entity, doc: null };
  }

  // Create all 13 panels
  createPanel('mainMenu', '/ui/main-menu.json', { pos: [0, 1.5, -2], maxW: 0.9, maxH: 1.4 });
  createPanel('modeSelect', '/ui/mode-select.json', { pos: [0, 1.5, -2], maxW: 0.9, maxH: 1.5 });
  createPanel('gameOver', '/ui/game-over.json', { pos: [0, 1.5, -2], maxW: 0.8, maxH: 1.2 });
  createPanel('pauseMenu', '/ui/pause-menu.json', { pos: [0, 1.5, -2], maxW: 0.7, maxH: 0.9 });
  createPanel('settings', '/ui/settings.json', { pos: [0, 1.5, -2], maxW: 0.9, maxH: 1.2 });
  createPanel('help', '/ui/help.json', { pos: [0, 1.5, -2], maxW: 0.9, maxH: 1.4 });
  createPanel('achievements', '/ui/achievements.json', { pos: [0, 1.5, -2], maxW: 0.9, maxH: 1.5 });
  createPanel('stats', '/ui/stats.json', { pos: [0, 1.5, -2], maxW: 0.9, maxH: 1.5 });
  createPanel('skins', '/ui/skins.json', { pos: [0, 1.5, -2], maxW: 0.8, maxH: 1.4 });
  createPanel('hud', '/ui/hud.json', {
    maxW: 0.45, maxH: 0.12,
    follower: { offset: [0, 0.2, -0.6], behavior: FollowBehavior.PivotY, speed: 5, tolerance: 0.3 },
  });
  createPanel('nextOrb', '/ui/next-orb.json', {
    maxW: 0.15, maxH: 0.2,
    screenSpace: { width: '120px', height: 'auto', top: '20px', right: '20px' },
  });
  createPanel('powerHud', '/ui/power-hud.json', {
    maxW: 0.2, maxH: 0.1,
    screenSpace: { width: '140px', height: 'auto', top: '140px', right: '20px' },
  });
  createPanel('notify', '/ui/notify.json', {
    maxW: 0.35, maxH: 0.12,
    follower: { offset: [0, -0.1, -0.5], behavior: FollowBehavior.PivotY, speed: 8, tolerance: 0.2 },
  });
  createPanel('tutorial', '/ui/tutorial.json', { pos: [0, 1.5, -2], maxW: 0.85, maxH: 1.3 });

  function getPanelDoc(name: string): UIKitDocument | null {
    const p = panels[name];
    if (!p) return null;
    if (p.doc) return p.doc;
    try {
      const d = p.entity.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
      if (d) { p.doc = d; return d; }
    } catch { /* not ready */ }
    return null;
  }

  function showPanel(name: string) { if (panels[name]) panels[name].entity.object3D!.visible = true; }
  function hidePanel(name: string) { if (panels[name]) panels[name].entity.object3D!.visible = false; }
  function hideAllPanels() { for (const k of Object.keys(panels)) hidePanel(k); }

  // ---- UI Event Binding ----
  let uiBindingsReady = false;

  function tryBindUI(): boolean {
    // Main Menu
    const mm = getPanelDoc('mainMenu');
    if (!mm) return false;
    const btnStart = mm.getElementById('btn-start');
    if (!btnStart) return false;

    btnStart.addEventListener('click', () => { audio.play('select'); startGame(); });
    mm.getElementById('btn-modes')?.addEventListener('click', () => { audio.play('select'); switchState('modeSelect'); });
    mm.getElementById('btn-settings')?.addEventListener('click', () => { audio.play('select'); switchState('settings'); });
    mm.getElementById('btn-help')?.addEventListener('click', () => { audio.play('select'); switchState('help'); });
    mm.getElementById('btn-achievements')?.addEventListener('click', () => { audio.play('select'); achPage = 0; switchState('achievements'); });
    mm.getElementById('btn-stats')?.addEventListener('click', () => { audio.play('select'); switchState('stats'); });
    mm.getElementById('btn-skins')?.addEventListener('click', () => { audio.play('select'); switchState('skins'); });

    // Mode Select
    const ms = getPanelDoc('modeSelect');
    if (ms) {
      for (const m of ['classic', 'endless', 'timeattack', 'sprint', 'zen', 'survival', 'cascade', 'colorlimit', 'gravity', 'daily', 'puzzle'] as const) {
        const btn = ms.getElementById(`mode-${m}`);
        btn?.addEventListener('click', () => {
          audio.play('select');
          gameMode = (m === 'timeattack' ? 'timeAttack' : m) as GameMode;
          updateModeSelectUI();
        });
      }
      ms.getElementById('mode-back')?.addEventListener('click', () => { audio.play('select'); switchState('title'); });
    }

    // Game Over
    const go = getPanelDoc('gameOver');
    if (go) {
      go.getElementById('go-retry')?.addEventListener('click', () => { audio.play('select'); startGame(); });
      go.getElementById('go-menu')?.addEventListener('click', () => { audio.play('select'); switchState('title'); });
    }

    // Pause
    const pm = getPanelDoc('pauseMenu');
    if (pm) {
      pm.getElementById('pause-resume')?.addEventListener('click', () => { audio.play('select'); switchState('playing'); });
      pm.getElementById('pause-restart')?.addEventListener('click', () => { audio.play('select'); startGame(); });
      pm.getElementById('pause-quit')?.addEventListener('click', () => { audio.play('select'); switchState('title'); });
    }

    // Settings
    const st = getPanelDoc('settings');
    if (st) {
      st.getElementById('sfx-down')?.addEventListener('click', () => {
        audio.sfxVol = Math.max(0, audio.sfxVol - 0.1); save.settings.sfxVol = audio.sfxVol;
        writeSave(save); updateSettingsUI(); audio.play('select');
      });
      st.getElementById('sfx-up')?.addEventListener('click', () => {
        audio.sfxVol = Math.min(1, audio.sfxVol + 0.1); save.settings.sfxVol = audio.sfxVol;
        writeSave(save); updateSettingsUI(); audio.play('select');
      });
      st.getElementById('mus-down')?.addEventListener('click', () => {
        audio.musVol = Math.max(0, audio.musVol - 0.1); save.settings.musVol = audio.musVol;
        writeSave(save); updateSettingsUI(); audio.updateMusicVol();
      });
      st.getElementById('mus-up')?.addEventListener('click', () => {
        audio.musVol = Math.min(1, audio.musVol + 0.1); save.settings.musVol = audio.musVol;
        writeSave(save); updateSettingsUI(); audio.updateMusicVol();
      });
      for (let i = 0; i < THEMES.length; i++) {
        st.getElementById(`theme-${i}`)?.addEventListener('click', () => {
          themeIdx = i; save.settings.themeIdx = i; writeSave(save);
          themesUsed.add(i);
          applyTheme(); updateSettingsUI(); audio.play('select');
          checkAchievements();
        });
      }
      st.getElementById('settings-back')?.addEventListener('click', () => { audio.play('select'); switchState('title'); });
      st.getElementById('diff-down')?.addEventListener('click', () => {
        difficulty = Math.max(0, difficulty - 1);
        save.settings.difficulty = difficulty;
        writeSave(save); updateSettingsUI(); audio.play('select');
      });
      st.getElementById('diff-up')?.addEventListener('click', () => {
        difficulty = Math.min(DIFFICULTIES.length - 1, difficulty + 1);
        save.settings.difficulty = difficulty;
        writeSave(save); updateSettingsUI(); audio.play('select');
      });
    }

    // Help
    const hp = getPanelDoc('help');
    if (hp) {
      hp.getElementById('help-back')?.addEventListener('click', () => { audio.play('select'); switchState('title'); });
    }

    // Achievements
    const ach = getPanelDoc('achievements');
    if (ach) {
      ach.getElementById('ach-prev')?.addEventListener('click', () => {
        audio.play('select'); achPage = Math.max(0, achPage - 1); updateAchievementsUI();
      });
      ach.getElementById('ach-next')?.addEventListener('click', () => {
        const maxPage = Math.max(0, Math.ceil(ACHIEVEMENT_DEFS.length / ACH_PER_PAGE) - 1);
        audio.play('select'); achPage = Math.min(maxPage, achPage + 1); updateAchievementsUI();
      });
      ach.getElementById('ach-back')?.addEventListener('click', () => { audio.play('select'); switchState('title'); });
    }

    // Stats
    const stDoc = getPanelDoc('stats');
    if (stDoc) {
      stDoc.getElementById('stats-back')?.addEventListener('click', () => { audio.play('select'); switchState('title'); });
    }

    // Skins
    const sk = getPanelDoc('skins');
    if (sk) {
      for (let i = 0; i < SKIN_DEFS.length; i++) {
        sk.getElementById(`skin-${i}`)?.addEventListener('click', () => {
          audio.play('select'); skinIdx = i; save.skinIdx = i; skinsUsed.add(i); writeSave(save); updateSkinsUI();
        });
      }
      sk.getElementById('skins-back')?.addEventListener('click', () => { audio.play('select'); switchState('title'); });
    }

    // Power-up HUD (click to use)
    const pwDoc = getPanelDoc('powerHud');
    if (pwDoc) {
      for (let i = 0; i < 3; i++) {
        pwDoc.getElementById(`pw-${i}`)?.addEventListener('click', () => {
          if (gameState === 'playing' && playPhase === 'selecting') {
            usePowerUp(i);
          }
        });
      }
    }

    // Tutorial
    const tutDoc = getPanelDoc('tutorial');
    if (tutDoc) {
      tutDoc.getElementById('tut-ok')?.addEventListener('click', () => {
        audio.play('select');
        tutorialShown = true;
        // Proceed to actually start the game
        startGame();
      });
    }

    return true;
  }

  // ---- UI Update Functions ----
  function updateHUD() {
    const doc = getPanelDoc('hud');
    if (!doc) return;
    const setText = (id: string, v: string) => { const el = doc.getElementById(id); if (el && (el as any).text) (el as any).text.value = v; };
    setText('hud-score', `${score}`);
    setText('hud-level', `${level}`);
    setText('hud-combo', comboChain > 1 ? `x${comboChain}` : 'x1');
    setText('hud-clears', `${totalClears}`);
  }

  function updateNextOrb() {
    const doc = getPanelDoc('nextOrb');
    if (!doc) return;
    const el = doc.getElementById('next-color');
    if (el) {
      try {
        (el as any).backgroundColor = { value: ORB_COLORS[nextColor - 1].hex };
        (el as any).borderColor = { value: ORB_COLORS[nextColor - 1].em };
      } catch { /* */ }
    }
    const tl = doc.getElementById('timer-label');
    const tv = doc.getElementById('timer-value');
    if (gameMode === 'timeAttack' && tl && tv) {
      if ((tl as any).text) (tl as any).text.value = 'TIME';
      const remaining = Math.max(0, TIME_ATTACK_SECS - gameTimer);
      if ((tv as any).text) (tv as any).text.value = `${Math.ceil(remaining)}s`;
    } else if (gameMode === 'sprint' && tl && tv) {
      if ((tl as any).text) (tl as any).text.value = 'LEFT';
      if ((tv as any).text) (tv as any).text.value = `${Math.max(0, SPRINT_TARGET - sprintClears)}`;
    } else if (gameMode === 'survival' && tl && tv) {
      if ((tl as any).text) (tl as any).text.value = 'SPD';
      if ((tv as any).text) (tv as any).text.value = `${getDropDelay().toFixed(1)}s`;
    } else if (tl && tv) {
      if ((tl as any).text) (tl as any).text.value = '';
      if ((tv as any).text) (tv as any).text.value = '';
    }
  }

  function updateMainMenuUI() {
    const doc = getPanelDoc('mainMenu');
    if (!doc) return;
    const hs = doc.getElementById('menu-highscore');
    if (hs && (hs as any).text) (hs as any).text.value = `${save.highScores[gameMode] || 0}`;
    // Player level info
    const ptEl = doc.getElementById('menu-player-title');
    if (ptEl && (ptEl as any).text) (ptEl as any).text.value = getPlayerTitle(save.playerLevel || 0);
    const plEl = doc.getElementById('menu-player-level');
    if (plEl && (plEl as any).text) (plEl as any).text.value = `Level ${save.playerLevel || 0}`;
    // XP bar
    const xpFill = doc.getElementById('menu-xp-fill');
    if (xpFill) {
      const needed = xpForLevel((save.playerLevel || 0) + 1);
      const pct = needed > 0 ? Math.min(100, Math.floor(((save.xp || 0) / needed) * 100)) : 0;
      try { (xpFill as any).width = { value: `${pct}%` }; } catch { /* */ }
    }
  }

  function updateModeSelectUI() {
    const doc = getPanelDoc('modeSelect');
    if (!doc) return;
    for (const m of ['classic', 'endless', 'timeattack', 'sprint', 'zen', 'survival', 'cascade', 'colorlimit', 'gravity', 'daily', 'puzzle']) {
      const modeKey = m === 'timeattack' ? 'timeAttack' : m;
      const el = doc.getElementById(`mode-${m}`);
      if (el) {
        const isActive = modeKey === gameMode;
        try {
          (el as any).borderColor = { value: isActive ? '#00ffff' : '#00aaaa' };
          (el as any).borderWidth = { value: isActive ? 0.1 : 0.06 };
          (el as any).backgroundColor = { value: isActive ? 'rgba(0, 255, 255, 0.2)' : 'rgba(0, 255, 255, 0.08)' };
        } catch { /* */ }
      }
    }
  }

  function updateGameOverUI() {
    const doc = getPanelDoc('gameOver');
    if (!doc) return;
    const setText = (id: string, text: string) => {
      const el = doc.getElementById(id);
      if (el && (el as any).text) (el as any).text.value = text;
    };
    setText('go-score', `${score}`);
    setText('go-mode', MODE_NAMES[gameMode]);
    setText('go-diff', DIFFICULTIES[difficulty]?.name ?? 'Normal');
    setText('go-level', `${level}`);
    setText('go-clears', `${totalClears}`);
    setText('go-combo', `x${bestComboThisGame}`);
    setText('go-cascades', `${totalCascades}`);
    setText('go-powerups', `${usedPowerUpsThisGame}`);
    // Time played
    const secs = Math.floor(gameTimer);
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    setText('go-time', `${mins}:${rem < 10 ? '0' : ''}${rem}`);
    setText('go-xp', `+${lastXpGained}`);
    setText('go-plevel', `Lv.${save.playerLevel} ${getPlayerTitle(save.playerLevel)}`);
    const prev = save.highScores[gameMode] || 0;
    const isNewBest = score > prev;
    const nb = doc.getElementById('go-newbest');
    if (nb) {
      try { (nb as any).display = { value: isNewBest ? 'flex' : 'none' }; } catch { /* */ }
    }
  }

  function updateSettingsUI() {
    const doc = getPanelDoc('settings');
    if (!doc) return;
    const sfxEl = doc.getElementById('sfx-val');
    if (sfxEl && (sfxEl as any).text) (sfxEl as any).text.value = `${Math.round(audio.sfxVol * 100)}%`;
    const musEl = doc.getElementById('mus-val');
    if (musEl && (musEl as any).text) (musEl as any).text.value = `${Math.round(audio.musVol * 100)}%`;
    const tn = doc.getElementById('theme-name');
    if (tn && (tn as any).text) (tn as any).text.value = THEMES[themeIdx].name;
    const diffEl = doc.getElementById('diff-val');
    if (diffEl && (diffEl as any).text) (diffEl as any).text.value = DIFFICULTIES[difficulty]?.name ?? 'Normal';
  }

  function updateAchievementsUI() {
    const doc = getPanelDoc('achievements');
    if (!doc) return;
    const totalPages = Math.max(1, Math.ceil(ACHIEVEMENT_DEFS.length / ACH_PER_PAGE));
    const unlocked = save.unlockedAch;
    const setText = (id: string, v: string) => { const el = doc.getElementById(id); if (el && (el as any).text) (el as any).text.value = v; };
    setText('ach-progress', `${unlocked.length} / ${ACHIEVEMENT_DEFS.length} Unlocked`);
    setText('ach-page-label', `${achPage + 1} / ${totalPages}`);

    const start = achPage * ACH_PER_PAGE;
    for (let i = 0; i < ACH_PER_PAGE; i++) {
      const idx = start + i;
      const el = doc.getElementById(`ach-${i}`);
      const nameEl = doc.getElementById(`ach-${i}-name`);
      const descEl = doc.getElementById(`ach-${i}-desc`);
      if (!el) continue;

      if (idx < ACHIEVEMENT_DEFS.length) {
        const ach = ACHIEVEMENT_DEFS[idx];
        const isUnlocked = unlocked.includes(ach.id);
        setText(`ach-${i}-name`, isUnlocked ? ach.name : '???');
        setText(`ach-${i}-desc`, isUnlocked ? ach.desc : 'Keep playing to unlock');
        try {
          (el as any).borderColor = { value: isUnlocked ? '#ff8800' : '#553300' };
          (el as any).backgroundColor = { value: isUnlocked ? 'rgba(255, 136, 0, 0.15)' : 'rgba(255, 136, 0, 0.08)' };
        } catch { /* */ }
      } else {
        setText(`ach-${i}-name`, '');
        setText(`ach-${i}-desc`, '');
        try { (el as any).backgroundColor = { value: 'transparent' }; (el as any).borderColor = { value: 'transparent' }; } catch { /* */ }
      }
    }
  }

  function updateStatsUI() {
    const doc = getPanelDoc('stats');
    if (!doc) return;
    const setText = (id: string, v: string) => { const el = doc.getElementById(id); if (el && (el as any).text) (el as any).text.value = v; };
    setText('st-games', `${save.totalGames}`);
    setText('st-total-score', `${save.totalScore}`);
    setText('st-clears', `${save.totalClears}`);
    setText('st-drops', `${save.totalDrops}`);
    setText('st-cascades', `${save.totalCascades}`);
    setText('st-combo', `x${save.bestCombo}`);
    setText('st-powerups', `${save.totalPowerUps}`);
    setText('st-level', `${save.bestLevel}`);
    // High scores per mode
    setText('st-hs-classic', `${save.highScores['classic'] || 0}`);
    setText('st-hs-endless', `${save.highScores['endless'] || 0}`);
    setText('st-hs-timeattack', `${save.highScores['timeAttack'] || 0}`);
    setText('st-hs-sprint', `${save.highScores['sprint'] || 0}`);
    setText('st-hs-survival', `${save.highScores['survival'] || 0}`);
    setText('st-hs-cascade', `${save.highScores['cascade'] || 0}`);
    setText('st-hs-daily', `${save.highScores['daily'] || 0}`);
    setText('st-hs-puzzle', `${save.highScores['puzzle'] || 0}`);
  }

  function updateSkinsUI() {
    const doc = getPanelDoc('skins');
    if (!doc) return;
    for (let i = 0; i < SKIN_DEFS.length; i++) {
      const el = doc.getElementById(`skin-${i}`);
      if (!el) continue;
      const isActive = i === skinIdx;
      try {
        (el as any).borderColor = { value: isActive ? '#aa00ff' : '#550088' };
        (el as any).borderWidth = { value: isActive ? 0.1 : 0.06 };
        (el as any).backgroundColor = { value: isActive ? 'rgba(170, 0, 255, 0.2)' : 'rgba(170, 0, 255, 0.06)' };
      } catch { /* */ }
    }
  }

  // ---- Theme ----
  function applyTheme() {
    const t = THEMES[themeIdx];
    scene.fog = new Fog(t.fog, 0.5, 25);
    ambLight.color.set(t.amb);
    gridColor.set(t.grid);
    selectorMat.color.set(t.grid);
    // Rebuild holodeck
    scene.remove(holodeckGrp);
    holodeckGrp = makeHolodeck();
    scene.add(holodeckGrp);
    buildGridFrame();
  }

  // ---- State Machine ----
  function switchState(state: GameState) {
    gameState = state;
    hideAllPanels();
    gridFrameGrp.visible = false;
    selectorMesh.visible = false;
    removeActiveOrb();
    const showGrid = state === 'playing' || state === 'paused' || state === 'gameOver';
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (orbMeshes[r][c]) orbMeshes[r][c]!.visible = showGrid;
    }

    switch (state) {
      case 'title':
        showPanel('mainMenu');
        updateMainMenuUI();
        break;
      case 'modeSelect':
        showPanel('modeSelect');
        updateModeSelectUI();
        break;
      case 'playing':
        gridFrameGrp.visible = true;
        selectorMesh.visible = true;
        showPanel('hud');
        showPanel('nextOrb');
        showPanel('powerHud');
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
          if (orbMeshes[r][c]) orbMeshes[r][c]!.visible = true;
        }
        if (activeOrb) activeOrb.visible = true;
        break;
      case 'paused':
        gridFrameGrp.visible = true;
        showPanel('pauseMenu');
        showPanel('hud');
        break;
      case 'gameOver':
        gridFrameGrp.visible = true;
        showPanel('gameOver');
        updateGameOverUI();
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
          if (orbMeshes[r][c]) orbMeshes[r][c]!.visible = true;
        }
        break;
      case 'settings':
        showPanel('settings');
        updateSettingsUI();
        break;
      case 'help':
        showPanel('help');
        break;
      case 'achievements':
        showPanel('achievements');
        updateAchievementsUI();
        break;
      case 'stats':
        showPanel('stats');
        updateStatsUI();
        break;
      case 'skins':
        showPanel('skins');
        updateSkinsUI();
        break;
      case 'tutorial':
        showPanel('tutorial');
        break;
    }
    // Always show notify if active
    if (notifyShowing) showPanel('notify');
  }

  function startGame() {
    // Show tutorial on very first game
    if (save.totalGames === 0 && !tutorialShown) {
      tutorialShown = true;
      switchState('tutorial');
      return;
    }
    clearAllOrbs();
    grid = makeGrid();
    orbMeshes = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    score = 0; level = 1; comboChain = 0; totalClears = 0; totalCascades = 0;
    bestComboThisGame = 0; dropsThisGame = 0; gameTimer = 0; sprintClears = 0;
    usedPowerUpsThisGame = 0; maxMatchSize = 0;
    speedClearCount = 0; speedClearTimer = 0; boardClearedThisGame = false;
    freezeTimerRemaining = 0;
    heldPowerUps = [null, null, null];
    powerUpChargeCombo = 0;
    selectedCol = Math.floor(COLS / 2);
    // Set up seeded RNG for daily/puzzle
    if (gameMode === 'daily') {
      dailyRng = mulberry32(getDailySeed());
    } else if (gameMode === 'puzzle') {
      dailyRng = mulberry32(PUZZLE_SEED_BASE + puzzleLevel);
    } else {
      dailyRng = null;
    }
    currentColor = randomColor();
    nextColor = randomColor();
    playPhase = 'countdown';
    countdownTimer = COUNTDOWN_TIME;
    dropTimer = 0;
    themesUsed.add(themeIdx);
    skinsUsed.add(skinIdx);
    audio.startMusic();
    save.totalGames++;
    writeSave(save);
    switchState('playing');
    spawnActiveOrb(currentColor, selectedCol);
    updatePowerHUD();
  }

  function endGame() {
    audio.play('gameover');
    const prev = save.highScores[gameMode] || 0;
    if (score > prev) save.highScores[gameMode] = score;
    save.totalClears += totalClears;
    save.totalCascades += totalCascades;
    save.totalScore += score;
    save.totalDrops += dropsThisGame;
    if (bestComboThisGame > save.bestCombo) save.bestCombo = bestComboThisGame;
    if (level > save.bestLevel) save.bestLevel = level;
    if (boardClearedThisGame) save.totalBoardClears = (save.totalBoardClears || 0) + 1;

    // XP calculation
    let xpGained = XP_PER_GAME;
    xpGained += totalClears * XP_PER_CLEAR;
    xpGained += (level - 1) * XP_PER_LEVEL;
    xpGained += (bestComboThisGame > 1 ? (bestComboThisGame - 1) * XP_PER_COMBO : 0);
    if (boardClearedThisGame) xpGained += XP_PER_BOARD_CLEAR;
    // Difficulty bonus
    xpGained = Math.floor(xpGained * (DIFFICULTIES[difficulty]?.scoreMult ?? 1.0));
    lastXpGained = xpGained;

    save.xp = (save.xp || 0) + xpGained;

    // Level up check
    let leveled = false;
    while (save.xp >= xpForLevel(save.playerLevel + 1)) {
      save.xp -= xpForLevel(save.playerLevel + 1);
      save.playerLevel++;
      leveled = true;
    }
    if (leveled) {
      notifyQueue.push({ icon: '⬆', title: 'LEVEL UP', desc: `${getPlayerTitle(save.playerLevel)} (Lv.${save.playerLevel})` });
      audio.play('levelup');
    }

    // Daily streak tracking
    if (gameMode === 'daily') {
      const today = new Date().toISOString().slice(0, 10);
      const lastDate = save.lastDailyDate || '';
      if (lastDate !== today) {
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        if (lastDate === yesterday) {
          save.dailyStreak = (save.dailyStreak || 0) + 1;
        } else {
          save.dailyStreak = 1;
        }
        save.lastDailyDate = today;
      }
    }

    writeSave(save);
    checkAchievements();
    switchState('gameOver');
  }

  function dropOrb() {
    const targetRow = lowestEmptyRow(grid, selectedCol);
    if (targetRow < 0) return;
    audio.play('drop');
    playPhase = 'dropping';
    dropTargetRow = targetRow;
    dropStartY = activeOrb ? activeOrb.position.y : gridToWorld(ROWS, selectedCol).y + CELL * 0.5;
    dropProgress = 0;
    dropsThisGame++;
  }

  function instantDrop() {
    const targetRow = lowestEmptyRow(grid, selectedCol);
    if (targetRow < 0) return;
    audio.play('drop');
    dropsThisGame++;
    placeOrb(targetRow, selectedCol, currentColor);
    triggerLandingFlash(targetRow, selectedCol, currentColor);
    if (orbMeshes[targetRow][selectedCol]) triggerSquish(orbMeshes[targetRow][selectedCol]!);
    removeActiveOrb();
    processAfterPlace();
  }

  function placeOrb(row: number, col: number, color: number) {
    grid[row][col] = color;
    const mesh = createOrbMesh(color);
    mesh.position.copy(gridToWorld(row, col));
    scene.add(mesh);
    orbMeshes[row][col] = mesh;
  }

  function processAfterPlace() {
    comboChain = 0;
    powerUpChargeCombo = 0;
    checkAndClear();
  }

  function checkAndClear() {
    const matchResult = findMatches(grid);
    pendingMatches = matchResult.cells;
    if (pendingMatches.length > 0) {
      comboChain++;
      powerUpChargeCombo++;
      if (comboChain > bestComboThisGame) bestComboThisGame = comboChain;
      if (matchResult.maxGroupSize > maxMatchSize) maxMatchSize = matchResult.maxGroupSize;
      if (pendingMatches.length > maxMatchSize) maxMatchSize = pendingMatches.length;
      const pts = calcScore(pendingMatches.length, comboChain);
      score += pts;
      totalClears += pendingMatches.length;
      sprintClears += pendingMatches.length;
      speedClearCount += pendingMatches.length;

      if (comboChain > 1) { audio.play('cascade'); totalCascades++; }
      else { audio.play('clear'); }
      if (comboChain >= 3) audio.play('combo');

      // Trigger combo flash effect for chain ≥ 2
      if (comboChain >= 2 && pendingMatches.length > 0) {
        const flashColorIdx = grid[pendingMatches[0][0]][pendingMatches[0][1]];
        if (flashColorIdx > 0) {
          triggerComboFlash(comboChain, new Color(ORB_COLORS[flashColorIdx - 1].hex));
        }
        triggerBorderGlow(comboChain);
        triggerScreenShake(comboChain * 0.004);
      }

      // Grant power-up on combo threshold
      if (powerUpChargeCombo >= POWERUP_COMBO_THRESHOLD) {
        grantPowerUp();
        powerUpChargeCombo = 0;
      }

      for (const [r, c] of pendingMatches) {
        const colorIdx = grid[r][c];
        startClearAnim(r, c, colorIdx);
        const pos = gridToWorld(r, c);
        spawnParticlesPooled(pos, new Color(ORB_COLORS[colorIdx - 1].hex), 6);
      }
      // Score burst effect at the center of the match
      if (pendingMatches.length > 0) {
        const centerR = pendingMatches[Math.floor(pendingMatches.length / 2)];
        const centerPos = gridToWorld(centerR[0], centerR[1]);
        spawnScoreEffect(centerPos, pts, new Color(ORB_COLORS[(grid[centerR[0]][centerR[1]] || 1) - 1]?.hex || '#ffffff'));
      }

      playPhase = 'clearing';
      clearTimer = 0;

      const newLevel = Math.floor(totalClears / CLEARS_PER_LVL) + 1;
      if (newLevel > level) { level = newLevel; audio.play('levelup'); }

      checkAchievements();
    } else {
      comboChain = 0;
      powerUpChargeCombo = 0;
      // Check for board clear
      let boardEmpty = true;
      for (let r = 0; r < ROWS && boardEmpty; r++) {
        for (let c = 0; c < COLS; c++) {
          if (grid[r][c] !== 0) { boardEmpty = false; break; }
        }
      }
      if (boardEmpty && totalClears > 0) {
        boardClearedThisGame = true;
        score += 1000; // Board clear bonus
        notifyQueue.push({ icon: '✦', title: 'BOARD CLEAR', desc: '+1,000 BONUS' });
        audio.play('levelup');
        checkAchievements();
      }
      if (isGameOver()) { endGame(); return; }
      playPhase = 'nextOrb';
      nextOrbTimer = 0;
    }
    updateHUD();
  }

  function finishClear() {
    for (const [r, c] of pendingMatches) {
      grid[r][c] = 0;
      if (orbMeshes[r][c]) { scene.remove(orbMeshes[r][c]!); orbMeshes[r][c] = null; }
    }
    const didFall = applyGravity(grid, orbMeshes);
    if (didFall) { playPhase = 'cascading'; cascadeTimer = 0; }
    else { checkAndClear(); }
  }

  function isGameOver(): boolean {
    if (gameMode === 'zen') return false;
    if (gameMode === 'timeAttack' && gameTimer >= TIME_ATTACK_SECS) return true;
    if (gameMode === 'sprint' && sprintClears >= SPRINT_TARGET) return true;
    for (let c = 0; c < COLS; c++) {
      if (lowestEmptyRow(grid, c) < 0) return true;
    }
    return false;
  }

  function prepareNextOrb() {
    currentColor = nextColor;
    nextColor = randomColor();
    dropTimer = 0;
    playPhase = 'selecting';
    if (lowestEmptyRow(grid, selectedCol) < 0) {
      for (let c = 0; c < COLS; c++) {
        if (lowestEmptyRow(grid, c) >= 0) { selectedCol = c; break; }
      }
    }
    spawnActiveOrb(currentColor, selectedCol);
    updateSelectorCol(selectedCol);
    updateNextOrb();
    updateHUD();
  }

  // ---- Input Handling ----
  function handleInput(dt: number) {
    const kb = (world as any).input?.keyboard;
    const rightGP = (world as any).input?.xr?.gamepads?.right;

    // Pause
    if (gameState === 'playing' && playPhase !== 'countdown') {
      if (kb?.getKeyDown?.('Escape') || kb?.getKeyDown?.('KeyP') || rightGP?.getButtonDown?.(InputComponent.B_Button)) {
        audio.play('select'); switchState('paused'); return;
      }
    }
    if (gameState === 'paused') {
      if (kb?.getKeyDown?.('Escape') || kb?.getKeyDown?.('KeyP') || rightGP?.getButtonDown?.(InputComponent.B_Button)) {
        audio.play('select'); switchState('playing'); return;
      }
    }

    if (gameState !== 'playing' || playPhase !== 'selecting') return;

    // Column movement
    let moved = false;
    if (kb?.getKeyDown?.('ArrowLeft') || kb?.getKeyDown?.('KeyA')) {
      if (selectedCol > 0) { selectedCol--; moved = true; }
    }
    if (kb?.getKeyDown?.('ArrowRight') || kb?.getKeyDown?.('KeyD')) {
      if (selectedCol < COLS - 1) { selectedCol++; moved = true; }
    }

    // Thumbstick
    thumbstickCooldown -= dt;
    if (rightGP) {
      const axes = rightGP.getAxesValues?.(InputComponent.Thumbstick);
      if (axes && thumbstickCooldown <= 0) {
        if (axes.x < -0.5 && selectedCol > 0) { selectedCol--; moved = true; thumbstickCooldown = 0.2; }
        if (axes.x > 0.5 && selectedCol < COLS - 1) { selectedCol++; moved = true; thumbstickCooldown = 0.2; }
      }
      if (axes && Math.abs(axes.x) < 0.3) thumbstickCooldown = 0;
    }

    if (moved) {
      audio.play('move');
      moveActiveOrbToCol(selectedCol);
      updateSelectorCol(selectedCol);
      columnPulseTime = 0;
    }
    // Column highlight pulse
    columnPulseTime += dt;
    const pulse = 0.08 + Math.sin(columnPulseTime * 4) * 0.04;
    selectorMat.opacity = pulse;

    // Drop
    if (kb?.getKeyDown?.('ArrowDown')) dropOrb();
    if (kb?.getKeyDown?.('Space')) instantDrop();
    if (rightGP?.getButtonDown?.(InputComponent.Trigger)) dropOrb();
    if (rightGP?.getButtonDown?.(InputComponent.A_Button)) instantDrop();

    // Power-up hotkeys (1, 2, 3)
    if (kb?.getKeyDown?.('Digit1')) usePowerUp(0);
    if (kb?.getKeyDown?.('Digit2')) usePowerUp(1);
    if (kb?.getKeyDown?.('Digit3')) usePowerUp(2);

    // XR squeeze to use first available power-up
    if (rightGP?.getButtonDown?.(InputComponent.Squeeze)) {
      for (let i = 0; i < 3; i++) { if (heldPowerUps[i]) { usePowerUp(i); break; } }
    }
  }

  // ---- Update Loop ----
  function update(dt: number) {
    dt = Math.min(dt, 0.05);

    if (!uiBindingsReady) uiBindingsReady = tryBindUI();

    updateParticlesPooled(dt);
    updateNotify(dt);
    updateComboFlash(dt);
    updateLandingFlash(dt);
    updateBorderGlow(dt);
    updateScreenShake(dt);
    updateSquishAnims(dt);

    if (gameState === 'playing') {
      handleInput(dt);

      switch (playPhase) {
        case 'countdown': {
          countdownTimer -= dt;
          if (countdownTimer <= 0) { playPhase = 'selecting'; prepareNextOrb(); }
          else if (activeOrb) {
            const flash = Math.sin(countdownTimer * 10) * 0.3 + 0.7;
            activeOrb.scale.setScalar(flash);
          }
          break;
        }
        case 'selecting': {
          if (freezeTimerRemaining > 0) {
            freezeTimerRemaining -= dt;
          } else {
            dropTimer += dt;
          }
          speedClearTimer += dt;
          if (speedClearTimer >= 30) { speedClearCount = 0; speedClearTimer = 0; }
          if (dropTimer >= getDropDelay()) dropOrb();
          if (activeOrb) {
            const bobY = Math.sin(performance.now() / 300) * 0.005;
            const basePos = gridToWorld(ROWS, selectedCol);
            activeOrb.position.y = basePos.y + CELL * 0.5 + bobY;
            // Skin-specific rotation for crystal/ice
            if (SKIN_DEFS[skinIdx].geoType !== 'sphere') {
              activeOrb.rotation.y += dt * 1.5;
              activeOrb.rotation.x += dt * 0.7;
            }
          }
          if (ghostOrb && SKIN_DEFS[skinIdx].geoType !== 'sphere') {
            ghostOrb.rotation.y += dt * 0.8;
            ghostOrb.rotation.x += dt * 0.4;
          }
          // Always track game time
          if (gameMode !== 'timeAttack' && gameMode !== 'survival') {
            gameTimer += dt;
          }
          if (gameMode === 'timeAttack') {
            gameTimer += dt;
            updateNextOrb();
            if (gameTimer >= TIME_ATTACK_SECS) endGame();
          }
          if (gameMode === 'survival') {
            gameTimer += dt;
            updateNextOrb();
          }
          break;
        }
        case 'dropping': {
          dropProgress += dt * DROP_ANIM_SPEED;
          const targetPos = gridToWorld(dropTargetRow, selectedCol);
          if (activeOrb) {
            const currentY = dropStartY + (targetPos.y - dropStartY) * Math.min(1, dropProgress);
            activeOrb.position.y = currentY;
          }
          if (dropProgress >= 1) {
            removeActiveOrb();
            placeOrb(dropTargetRow, selectedCol, currentColor);
            triggerLandingFlash(dropTargetRow, selectedCol, currentColor);
            // Squish animation on the placed orb
            if (orbMeshes[dropTargetRow][selectedCol]) triggerSquish(orbMeshes[dropTargetRow][selectedCol]!);
            processAfterPlace();
          }
          break;
        }
        case 'clearing': {
          clearTimer += dt;
          const animDone = !updateClearAnims(dt);
          if (clearTimer >= CLEAR_ANIM_TIME && animDone) finishClear();
          break;
        }
        case 'cascading': {
          cascadeTimer += dt;
          if (cascadeTimer >= CASCADE_DELAY) checkAndClear();
          break;
        }
        case 'nextOrb': {
          nextOrbTimer += dt;
          if (nextOrbTimer >= NEXT_ORB_DELAY) {
            if (gameMode === 'sprint' && sprintClears >= SPRINT_TARGET) endGame();
            else prepareNextOrb();
          }
          break;
        }
      }
    } else {
      handleInput(dt);
    }

    // Rotate non-sphere grid orbs for visual flair
    if (SKIN_DEFS[skinIdx].geoType !== 'sphere' && (gameState === 'playing' || gameState === 'paused' || gameState === 'gameOver')) {
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const m = orbMeshes[r][c];
        if (m) { m.rotation.y += dt * 0.3; m.rotation.x += dt * 0.15; }
      }
    }

    // Orb glow pulsing (subtle emissive breathing)
    if (gameState === 'playing') {
      const pulse = Math.sin(performance.now() / 800) * 0.15 + 1.0;
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const m = orbMeshes[r][c];
        if (m) {
          const mat = m.material as MeshStandardMaterial;
          mat.emissiveIntensity = SKIN_DEFS[skinIdx].emIntensity * pulse;
        }
      }
    }
  }

  // ---- Register Update Loop ----
  let lastTime = performance.now();
  function rafLoop(now: number) {
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    if (!(world as any)._updateRegistered) update(dt);
    requestAnimationFrame(rafLoop);
  }
  try {
    const UpdateSystem = class { static queries = {}; world: any; execute(dt: number) { update(dt / 1000); } };
    (world as any).ecs?.registerSystem?.(UpdateSystem);
    (world as any)._updateRegistered = true;
  } catch { requestAnimationFrame(rafLoop); }

  // ---- Initialize ----
  initParticlePool();
  themesUsed.add(themeIdx);
  switchState('title');
}

// ============================================================
// ENTRY POINT
// ============================================================
main().catch(console.error);
