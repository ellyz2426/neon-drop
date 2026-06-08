// Neon Drop VR — Color-matching drop puzzle in VR
// Drop colored neon orbs into a grid, match 3+ to clear
// First match-3/drop-puzzle genre in the IWSDK portfolio

import {
  World, PanelUI, ScreenSpace, Follower, FollowBehavior,
  PanelDocument, UIKitDocument,
  Mesh, Group, BoxGeometry, SphereGeometry, CylinderGeometry,
  PlaneGeometry, TorusGeometry,
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
type GameState = 'title' | 'modeSelect' | 'playing' | 'paused' | 'gameOver' | 'settings' | 'help';
type GameMode = 'classic' | 'endless' | 'timeAttack' | 'sprint' | 'zen';
type PlayPhase = 'selecting' | 'dropping' | 'clearing' | 'cascading' | 'nextOrb' | 'countdown';

interface SaveData {
  highScores: Record<string, number>;
  totalGames: number;
  totalClears: number;
  totalCascades: number;
  bestCombo: number;
  settings: { sfxVol: number; musVol: number; themeIdx: number };
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

const MODE_NAMES: Record<GameMode, string> = {
  classic: 'Classic', endless: 'Endless', timeAttack: 'Time Attack', sprint: 'Sprint', zen: 'Zen',
};

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

  play(type: 'drop' | 'clear' | 'cascade' | 'combo' | 'gameover' | 'select' | 'move' | 'levelup' | 'countdown') {
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
    // Second oscillator for depth
    const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = 82.5;
    const g2 = c.createGain(); g2.gain.value = 0.04 * this.musVol; g2.connect(c.destination);
    o2.connect(g2); o2.start();
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
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { highScores: {}, totalGames: 0, totalClears: 0, totalCascades: 0, bestCombo: 0, settings: { sfxVol: 0.8, musVol: 0.6, themeIdx: 0 } };
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
  return -1; // column full
}

function findMatches(grid: number[][]): [number, number][] {
  const matched = new Set<string>();
  const dirs: [number, number][] = [[0, 1], [1, 0], [1, 1], [1, -1]];
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
          for (const [cr, cc] of cells) matched.add(`${cr},${cc}`);
        }
      }
    }
  }
  return [...matched].map(s => { const p = s.split(','); return [+p[0], +p[1]]; });
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
  function makeHolodeck() {
    const grp = new Group();
    // Floor
    const floorGeo = new PlaneGeometry(20, 20);
    const floorMat = new MeshStandardMaterial({ color: THEMES[themeIdx].floor, roughness: 0.9 });
    const floor = new Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2; floor.position.y = 0;
    grp.add(floor);
    // Floor grid lines
    const linesMat = new LineBasicMaterial({ color: gridColor, transparent: true, opacity: 0.15 });
    for (let i = -10; i <= 10; i++) {
      const g1 = new BufferGeometry().setFromPoints([new Vector3(i, 0.001, -10), new Vector3(i, 0.001, 10)]);
      grp.add(new LineSegments(g1, linesMat));
      const g2 = new BufferGeometry().setFromPoints([new Vector3(-10, 0.001, i), new Vector3(10, 0.001, i)]);
      grp.add(new LineSegments(g2, linesMat));
    }
    // Walls (subtle)
    const wallMat = new MeshStandardMaterial({ color: THEMES[themeIdx].floor, transparent: true, opacity: 0.3 });
    const wallGeo = new PlaneGeometry(20, 5);
    const bw = new Mesh(wallGeo, wallMat); bw.position.set(0, 2.5, -10); grp.add(bw);
    const lw = new Mesh(wallGeo, wallMat); lw.position.set(-10, 2.5, 0); lw.rotation.y = Math.PI / 2; grp.add(lw);
    const rw = new Mesh(wallGeo, wallMat); rw.position.set(10, 2.5, 0); rw.rotation.y = -Math.PI / 2; grp.add(rw);
    return grp;
  }
  const holodeckGrp = makeHolodeck();
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
    // Border
    const border = new BufferGeometry().setFromPoints([
      new Vector3(-hw, 0, 0), new Vector3(hw, 0, 0),
      new Vector3(hw, 0, 0), new Vector3(hw, hh, 0),
      new Vector3(hw, hh, 0), new Vector3(-hw, hh, 0),
      new Vector3(-hw, hh, 0), new Vector3(-hw, 0, 0),
    ]);
    gridFrameGrp.add(new LineSegments(border, matBorder));
    // Vertical lines
    for (let i = 1; i < COLS; i++) {
      const x = -hw + i * CELL;
      const g = new BufferGeometry().setFromPoints([new Vector3(x, 0, 0), new Vector3(x, hh, 0)]);
      gridFrameGrp.add(new LineSegments(g, mat));
    }
    // Horizontal lines
    for (let i = 1; i < ROWS; i++) {
      const y = i * CELL;
      const g = new BufferGeometry().setFromPoints([new Vector3(-hw, y, 0), new Vector3(hw, y, 0)]);
      gridFrameGrp.add(new LineSegments(g, mat));
    }
    // Back panel (subtle dark)
    const panelGeo = new PlaneGeometry(GRID_W, GRID_H);
    const panelMat = new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 });
    const panel = new Mesh(panelGeo, panelMat);
    panel.position.set(0, hh / 2, -0.005);
    gridFrameGrp.add(panel);
  }
  buildGridFrame();

  // ---- Column Selector ----
  const selectorGeo = new PlaneGeometry(CELL * 0.9, GRID_H);
  const selectorMat = new MeshBasicMaterial({
    color: new Color(THEMES[themeIdx].grid), transparent: true, opacity: 0.12,
  });
  const selectorMesh = new Mesh(selectorGeo, selectorMat);
  selectorMesh.position.set(0, GRID_H / 2, 0.001);
  gridFrameGrp.add(selectorMesh);

  function updateSelectorCol(col: number) {
    const x = -GRID_W / 2 + col * CELL + CELL / 2;
    selectorMesh.position.x = x;
  }

  // ---- Orb Materials (pre-created) ----
  const orbMats: MeshStandardMaterial[] = ORB_COLORS.map(c =>
    new MeshStandardMaterial({ color: c.hex, emissive: c.em, emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.2 })
  );
  const orbGeo = new SphereGeometry(ORB_R, 16, 12);

  function createOrbMesh(colorIdx: number): Mesh {
    const m = new Mesh(orbGeo, orbMats[colorIdx - 1]);
    return m;
  }

  // ---- Active Orb (floating above grid) ----
  let activeOrb: Mesh | null = null;
  let activeOrbColor = 0;

  function spawnActiveOrb(colorIdx: number, col: number) {
    if (activeOrb) scene.remove(activeOrb);
    activeOrb = createOrbMesh(colorIdx);
    activeOrbColor = colorIdx;
    const pos = gridToWorld(ROWS, col);
    pos.y += CELL * 0.5;
    activeOrb.position.copy(pos);
    scene.add(activeOrb);
  }

  function moveActiveOrbToCol(col: number) {
    if (!activeOrb) return;
    const pos = gridToWorld(ROWS, col);
    pos.y += CELL * 0.5;
    activeOrb.position.x = pos.x;
  }

  function removeActiveOrb() {
    if (activeOrb) { scene.remove(activeOrb); activeOrb = null; }
  }

  // ---- Particle system ----
  interface Particle { mesh: Mesh; vel: Vector3; age: number; life: number; }
  const particles: Particle[] = [];
  const particleGeo = new SphereGeometry(0.008, 6, 4);

  function spawnParticles(pos: Vector3, color: Color, count: number) {
    for (let i = 0; i < count; i++) {
      const mat = new MeshBasicMaterial({ color, transparent: true, opacity: 1 });
      const m = new Mesh(particleGeo, mat);
      m.position.copy(pos);
      const vel = new Vector3((Math.random() - 0.5) * 2, Math.random() * 2 + 0.5, (Math.random() - 0.5) * 0.5);
      scene.add(m);
      particles.push({ mesh: m, vel, age: 0, life: 0.5 + Math.random() * 0.3 });
    }
  }

  function updateParticles(dt: number) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age += dt;
      if (p.age >= p.life) { scene.remove(p.mesh); particles.splice(i, 1); continue; }
      p.vel.y -= 3 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      (p.mesh.material as MeshBasicMaterial).opacity = 1 - p.age / p.life;
      p.mesh.scale.setScalar(1 - p.age / p.life);
    }
  }

  // ---- Glow ring for clearing ----
  const ringGeo = new TorusGeometry(ORB_R * 1.5, 0.003, 8, 24);
  interface ClearAnim { mesh: Mesh; orbMesh: Mesh; age: number; }
  const clearAnims: ClearAnim[] = [];

  function startClearAnim(row: number, col: number, colorIdx: number) {
    const pos = gridToWorld(row, col);
    const ringMat = new MeshBasicMaterial({ color: ORB_COLORS[colorIdx - 1].hex, transparent: true, opacity: 0.8 });
    const ring = new Mesh(ringGeo, ringMat);
    ring.position.copy(pos);
    ring.position.z += 0.01;
    scene.add(ring);
    clearAnims.push({ mesh: ring, orbMesh: orbMeshes[row][col]!, age: 0 });
  }

  function updateClearAnims(dt: number): boolean {
    let active = false;
    for (let i = clearAnims.length - 1; i >= 0; i--) {
      const a = clearAnims[i];
      a.age += dt;
      const t = a.age / CLEAR_ANIM_TIME;
      if (t >= 1) {
        scene.remove(a.mesh);
        if (a.orbMesh) { a.orbMesh.scale.setScalar(0); }
        clearAnims.splice(i, 1);
        continue;
      }
      active = true;
      a.mesh.scale.setScalar(1 + t * 2);
      (a.mesh.material as MeshBasicMaterial).opacity = 0.8 * (1 - t);
      if (a.orbMesh) {
        a.orbMesh.scale.setScalar(1 - t);
      }
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

  function randomColor(): number {
    return Math.floor(Math.random() * ORB_COLORS.length) + 1;
  }

  function getDropDelay(): number {
    if (gameMode === 'zen' || gameMode === 'endless') return BASE_DROP_DELAY;
    return Math.max(MIN_DROP_DELAY, BASE_DROP_DELAY - (level - 1) * DELAY_DEC);
  }

  function calcScore(count: number, chain: number): number {
    const base = count * 10;
    const groupBonus = count > 3 ? (count - 3) * 20 : 0;
    return (base + groupBonus) * Math.max(1, chain);
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
    for (const p of particles) scene.remove(p.mesh);
    particles.length = 0;
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
    if (opts.pos) entity.object3D.position.set(...opts.pos);
    entity.addComponent(PanelUI, { config, maxWidth: opts.maxW ?? 1, maxHeight: opts.maxH ?? 1 });
    if (opts.follower) {
      entity.addComponent(Follower, {
        target: world.player?.head ?? world.playerHeadEntity?.object3D,
        offsetPosition: opts.follower.offset,
        behavior: opts.follower.behavior ?? FollowBehavior.PivotY,
        speed: opts.follower.speed ?? 5,
        tolerance: opts.follower.tolerance ?? 0.3,
      });
    }
    if (opts.screenSpace) {
      entity.addComponent(ScreenSpace, { ...opts.screenSpace, zOffset: 0.25 });
    }
    entity.object3D.visible = false;
    panels[name] = { entity, doc: null };
  }

  // Create panels
  createPanel('mainMenu', '/ui/main-menu.json', { pos: [0, 1.5, -2], maxW: 0.9, maxH: 1.2 });
  createPanel('modeSelect', '/ui/mode-select.json', { pos: [0, 1.5, -2], maxW: 0.9, maxH: 1.4 });
  createPanel('gameOver', '/ui/game-over.json', { pos: [0, 1.5, -2], maxW: 0.8, maxH: 1.2 });
  createPanel('pauseMenu', '/ui/pause-menu.json', { pos: [0, 1.5, -2], maxW: 0.7, maxH: 0.9 });
  createPanel('settings', '/ui/settings.json', { pos: [0, 1.5, -2], maxW: 0.9, maxH: 1.2 });
  createPanel('help', '/ui/help.json', { pos: [0, 1.5, -2], maxW: 0.9, maxH: 1.4 });
  createPanel('hud', '/ui/hud.json', {
    maxW: 0.45, maxH: 0.12,
    follower: { offset: [0, 0.2, -0.6], behavior: FollowBehavior.PivotY, speed: 5, tolerance: 0.3 },
  });
  createPanel('nextOrb', '/ui/next-orb.json', {
    maxW: 0.15, maxH: 0.2,
    screenSpace: { width: '120px', height: 'auto', top: '20px', right: '20px' },
  });

  // Wait for panel docs to be ready
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

  function showPanel(name: string) { if (panels[name]) panels[name].entity.object3D.visible = true; }
  function hidePanel(name: string) { if (panels[name]) panels[name].entity.object3D.visible = false; }
  function hideAllPanels() { for (const k of Object.keys(panels)) hidePanel(k); }

  // ---- UI Event Binding ----
  let uiBindingsReady = false;
  function tryBindUI(): boolean {
    // Main Menu
    const mm = getPanelDoc('mainMenu');
    if (!mm) return false;
    const btnStart = mm.getElementById('btn-start');
    const btnModes = mm.getElementById('btn-modes');
    const btnSettings = mm.getElementById('btn-settings');
    const btnHelp = mm.getElementById('btn-help');
    if (!btnStart) return false;

    btnStart.addEventListener('click', () => { audio.play('select'); startGame(); });
    btnModes.addEventListener('click', () => { audio.play('select'); switchState('modeSelect'); });
    btnSettings.addEventListener('click', () => { audio.play('select'); switchState('settings'); });
    btnHelp.addEventListener('click', () => { audio.play('select'); switchState('help'); });

    // Mode Select
    const ms = getPanelDoc('modeSelect');
    if (ms) {
      for (const m of ['classic', 'endless', 'timeattack', 'sprint', 'zen'] as const) {
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
          applyTheme(); updateSettingsUI(); audio.play('select');
        });
      }
      st.getElementById('settings-back')?.addEventListener('click', () => { audio.play('select'); switchState('title'); });
    }

    // Help
    const hp = getPanelDoc('help');
    if (hp) {
      hp.getElementById('help-back')?.addEventListener('click', () => { audio.play('select'); switchState('title'); });
    }

    return true;
  }

  // ---- UI Update Functions ----
  function updateHUD() {
    const doc = getPanelDoc('hud');
    if (!doc) return;
    const s = doc.getElementById('hud-score');
    if (s) s.text.value = `${score}`;
    const l = doc.getElementById('hud-level');
    if (l) l.text.value = `${level}`;
    const c = doc.getElementById('hud-combo');
    if (c) c.text.value = comboChain > 1 ? `x${comboChain}` : 'x1';
    const cl = doc.getElementById('hud-clears');
    if (cl) cl.text.value = `${totalClears}`;
  }

  function updateNextOrb() {
    const doc = getPanelDoc('nextOrb');
    if (!doc) return;
    const el = doc.getElementById('next-color');
    if (el) {
      (el as any).backgroundColor = { value: ORB_COLORS[nextColor - 1].hex };
      (el as any).borderColor = { value: ORB_COLORS[nextColor - 1].em };
    }
    // Timer display for time attack
    const tl = doc.getElementById('timer-label');
    const tv = doc.getElementById('timer-value');
    if (gameMode === 'timeAttack' && tl && tv) {
      (tl as any).text = { value: 'TIME' };
      const remaining = Math.max(0, TIME_ATTACK_SECS - gameTimer);
      (tv as any).text = { value: `${Math.ceil(remaining)}s` };
    } else if (gameMode === 'sprint' && tl && tv) {
      (tl as any).text = { value: 'LEFT' };
      (tv as any).text = { value: `${Math.max(0, SPRINT_TARGET - sprintClears)}` };
    } else if (tl && tv) {
      (tl as any).text = { value: '' };
      (tv as any).text = { value: '' };
    }
  }

  function updateMainMenuUI() {
    const doc = getPanelDoc('mainMenu');
    if (!doc) return;
    const hs = doc.getElementById('menu-highscore');
    if (hs) hs.text.value = `${save.highScores[gameMode] || 0}`;
  }

  function updateModeSelectUI() {
    const doc = getPanelDoc('modeSelect');
    if (!doc) return;
    // Update visual selection (we can't easily change classes, but update border)
    for (const m of ['classic', 'endless', 'timeattack', 'sprint', 'zen']) {
      const modeKey = m === 'timeattack' ? 'timeAttack' : m;
      const el = doc.getElementById(`mode-${m}`);
      if (el) {
        const isActive = modeKey === gameMode;
        try {
          (el as any).borderColor = { value: isActive ? '#00ffff' : '#00aaaa' };
          (el as any).borderWidth = { value: isActive ? 0.1 : 0.06 };
          (el as any).backgroundColor = { value: isActive ? 'rgba(0, 255, 255, 0.2)' : 'rgba(0, 255, 255, 0.08)' };
        } catch { /* some props may not be settable */ }
      }
    }
  }

  function updateGameOverUI() {
    const doc = getPanelDoc('gameOver');
    if (!doc) return;
    const setText = (id: string, text: string) => {
      const el = doc.getElementById(id);
      if (el) el.text.value = text;
    };
    setText('go-score', `${score}`);
    setText('go-mode', MODE_NAMES[gameMode]);
    setText('go-level', `${level}`);
    setText('go-clears', `${totalClears}`);
    setText('go-combo', `x${bestComboThisGame}`);
    setText('go-cascades', `${totalCascades}`);
    // Check new best
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
    if (sfxEl) sfxEl.text.value = `${Math.round(audio.sfxVol * 100)}%`;
    const musEl = doc.getElementById('mus-val');
    if (musEl) musEl.text.value = `${Math.round(audio.musVol * 100)}%`;
    const tn = doc.getElementById('theme-name');
    if (tn) tn.text.value = THEMES[themeIdx].name;
  }

  // ---- Theme ----
  function applyTheme() {
    const t = THEMES[themeIdx];
    scene.fog = new Fog(t.fog, 0.5, 25);
    ambLight.color.set(t.amb);
    gridColor.set(t.grid);
    selectorMat.color.set(t.grid);
    buildGridFrame();
    // Rebuild holodeck
    scene.remove(holodeckGrp);
    const newHolo = makeHolodeck();
    scene.add(newHolo);
    (holodeckGrp as any).children = newHolo.children; // keep ref for future
  }

  // ---- State Machine ----
  function switchState(state: GameState) {
    gameState = state;
    hideAllPanels();
    gridFrameGrp.visible = false;
    selectorMesh.visible = false;
    removeActiveOrb();
    // Hide grid orbs in non-playing states
    const showGrid = state === 'playing' || state === 'paused';
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
    }
  }

  function startGame() {
    clearAllOrbs();
    grid = makeGrid();
    orbMeshes = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    score = 0; level = 1; comboChain = 0; totalClears = 0; totalCascades = 0;
    bestComboThisGame = 0; gameTimer = 0; sprintClears = 0;
    selectedCol = Math.floor(COLS / 2);
    currentColor = randomColor();
    nextColor = randomColor();
    playPhase = 'countdown';
    countdownTimer = COUNTDOWN_TIME;
    dropTimer = 0;
    audio.startMusic();
    save.totalGames++;
    writeSave(save);
    switchState('playing');
    spawnActiveOrb(currentColor, selectedCol);
  }

  function endGame() {
    audio.play('gameover');
    // Save high score
    const prev = save.highScores[gameMode] || 0;
    if (score > prev) save.highScores[gameMode] = score;
    save.totalClears += totalClears;
    save.totalCascades += totalCascades;
    if (bestComboThisGame > save.bestCombo) save.bestCombo = bestComboThisGame;
    writeSave(save);
    switchState('gameOver');
  }

  function dropOrb() {
    const targetRow = lowestEmptyRow(grid, selectedCol);
    if (targetRow < 0) return; // column full — shouldn't happen if we prevent input
    audio.play('drop');
    playPhase = 'dropping';
    dropTargetRow = targetRow;
    dropStartY = activeOrb ? activeOrb.position.y : gridToWorld(ROWS, selectedCol).y + CELL * 0.5;
    dropProgress = 0;
  }

  function instantDrop() {
    const targetRow = lowestEmptyRow(grid, selectedCol);
    if (targetRow < 0) return;
    audio.play('drop');
    // Place immediately
    placeOrb(targetRow, selectedCol, currentColor);
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
    checkAndClear();
  }

  function checkAndClear() {
    pendingMatches = findMatches(grid);
    if (pendingMatches.length > 0) {
      comboChain++;
      if (comboChain > bestComboThisGame) bestComboThisGame = comboChain;
      const pts = calcScore(pendingMatches.length, comboChain);
      score += pts;
      totalClears += pendingMatches.length;
      sprintClears += pendingMatches.length;

      if (comboChain > 1) {
        audio.play('cascade');
        totalCascades++;
      } else {
        audio.play('clear');
      }
      if (comboChain >= 3) audio.play('combo');

      // Start clear animation
      for (const [r, c] of pendingMatches) {
        const colorIdx = grid[r][c];
        startClearAnim(r, c, colorIdx);
        const pos = gridToWorld(r, c);
        spawnParticles(pos, new Color(ORB_COLORS[colorIdx - 1].hex), 6);
      }

      playPhase = 'clearing';
      clearTimer = 0;

      // Level up check
      const newLevel = Math.floor(totalClears / CLEARS_PER_LVL) + 1;
      if (newLevel > level) { level = newLevel; audio.play('levelup'); }
    } else {
      // No matches — check game over or next orb
      comboChain = 0;
      if (isGameOver()) { endGame(); return; }
      playPhase = 'nextOrb';
      nextOrbTimer = 0;
    }
    updateHUD();
  }

  function finishClear() {
    // Remove matched orbs from grid
    for (const [r, c] of pendingMatches) {
      grid[r][c] = 0;
      if (orbMeshes[r][c]) { scene.remove(orbMeshes[r][c]!); orbMeshes[r][c] = null; }
    }
    // Apply gravity
    const didFall = applyGravity(grid, orbMeshes);
    if (didFall) {
      playPhase = 'cascading';
      cascadeTimer = 0;
    } else {
      // Check for more matches
      checkAndClear();
    }
  }

  function isGameOver(): boolean {
    if (gameMode === 'zen') return false;
    if (gameMode === 'timeAttack' && gameTimer >= TIME_ATTACK_SECS) return true;
    if (gameMode === 'sprint' && sprintClears >= SPRINT_TARGET) return true;
    // Check if any column is full (top row occupied)
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
    // Ensure selected column is not full
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
    const kb = world.input?.keyboard;
    const rightGP = world.input?.xr?.gamepads?.right;

    // Pause
    if (gameState === 'playing' && playPhase !== 'countdown') {
      if (kb?.getKeyDown?.('Escape') || kb?.getKeyDown?.('KeyP') || rightGP?.getButtonDown?.(InputComponent.B_Button)) {
        audio.play('select');
        switchState('paused');
        return;
      }
    }
    if (gameState === 'paused') {
      if (kb?.getKeyDown?.('Escape') || kb?.getKeyDown?.('KeyP') || rightGP?.getButtonDown?.(InputComponent.B_Button)) {
        audio.play('select');
        switchState('playing');
        return;
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
    }

    // Drop
    if (kb?.getKeyDown?.('ArrowDown')) {
      dropOrb();
    }
    if (kb?.getKeyDown?.('Space')) {
      instantDrop();
    }

    // XR input
    if (rightGP?.getButtonDown?.(InputComponent.Trigger)) {
      dropOrb();
    }
    if (rightGP?.getButtonDown?.(InputComponent.A_Button)) {
      instantDrop();
    }
  }

  // ---- Update Loop ----
  function update(dt: number) {
    dt = Math.min(dt, 0.05);

    // Bind UI events once ready
    if (!uiBindingsReady) {
      uiBindingsReady = tryBindUI();
    }

    updateParticles(dt);

    if (gameState === 'playing') {
      handleInput(dt);

      switch (playPhase) {
        case 'countdown': {
          countdownTimer -= dt;
          if (countdownTimer <= 0) {
            playPhase = 'selecting';
            prepareNextOrb();
          } else {
            const sec = Math.ceil(countdownTimer);
            // Flash the active orb
            if (activeOrb) {
              const flash = Math.sin(countdownTimer * 10) * 0.3 + 0.7;
              activeOrb.scale.setScalar(flash);
            }
          }
          break;
        }
        case 'selecting': {
          // Auto-drop timer
          dropTimer += dt;
          if (dropTimer >= getDropDelay()) {
            dropOrb();
          }
          // Bob active orb
          if (activeOrb) {
            const bobY = Math.sin(performance.now() / 300) * 0.005;
            const basePos = gridToWorld(ROWS, selectedCol);
            activeOrb.position.y = basePos.y + CELL * 0.5 + bobY;
          }

          // Game timer
          if (gameMode === 'timeAttack') {
            gameTimer += dt;
            updateNextOrb();
            if (gameTimer >= TIME_ATTACK_SECS) {
              endGame();
            }
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
            // Place the orb
            removeActiveOrb();
            placeOrb(dropTargetRow, selectedCol, currentColor);
            processAfterPlace();
          }
          break;
        }
        case 'clearing': {
          clearTimer += dt;
          const animDone = !updateClearAnims(dt);
          if (clearTimer >= CLEAR_ANIM_TIME && animDone) {
            finishClear();
          }
          break;
        }
        case 'cascading': {
          cascadeTimer += dt;
          if (cascadeTimer >= CASCADE_DELAY) {
            checkAndClear();
          }
          break;
        }
        case 'nextOrb': {
          nextOrbTimer += dt;
          if (nextOrbTimer >= NEXT_ORB_DELAY) {
            if (gameMode === 'sprint' && sprintClears >= SPRINT_TARGET) {
              endGame();
            } else {
              prepareNextOrb();
            }
          }
          break;
        }
      }
    } else {
      handleInput(dt);
    }
  }

  // ---- Register Update Loop ----
  (world as any).onUpdate = update;
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
  switchState('title');
}

// ============================================================
// ENTRY POINT
// ============================================================
main().catch(console.error);
