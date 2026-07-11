const assert = require("node:assert/strict");

const CONFIG = {
  baseHp: 12,
  maxWave: 6,
};

const TOWERS = {
  shield: { range: 96, damage: 3, rate: 0.34, slow: 0.38, slowTime: 1.5 },
  spear: { range: 92, damage: 7, rate: 0.95 },
  bow: { range: 142, damage: 4, rate: 0.48 },
};

const ENEMIES = {
  grunt: { hp: 26, speed: 42, damage: 1 },
  runner: { hp: 18, speed: 68, damage: 1 },
  brute: { hp: 54, speed: 31, damage: 2 },
};

function createState() {
  return {
    baseHp: CONFIG.baseHp,
    wave: 1,
    gold: 4,
    hand: [{ type: "shield" }, { type: "spear" }, { type: "bow" }],
    towers: [],
    enemies: [],
  };
}

function buildTower(state, type, slot) {
  if (state.towers.some((tower) => tower.slotId === slot.id)) return false;
  state.towers.push({ type, slotId: slot.id, x: slot.x, y: slot.y, level: 1 });
  return true;
}

function towerStats(tower) {
  const base = TOWERS[tower.type];
  const level = tower.level || 1;
  return {
    ...base,
    range: base.range + (level - 1) * 10,
    damage: Math.round(base.damage * (1 + (level - 1) * 0.45)),
    rate: Math.max(0.26, base.rate * Math.pow(0.9, level - 1)),
  };
}

function upgradeTower(state, tower) {
  const cost = 3 + tower.level;
  if (state.gold < cost) return false;
  state.gold -= cost;
  tower.level += 1;
  return true;
}

function applyShieldSlow(enemy) {
  enemy.slowFactor = Math.min(enemy.slowFactor || 1, TOWERS.shield.slow);
  enemy.slowTimer = Math.max(enemy.slowTimer || 0, TOWERS.shield.slowTime);
}

function useCardAtSlot(state, handIndex, slot) {
  const card = state.hand[handIndex];
  if (!card) return false;
  if (!buildTower(state, card.type, slot)) return false;
  state.hand.splice(handIndex, 1);
  return true;
}

function spawnEnemy(state, type) {
  state.enemies.push({ type, hp: ENEMIES[type].hp, progress: 0 });
}

function enemyReachBase(state, type) {
  state.baseHp = Math.max(0, state.baseHp - ENEMIES[type].damage);
}

function towerCanHit(towerType, tower, enemy) {
  const dx = tower.x - enemy.x;
  const dy = tower.y - enemy.y;
  return Math.hypot(dx, dy) <= TOWERS[towerType].range;
}

function waveList(wave) {
  const queue = [];
  for (let i = 0; i < 5 + wave * 2; i += 1) queue.push("grunt");
  if (wave >= 2) for (let i = 0; i < 2 + wave; i += 1) queue.push("runner");
  if (wave >= 3) for (let i = 0; i < wave - 1; i += 1) queue.push("brute");
  return queue;
}

const state = createState();
const slotA = { id: "s1", x: 90, y: 120 };
const slotB = { id: "s2", x: 300, y: 160 };

assert.equal(state.hand.length, 3, "开局应有 3 张塔牌");
assert.equal(useCardAtSlot(state, 0, slotA), true, "塔牌应能放到空高地");
assert.equal(state.towers.length, 1, "建塔后应记录塔");
assert.equal(state.hand.length, 2, "用牌建塔后手牌减少");
assert.equal(useCardAtSlot(state, 0, slotA), false, "同一高地不能重复建塔");
assert.equal(useCardAtSlot(state, 0, slotB), true, "另一个高地可以继续建塔");

spawnEnemy(state, "grunt");
spawnEnemy(state, "runner");
assert.equal(state.enemies.length, 2, "敌人应能进入路线");
assert.equal(ENEMIES.runner.speed > ENEMIES.grunt.speed, true, "快兵应更快");
assert.equal(ENEMIES.brute.hp > ENEMIES.grunt.hp, true, "重兵应更耐打");
assert.equal(TOWERS.bow.range > TOWERS.shield.range, true, "弓塔射程应更远");
assert.equal(TOWERS.spear.damage > TOWERS.shield.damage, true, "枪塔单次伤害应更高");
assert.equal(TOWERS.shield.slow < 1, true, "盾塔应提供减速价值");
assert.equal(TOWERS.shield.rate < TOWERS.spear.rate, true, "盾塔应通过高频近防触发减速");

const testTower = { x: 100, y: 100 };
assert.equal(towerCanHit("bow", testTower, { x: 220, y: 100 }), true, "弓塔应能打到远处敌人");
assert.equal(towerCanHit("shield", testTower, { x: 220, y: 100 }), false, "盾塔不应打到超出近防范围的敌人");

enemyReachBase(state, "brute");
assert.equal(state.baseHp, 10, "敌人到达城门应扣血");

const slowTarget = { slowFactor: 1, slowTimer: 0 };
applyShieldSlow(slowTarget);
assert.equal(slowTarget.slowFactor, 0.38, "盾塔命中后应降低敌人速度");
assert.equal(slowTarget.slowTimer > 0, true, "盾塔减速应持续一段时间");

const tower = state.towers[0];
state.gold = 8;
assert.equal(upgradeTower(state, tower), true, "击退敌人获得军资后应能升级塔");
assert.equal(tower.level, 2, "塔升级后等级应增加");
assert.equal(towerStats(tower).damage > TOWERS[tower.type].damage, true, "升级后塔伤害应提升");
assert.equal(towerStats(tower).range > TOWERS[tower.type].range, true, "升级后塔射程应提升");

assert.equal(waveList(1).includes("brute"), false, "第一波不应出现重兵");
assert.equal(waveList(3).includes("brute"), true, "第三波开始应出现重兵");
assert.equal(CONFIG.maxWave, 6, "v0.4 应有明确可通关波数");

console.log("rules.test.js: v0.4B tower defense checks passed");
