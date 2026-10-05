// Catalogue du jardin. Les tuiles sont des hexagones "pointe en haut", larges de 2 unités, surface à y=0.
// slots = emplacements où poussent les arbres des sessions.

export type Species = { name: string; price: number; model: string; tint?: [number, number, number]; scale?: number };
export type DecoItem = [model: string, x: number, z: number, rotY: number, scale: number];
export type TileDef = { name: string; price: number; base: string; deco: DecoItem[]; slots: [number, number][] };

export const SPECIES: Record<string, Species> = {
  chene: { name: "Chêne", price: 0, model: "tree_single_A" },
  sapin: { name: "Sapin", price: 60, model: "tree_single_B" },
  erable: { name: "Érable d'automne", price: 100, model: "tree_single_A", tint: [1.0, 0.52, 0.18] },
  cerisier: { name: "Cerisier", price: 140, model: "tree_single_A", tint: [1.0, 0.62, 0.78] },
  bosquet: { name: "Bosquet", price: 180, model: "trees_B_small", scale: 0.55 },
};

export const TILES: Record<string, TileDef> = {
  prairie: { name: "Prairie", price: 100, base: "hex_grass", deco: [["rock_single_A", 0.62, -0.42, 0.4, 1], ["rock_single_B", -0.66, -0.3, 1.2, 0.9]], slots: [[0, -0.5], [0.45, 0.3], [-0.45, 0.3]] },
  clairiere: { name: "Clairière", price: 140, base: "hex_grass", deco: [["hill_single_A", -0.3, -0.45, 0, 0.8], ["rock_single_E", 0.6, 0.45, 0.6, 0.9], ["rock_single_C", 0.15, 0.75, 2, 0.7]], slots: [[0.45, -0.25], [-0.45, 0.4]] },
  bosquet: { name: "Bosquet", price: 180, base: "hex_grass", deco: [["trees_B_small", -0.3, -0.25, 0, 0.75], ["rock_single_A", 0.1, 0.75, 1, 1]], slots: [[0.55, 0.2], [-0.3, 0.55]] },
  riviere: { name: "Rivière", price: 200, base: "hex_river_A", deco: [["waterlily_A", 0.05, 0.25, 0, 1.2], ["waterlily_B", -0.15, -0.3, 1, 1], ["waterplant_B", 0.2, -0.55, 0, 1.2]], slots: [[0.6, 0.1], [-0.6, -0.1]] },
  lac: { name: "Lac", price: 220, base: "hex_water", deco: [["waterlily_A", 0.3, 0.2, 0, 1.4], ["waterlily_B", -0.25, -0.15, 1, 1.3], ["waterlily_A", -0.1, 0.5, 2, 1], ["waterplant_A", 0.55, -0.45, 0, 1.4], ["waterplant_B", -0.6, 0.2, 0, 1.3]], slots: [] },
  plage: { name: "Rivage", price: 240, base: "hex_coast_A", deco: [["waterlily_B", 0.0, 0.7, 0, 1.2], ["rock_single_C", -0.6, 0.1, 0.8, 0.8]], slots: [[0.3, -0.45], [-0.3, -0.45]] },
  collines: { name: "Collines", price: 260, base: "hex_grass", deco: [["hills_A_trees", -0.1, -0.15, 0, 0.8]], slots: [[0.55, 0.5]] },
  camp: { name: "Campement", price: 280, base: "hex_grass", deco: [["tent", 0.25, -0.3, -0.6, 1.1], ["barrel", -0.2, -0.55, 0, 1], ["resource_lumber", 0.4, 0.45, 1.1, 0.8], ["flag", 0.55, -0.55, 0, 1]], slots: [[-0.5, 0.15], [-0.05, 0.6]] },
  puits: { name: "Puits", price: 300, base: "hex_grass", deco: [["well", 0, -0.25, 0, 0.75], ["bucket_water", 0.45, -0.35, 0, 1.1], ["wheelbarrow", -0.5, -0.35, 0.8, 1]], slots: [[0.45, 0.45], [-0.45, 0.45]] },
  chaumiere: { name: "Chaumière", price: 340, base: "hex_grass", deco: [["home_A", 0, -0.25, 0, 0.85], ["sack", 0.45, -0.1, 0, 1.3], ["crate_A_small", 0.5, 0.1, 0.3, 1.1]], slots: [[0.5, 0.55], [-0.5, 0.4]] },
  moulin: { name: "Moulin", price: 380, base: "hex_grass", deco: [["windmill", 0, -0.2, 0, 0.8], ["sack", -0.5, 0.2, 0, 1.2]], slots: [[0.4, 0.55]] },
  montagne: { name: "Montagne", price: 420, base: "hex_grass", deco: [["mountain_A_grass_trees", 0, 0, 0, 0.85]], slots: [] },
  moulin_eau: { name: "Moulin à eau", price: 450, base: "hex_river_A", deco: [["watermill", 0, -0.1, 0, 0.8]], slots: [] },
};

export const PALETTE = ["#6fd3b0", "#ffb85c", "#8fa8ff", "#ff8fb3", "#c4dd6a", "#c39bff", "#64c8f0", "#ff9a76"];

export type Tile = { k: string; type: string; q: number; r: number; rot: number };
export type Subject = { id: string; name: string; color: string };
export type Settings = { mode: "pomo" | "timer" | "chrono"; free: number; work: number; pause: number; subject: string };
export type GardenState = {
  v: number;
  coins: number;
  subjects: Subject[];
  species: string[];
  current: string;
  tiles: Tile[];
  tileInv: Record<string, number>;
  claimed: string;
  settings: Settings;
};
export type Session = { id?: number; t: number; m: number; s: string; ok: boolean; sp: string; group_id?: string | null };

export function baseSubjects(): Subject[] {
  return [
    { id: "an", name: "Analyse", color: PALETTE[0] },
    { id: "al", name: "Algèbre", color: PALETTE[1] },
    { id: "pr", name: "Programmation", color: PALETTE[2] },
    { id: "ag", name: "Algorithmique", color: PALETTE[3] },
    { id: "ph", name: "Physique", color: PALETTE[4] },
    { id: "en", name: "Anglais", color: PALETTE[5] },
  ];
}

export function freshState(): GardenState {
  return {
    v: 1,
    coins: 0,
    subjects: baseSubjects(),
    species: ["chene"],
    current: "chene",
    tiles: [
      { k: "t1", type: "prairie", q: 0, r: 0, rot: 0 },
      { k: "t2", type: "prairie", q: 1, r: 0, rot: 2 },
      { k: "t3", type: "clairiere", q: 0, r: 1, rot: 0 },
    ],
    tileInv: {},
    claimed: "",
    settings: { mode: "pomo", free: 45, work: 25, pause: 5, subject: "an" },
  };
}

export function normalizeState(d: any): GardenState {
  const f = freshState();
  if (!d || typeof d !== "object" || !Array.isArray(d.tiles)) return f;
  return {
    ...f,
    ...d,
    settings: { ...f.settings, ...(d.settings || {}) },
    subjects: d.subjects?.length ? d.subjects : f.subjects,
    species: (d.species || ["chene"]).filter((k: string) => SPECIES[k]),
    current: SPECIES[d.current] ? d.current : "chene",
    tiles: d.tiles.filter((t: Tile) => TILES[t.type]),
    tileInv: d.tileInv || {},
  };
}
