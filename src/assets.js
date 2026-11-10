import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const RESTAURANT = [
  'wall', 'wall_window_open', 'wall_doorway',
  'kitchencounter_straight_A', 'kitchencounter_straight_B', 'kitchencounter_straight_A_backsplash',
  'kitchentable_A', 'kitchentable_B', 'stove_multi', 'fridge_A',
  'crate_buns', 'crate_cheese', 'crate_steak', 'plate', 'plate_small', 'pan_A',
  'food_ingredient_bun_bottom', 'food_ingredient_bun_top', 'food_ingredient_burger_cooked',
  'food_ingredient_burger_uncooked', 'food_ingredient_burger_trash', 'food_ingredient_cheese_slice',
  'table_round_A_small', 'chair_A', 'chair_stool', 'menu', 'extractorhood', 'kitchencabinet',
  'shelf_papertowel_decorated', 'jar_A_large', 'jar_B_medium', 'jar_C_small', 'dishrack_plates',
];
const FURNITURE = [
  'couch_pillows', 'armchair_pillows', 'cactus_medium_A', 'cactus_small_A', 'lamp_standing',
  'pictureframe_large_A', 'pictureframe_large_B', 'pictureframe_medium', 'rug_oval_A',
  'rug_rectangle_stripes_A', 'shelf_B_large_decorated', 'table_low', 'chair_A_wood',
];
export const CHARACTERS = ['Rogue', 'Knight', 'Mage', 'Barbarian', 'Rogue_Hooded'];

// Fantasy gear that ships attached to the characters; a café has no use for it.
const HIDE = /Knife|Crossbow|Throwable|Sword|Shield|Axe|Wand|Staff|Spellbook|Mug|Cape/;

const models = {};
const characters = {};

export async function loadAssets(onProgress) {
  const loader = new GLTFLoader();
  const jobs = [
    ...RESTAURANT.map((n) => ['restaurant', n, `models/restaurant/${n}.gltf`]),
    ...FURNITURE.map((n) => ['furniture', n, `models/furniture/${n}.gltf`]),
    ...CHARACTERS.map((n) => ['character', n, `models/characters/${n}.glb`]),
  ];
  let done = 0;
  await Promise.all(jobs.map(async ([kind, name, url]) => {
    const gltf = await loader.loadAsync(url);
    gltf.scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        if (kind === 'character') o.frustumCulled = false;
      }
      if (kind === 'character' && HIDE.test(o.name)) o.visible = false;
    });
    if (kind === 'character') characters[name] = gltf;
    else models[name] = gltf.scene;
    onProgress?.(++done / jobs.length);
  }));
}

export function model(name) {
  if (!models[name]) throw new Error('Unknown model: ' + name);
  return models[name].clone();
}

/** A rigged character instance with a simple cross-fading animation player. */
export function spawnCharacter(name) {
  const src = characters[name];
  const root = SkeletonUtils.clone(src.scene);
  const mixer = new THREE.AnimationMixer(root);
  const actions = {};
  for (const clip of src.animations) actions[clip.name] = mixer.clipAction(clip);
  let current = null;
  const play = (clipName, { once = false, fade = 0.2 } = {}) => {
    const next = actions[clipName];
    if (!next || (next === current && !once)) return;
    next.reset();
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = once;
    if (current) next.crossFadeFrom(current, fade, false);
    next.play();
    current = next;
  };
  play('Idle');
  return { root, mixer, play };
}
