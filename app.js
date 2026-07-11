(function () {
  "use strict";

  const CONFIG = {
    baseHp: 12,
    maxWave: 6,
    handMax: 3,
    drawEvery: 2.2,
    waveBreak: 2.8,
    startGold: 4,
    skillCooldown: 10,
  };

  const TOWERS = {
    shield: {
      label: "盾塔",
      card: "盾兵",
      color: "#52759f",
      dark: "#2f5278",
      range: 88,
      damage: 2,
      rate: 0.38,
      slow: 0.48,
      slowTime: 1.15,
      cost: 1,
      hint: "减速",
    },
    spear: {
      label: "枪塔",
      card: "枪兵",
      color: "#3f8463",
      dark: "#285940",
      range: 92,
      damage: 7,
      rate: 0.95,
      cost: 1,
      hint: "穿刺",
    },
    bow: {
      label: "弓塔",
      card: "弓兵",
      color: "#d39a2e",
      dark: "#865a18",
      range: 142,
      damage: 4,
      rate: 0.48,
      cost: 1,
      hint: "远射",
    },
  };

  const ENEMIES = {
    grunt: { hp: 26, speed: 42, damage: 1, color: "#cf6d55", label: "步卒" },
    runner: { hp: 18, speed: 68, damage: 1, color: "#dd8b52", label: "快兵" },
    brute: { hp: 54, speed: 31, damage: 2, color: "#b55242", label: "重兵" },
  };

  const CARD_ORDER = ["shield", "spear", "bow"];

  const state = {
    baseHp: CONFIG.baseHp,
    wave: 1,
    elapsed: 0,
    drawTimer: 0,
    nextWaveTimer: 0,
    spawnQueue: [],
    spawnTimer: 0,
    gold: CONFIG.startGold,
    skillTimer: 0,
    paused: false,
    ended: false,
    hand: [],
    towers: [],
    enemies: [],
    shots: [],
    floaters: [],
    nextId: 1,
    pointer: {
      active: false,
      dragging: false,
      cardIndex: -1,
      selectedIndex: -1,
      x: 0,
      y: 0,
      startX: 0,
      startY: 0,
    },
    message: {
      title: "守城开始",
      text: "拖卡到高地建塔，挡住沿路来攻的敌兵。",
    },
    messageTime: 0,
  };

  const els = {};
  let ctx = null;
  let layout = null;
  let lastFrame = 0;

  function init() {
    cacheElements();
    ctx = els.canvas.getContext("2d");
    layout = buildLayout();
    bindEvents();
    resetGame();
    requestAnimationFrame(loop);
  }

  function cacheElements() {
    Object.assign(els, {
      canvas: document.getElementById("battleCanvas"),
      enemyHp: document.getElementById("enemyHp"),
      playerHp: document.getElementById("playerHp"),
      wave: document.getElementById("wave"),
      timer: document.getElementById("timer"),
      pauseBtn: document.getElementById("pauseBtn"),
      restartBtn: document.getElementById("restartBtn"),
      resultRestartBtn: document.getElementById("resultRestartBtn"),
      messageTitle: document.getElementById("messageTitle"),
      messageText: document.getElementById("messageText"),
      resultDialog: document.getElementById("resultDialog"),
      resultTitle: document.getElementById("resultTitle"),
      resultText: document.getElementById("resultText"),
    });
  }

  function bindEvents() {
    els.restartBtn.addEventListener("click", resetGame);
    els.resultRestartBtn.addEventListener("click", resetGame);
    els.pauseBtn.addEventListener("click", () => {
      if (state.ended) return;
      state.paused = !state.paused;
      els.pauseBtn.textContent = state.paused ? "▶" : "Ⅱ";
      setMessage(state.paused ? "暂停中" : "继续守城", state.paused ? "观察路线和高地，继续后再落塔。" : "敌兵继续进攻，塔继续开火。");
      renderHud();
    });

    els.canvas.addEventListener("pointerdown", onPointerDown);
    els.canvas.addEventListener("pointermove", onPointerMove);
    els.canvas.addEventListener("pointerup", onPointerUp);
    els.canvas.addEventListener("pointercancel", cancelPointer);
  }

  function resetGame() {
    Object.assign(state, {
      baseHp: CONFIG.baseHp,
      wave: 1,
      elapsed: 0,
      drawTimer: 0,
      nextWaveTimer: 0,
      spawnQueue: [],
      spawnTimer: 0.7,
      gold: CONFIG.startGold,
      skillTimer: 0,
      paused: false,
      ended: false,
      hand: [],
      towers: [],
      enemies: [],
      shots: [],
      floaters: [],
      nextId: 1,
      pointer: {
        active: false,
        dragging: false,
        cardIndex: -1,
        selectedIndex: -1,
        x: 0,
        y: 0,
        startX: 0,
        startY: 0,
      },
      message: {
        title: "守城开始",
        text: "拖卡到高地建塔，挡住沿路来攻的敌兵。",
      },
      messageTime: 0,
    });
    drawCard("bow");
    drawCard("spear");
    drawCard("shield");
    startWave(1);
    els.pauseBtn.textContent = "Ⅱ";
    if (els.resultDialog.open) els.resultDialog.close();
    renderHud();
  }

  function loop(now) {
    const dt = Math.min(0.05, (now - lastFrame || 16) / 1000);
    lastFrame = now;
    resizeCanvas();
    if (!state.paused && !state.ended) update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function resizeCanvas() {
    const rect = els.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (els.canvas.width !== width || els.canvas.height !== height) {
      els.canvas.width = width;
      els.canvas.height = height;
    }
    ctx.setTransform(width / 390, 0, 0, height / 640, 0, 0);
    layout = buildLayout();
  }

  function buildLayout() {
    const path = [
      { x: 195, y: 36 },
      { x: 195, y: 105 },
      { x: 92, y: 158 },
      { x: 94, y: 246 },
      { x: 288, y: 274 },
      { x: 288, y: 368 },
      { x: 150, y: 420 },
      { x: 150, y: 500 },
      { x: 195, y: 528 },
    ];

    return {
      path,
      pathLength: pathLength(path),
      slots: [
        { id: "s1", x: 116, y: 118 },
        { id: "s2", x: 220, y: 158 },
        { id: "s3", x: 72, y: 228 },
        { id: "s4", x: 314, y: 338 },
        { id: "s5", x: 226, y: 442 },
        { id: "s6", x: 93, y: 472 },
      ],
      cards: [
        { x: 18, y: 552, w: 112, h: 74 },
        { x: 139, y: 552, w: 112, h: 74 },
        { x: 260, y: 552, w: 112, h: 74 },
      ],
      skill: { x: 278, y: 14, w: 82, h: 34 },
      gate: { x: 195, y: 32 },
      base: { x: 195, y: 520 },
    };
  }

  function update(dt) {
    state.elapsed += dt;

    state.drawTimer += dt;
    if (state.drawTimer >= CONFIG.drawEvery) {
      state.drawTimer = 0;
      if (state.hand.length < CONFIG.handMax) {
        drawCard();
        if (state.elapsed - state.messageTime > 1.4) setMessage("抽到塔牌", "新塔牌入手，拖到空高地建塔。");
      }
    }

    updateSpawning(dt);
    state.skillTimer = Math.max(0, state.skillTimer - dt);
    updateEnemies(dt);
    updateTowers(dt);
    updateShots(dt);
    updateFloaters(dt);
    maybeStartNextWave(dt);
    renderHud();
  }

  function startWave(wave) {
    state.wave = wave;
    state.spawnQueue = makeWave(wave);
    state.spawnTimer = 0.5;
    setMessage(`第 ${wave} 波`, "敌兵从上方入口来攻，守住城门。");
  }

  function makeWave(wave) {
    const queue = [];
    const gruntCount = 5 + wave * 2;
    for (let i = 0; i < gruntCount; i += 1) queue.push("grunt");
    if (wave >= 2) for (let i = 0; i < 2 + wave; i += 1) queue.push("runner");
    if (wave >= 3) for (let i = 0; i < wave - 1; i += 1) queue.push("brute");
    return shuffle(queue);
  }

  function updateSpawning(dt) {
    if (!state.spawnQueue.length) return;
    state.spawnTimer -= dt;
    if (state.spawnTimer > 0) return;
    spawnEnemy(state.spawnQueue.shift());
    state.spawnTimer = Math.max(0.42, 0.92 - state.wave * 0.04);
  }

  function spawnEnemy(type) {
    const p = layout.path[0];
    const base = ENEMIES[type];
    const hpBoost = 1 + (state.wave - 1) * 0.12;
    state.enemies.push({
      id: state.nextId++,
      type,
      hp: Math.round(base.hp * hpBoost),
      maxHp: Math.round(base.hp * hpBoost),
      progress: 0,
      x: p.x,
      y: p.y,
      wobble: Math.random() * Math.PI,
      slowFactor: 1,
      slowTimer: 0,
    });
  }

  function updateEnemies(dt) {
    for (const enemy of state.enemies) {
      const data = ENEMIES[enemy.type];
      enemy.slowTimer = Math.max(0, enemy.slowTimer - dt);
      enemy.slowFactor = enemy.slowTimer > 0 ? enemy.slowFactor : 1;
      enemy.progress += (data.speed * enemy.slowFactor * dt) / layout.pathLength;
      const p = pointAt(layout.path, enemy.progress);
      enemy.x = p.x;
      enemy.y = p.y;
      enemy.wobble += dt * 9;

      if (enemy.progress >= 1) {
        state.baseHp = Math.max(0, state.baseHp - data.damage);
        state.floaters.push({ x: layout.base.x, y: layout.base.y - 18, text: `城门 -${data.damage}`, t: 0, color: "#ffe1d6" });
        setMessage("城门受击", `${data.label} 冲到城下，补塔守住后续路线。`);
        enemy.dead = true;
      }
    }
    state.enemies = state.enemies.filter((enemy) => !enemy.dead && enemy.hp > 0);

    if (state.baseHp <= 0) endGame(false);
  }

  function updateTowers(dt) {
    for (const tower of state.towers) {
      tower.cooldown -= dt;
      if (tower.cooldown > 0) continue;

      const data = towerStats(tower);
      const target = pickTarget(tower, data.range);
      if (!target) continue;

      target.hp -= data.damage;
      if (data.slow) {
        target.slowFactor = Math.min(target.slowFactor, data.slow);
        target.slowTimer = Math.max(target.slowTimer, data.slowTime);
      }
      tower.cooldown = data.rate;
      state.shots.push({
        x: tower.x,
        y: tower.y,
        tx: target.x,
        ty: target.y,
        type: tower.type,
        t: 0,
        duration: tower.type === "bow" ? 0.18 : 0.12,
      });
      if (target.hp <= 0) {
        state.gold += target.type === "brute" ? 2 : 1;
        state.floaters.push({ x: target.x, y: target.y, text: "击退", t: 0, color: "#fff8ea" });
      } else if (data.slow) {
        state.floaters.push({ x: target.x, y: target.y, text: "减速", t: 0, color: "#dbe8ff" });
      }
    }
  }

  function pickTarget(tower, range) {
    let best = null;
    let bestProgress = -1;
    for (const enemy of state.enemies) {
      const dist = Math.hypot(enemy.x - tower.x, enemy.y - tower.y);
      if (dist <= range && enemy.progress > bestProgress) {
        best = enemy;
        bestProgress = enemy.progress;
      }
    }
    return best;
  }

  function updateShots(dt) {
    for (const shot of state.shots) shot.t += dt / shot.duration;
    state.shots = state.shots.filter((shot) => shot.t < 1);
  }

  function updateFloaters(dt) {
    for (const floater of state.floaters) floater.t += dt;
    state.floaters = state.floaters.filter((floater) => floater.t < 1);
  }

  function maybeStartNextWave(dt) {
    if (state.spawnQueue.length || state.enemies.length) return;
    if (state.wave >= CONFIG.maxWave) {
      endGame(true);
      return;
    }
    state.nextWaveTimer += dt;
    if (state.nextWaveTimer >= CONFIG.waveBreak) {
      state.nextWaveTimer = 0;
      startWave(state.wave + 1);
    }
  }

  function drawCard(forceType) {
    if (state.hand.length >= CONFIG.handMax) return false;
    const type = forceType || CARD_ORDER[Math.floor(Math.random() * CARD_ORDER.length)];
    state.hand.push({ id: state.nextId++, type });
    return true;
  }

  function buildTower(type, slot) {
    state.towers.push({
      id: state.nextId++,
      type,
      slotId: slot.id,
      x: slot.x,
      y: slot.y,
      cooldown: 0.2,
      level: 1,
    });
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

  function towerAtPoint(x, y) {
    return state.towers.find((tower) => Math.hypot(tower.x - x, tower.y - y) <= 28);
  }

  function upgradeTower(tower) {
    const level = tower.level || 1;
    if (level >= 3) {
      setMessage("已满级", `${TOWERS[tower.type].label} 已经升到 3 级。`);
      return false;
    }
    const cost = 3 + level * 2;
    if (state.gold < cost) {
      setMessage("军资不足", `升级需要 ${cost} 军资，击退敌兵可以获得军资。`);
      return false;
    }
    state.gold -= cost;
    tower.level = level + 1;
    tower.cooldown = 0;
    state.floaters.push({ x: tower.x, y: tower.y - 18, text: `升 ${tower.level}`, t: 0, color: "#fff1bf" });
    setMessage("塔已升级", `${TOWERS[tower.type].label} 升到 ${tower.level} 级，火力和射程提升。`);
    return true;
  }

  function useSkill() {
    if (state.skillTimer > 0) {
      setMessage("齐射冷却", `${Math.ceil(state.skillTimer)} 秒后可以再次齐射。`);
      return false;
    }
    if (!state.towers.length) {
      setMessage("还没有塔", "先把塔牌拖到高地，再使用齐射。");
      return false;
    }
    for (const tower of state.towers) tower.cooldown = 0;
    state.skillTimer = CONFIG.skillCooldown;
    state.floaters.push({ x: 320, y: 52, text: "齐射", t: 0, color: "#fff1bf" });
    setMessage("齐射号令", "所有塔立刻准备开火，用来救急或抢清怪。");
    return true;
  }

  function onPointerDown(event) {
    if (state.paused || state.ended) return;
    const point = eventPoint(event);
    const cardIndex = cardIndexAt(point.x, point.y);
    state.pointer.active = true;
    state.pointer.dragging = false;
    state.pointer.cardIndex = cardIndex;
    state.pointer.x = point.x;
    state.pointer.y = point.y;
    state.pointer.startX = point.x;
    state.pointer.startY = point.y;

    if (rectContains(layout.skill, point.x, point.y)) {
      useSkill();
      state.pointer.active = false;
      return;
    }

    const tower = towerAtPoint(point.x, point.y);
    if (tower) {
      upgradeTower(tower);
      state.pointer.active = false;
      return;
    }

    if (cardIndex >= 0) {
      els.canvas.setPointerCapture(event.pointerId);
    } else if (state.pointer.selectedIndex >= 0) {
      useCardAt(state.pointer.selectedIndex, point.x, point.y);
    }
  }

  function onPointerMove(event) {
    if (!state.pointer.active) return;
    const point = eventPoint(event);
    state.pointer.x = point.x;
    state.pointer.y = point.y;
    if (state.pointer.cardIndex >= 0 && Math.hypot(point.x - state.pointer.startX, point.y - state.pointer.startY) > 6) {
      state.pointer.dragging = true;
    }
  }

  function onPointerUp(event) {
    if (!state.pointer.active) return;
    const point = eventPoint(event);
    state.pointer.x = point.x;
    state.pointer.y = point.y;

    if (state.pointer.cardIndex >= 0) {
      if (state.pointer.dragging) {
        useCardAt(state.pointer.cardIndex, point.x, point.y);
      } else {
        state.pointer.selectedIndex = state.pointer.cardIndex;
        const card = state.hand[state.pointer.cardIndex];
        if (card) setMessage("选中塔牌", `${TOWERS[card.type].label}：点空高地建塔。`);
      }
    }

    state.pointer.active = false;
    state.pointer.dragging = false;
    state.pointer.cardIndex = -1;
    try {
      els.canvas.releasePointerCapture(event.pointerId);
    } catch (_) {
      // Pointer may not be captured when tapping outside cards.
    }
  }

  function cancelPointer() {
    state.pointer.active = false;
    state.pointer.dragging = false;
    state.pointer.cardIndex = -1;
  }

  function useCardAt(index, x, y) {
    const card = state.hand[index];
    if (!card) return false;
    const slot = nearestSlot(x, y);
    if (!slot) {
      setMessage("没有高地", "塔牌只能放到发亮的高地上。");
      return false;
    }
    if (towerAtSlot(slot.id)) {
      setMessage("高地已占", "这块高地已经有塔，换一个位置。");
      return false;
    }

    buildTower(card.type, slot);
    state.hand.splice(index, 1);
    state.pointer.selectedIndex = -1;
    state.drawTimer = Math.min(state.drawTimer, CONFIG.drawEvery - 0.4);
    setMessage("建塔完成", `${TOWERS[card.type].label} 已上高地，开始守路。`);
    return true;
  }

  function nearestSlot(x, y) {
    let best = null;
    let bestDist = Infinity;
    for (const slot of layout.slots) {
      const dist = Math.hypot(slot.x - x, slot.y - y);
      if (dist < bestDist) {
        best = slot;
        bestDist = dist;
      }
    }
    return bestDist <= 34 ? best : null;
  }

  function towerAtSlot(slotId) {
    return state.towers.find((tower) => tower.slotId === slotId);
  }

  function cardIndexAt(x, y) {
    for (let i = 0; i < state.hand.length; i += 1) {
      if (rectContains(layout.cards[i], x, y)) return i;
    }
    return -1;
  }

  function eventPoint(event) {
    const rect = els.canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 390,
      y: ((event.clientY - rect.top) / rect.height) * 640,
    };
  }

  function renderHud() {
    els.enemyHp.textContent = state.spawnQueue.length + state.enemies.length;
    els.playerHp.textContent = state.baseHp;
    els.wave.textContent = `${state.wave}/${CONFIG.maxWave}`;
    els.timer.textContent = state.gold;
    els.messageTitle.textContent = state.message.title;
    els.messageText.textContent = state.message.text;
  }

  function setMessage(title, text) {
    state.message = { title, text };
    state.messageTime = state.elapsed;
  }

  function endGame(win) {
    if (state.ended) return;
    state.ended = true;
    els.resultTitle.textContent = win ? "守城成功" : "城门失守";
    els.resultText.textContent = win
      ? "你守住了所有波次。下一步可以在这个底座上升级玩法。"
      : "敌兵攻破城门。下一局试试先补弓塔或盾塔。";
    if (typeof els.resultDialog.showModal === "function") els.resultDialog.showModal();
  }

  function draw() {
    ctx.clearRect(0, 0, 390, 640);
    drawBackground();
    drawPath();
    drawSlots();
    drawCastles();
    drawSkillButton();
    drawTowers();
    drawEnemies();
    drawShots();
    drawFloaters();
    drawHand();
    if (state.paused) drawOverlay("暂停中");
    if (state.pointer.dragging && state.pointer.cardIndex >= 0) {
      const card = state.hand[state.pointer.cardIndex];
      if (card) drawCardFace(state.pointer.x - 43, state.pointer.y - 30, 86, 60, card.type, true);
    }
  }

  function drawBackground() {
    const grd = ctx.createLinearGradient(0, 0, 0, 640);
    grd.addColorStop(0, "#c6d3b9");
    grd.addColorStop(0.55, "#91af76");
    grd.addColorStop(1, "#d8bf80");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 390, 640);

    ctx.fillStyle = "rgba(255, 248, 234, 0.78)";
    ctx.font = "800 13px Microsoft YaHei, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("敌兵入口", 195, 76);
    ctx.fillText("我方城门", 195, 492);
  }

  function drawPath() {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(80, 62, 38, 0.62)";
    ctx.lineWidth = 48;
    strokePath(layout.path);
    ctx.strokeStyle = "#d8c59e";
    ctx.lineWidth = 36;
    strokePath(layout.path);
    ctx.strokeStyle = "rgba(255, 248, 234, 0.36)";
    ctx.lineWidth = 4;
    strokePath(layout.path);

    for (let i = 1; i < layout.path.length - 1; i += 2) {
      drawArrow(layout.path[i].x, layout.path[i].y, "#875238");
    }
  }

  function drawSlots() {
    for (const slot of layout.slots) {
      const occupied = Boolean(towerAtSlot(slot.id));
      ctx.fillStyle = occupied ? "rgba(49, 40, 28, 0.18)" : "rgba(235, 246, 210, 0.82)";
      ctx.strokeStyle = occupied ? "rgba(55, 44, 30, 0.45)" : "#426a4b";
      ctx.lineWidth = occupied ? 1.5 : 2.5;
      ctx.beginPath();
      ctx.ellipse(slot.x, slot.y, 30, 23, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (!occupied) {
        ctx.fillStyle = "#285940";
        ctx.font = "800 11px Microsoft YaHei, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("高地", slot.x, slot.y + 4);
      }
    }
  }

  function drawCastles() {
    drawGate(layout.gate.x, layout.gate.y, "enemy");
    drawGate(layout.base.x, layout.base.y, "player");
  }

  function drawGate(x, y, side) {
    const isEnemy = side === "enemy";
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = isEnemy ? "#b95242" : "#3f8463";
    ctx.strokeStyle = isEnemy ? "#7f3028" : "#285940";
    ctx.lineWidth = 2;
    roundedRect(-54, -16, 108, 34, 7);
    ctx.fill();
    ctx.stroke();
    for (let i = -36; i <= 36; i += 18) {
      ctx.fillRect(i, -27, 12, 13);
      ctx.strokeRect(i, -27, 12, 13);
    }
    ctx.fillStyle = "#fff8ea";
    ctx.textAlign = "center";
    ctx.font = "800 13px Microsoft YaHei, sans-serif";
    ctx.fillText(isEnemy ? "敌营" : "城门", 0, 5);
    ctx.restore();
  }

  function drawTowers() {
    for (const tower of state.towers) drawTower(tower.x, tower.y, tower.type, tower.level || 1);
  }

  function drawTower(x, y, type, level) {
    const data = TOWERS[type];
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#f3dc95";
    ctx.strokeStyle = "#285940";
    ctx.lineWidth = 2;
    roundedRect(-14, -18, 28, 32, 5);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = data.dark;
    ctx.fillStyle = data.color;
    ctx.lineWidth = 2.5;
    if (type === "shield") {
      roundedRect(-10, -8, 20, 18, 4);
      ctx.fill();
      ctx.stroke();
    } else if (type === "spear") {
      ctx.beginPath();
      ctx.moveTo(-11, 11);
      ctx.lineTo(14, -15);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(18, -20);
      ctx.lineTo(10, -14);
      ctx.lineTo(17, -9);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(0, -2, 14, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -16);
      ctx.lineTo(0, 12);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = "#fff8ea";
    ctx.strokeStyle = "rgba(35, 48, 41, 0.65)";
    ctx.lineWidth = 2;
    ctx.font = "800 10px Microsoft YaHei, sans-serif";
    ctx.textAlign = "center";
    ctx.strokeText(`Lv${level}`, x, y + 28);
    ctx.fillText(`Lv${level}`, x, y + 28);
  }

  function drawSkillButton() {
    const rect = layout.skill;
    const ready = state.skillTimer <= 0;
    ctx.fillStyle = ready ? "rgba(255, 248, 234, 0.95)" : "rgba(235, 228, 210, 0.82)";
    roundedRect(rect.x, rect.y, rect.w, rect.h, 8);
    ctx.fill();
    ctx.strokeStyle = ready ? "#285940" : "rgba(102, 115, 109, 0.55)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = ready ? "#285940" : "#66736d";
    ctx.font = "800 14px Microsoft YaHei, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(ready ? "齐射" : `${Math.ceil(state.skillTimer)}s`, rect.x + rect.w / 2, rect.y + 22);
  }

  function drawEnemies() {
    for (const enemy of [...state.enemies].sort((a, b) => a.y - b.y)) {
      if (enemy.slowTimer > 0) drawSlowRing(enemy.x, enemy.y);
      drawEnemy(enemy.x + Math.sin(enemy.wobble) * 2, enemy.y, enemy.type);
      drawHpBar(enemy.x, enemy.y + 16, enemy.hp / enemy.maxHp);
    }
  }

  function drawSlowRing(x, y) {
    ctx.save();
    ctx.strokeStyle = "rgba(88, 125, 181, 0.72)";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.arc(x, y + 3, 17, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawEnemy(x, y, type) {
    const data = ENEMIES[type];
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(40, 27, 16, 0.18)";
    ctx.beginPath();
    ctx.ellipse(0, 13, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = data.color;
    ctx.strokeStyle = "#7f3028";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, -8, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, 4, type === "brute" ? 10 : 8, type === "brute" ? 12 : 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#6b3328";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(5, 7);
    ctx.lineTo(15, -7);
    ctx.stroke();
    ctx.restore();
  }

  function drawShots() {
    for (const shot of state.shots) {
      const t = easeOut(shot.t);
      const x = lerp(shot.x, shot.tx, t);
      const y = lerp(shot.y, shot.ty, t);
      ctx.strokeStyle = TOWERS[shot.type].dark;
      ctx.lineWidth = shot.type === "bow" ? 2 : 4;
      ctx.beginPath();
      ctx.moveTo(shot.x, shot.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.fillStyle = TOWERS[shot.type].color;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawFloaters() {
    ctx.textAlign = "center";
    for (const floater of state.floaters) {
      ctx.save();
      ctx.globalAlpha = 1 - floater.t;
      ctx.fillStyle = floater.color;
      ctx.strokeStyle = "rgba(34, 25, 16, 0.82)";
      ctx.lineWidth = 3;
      ctx.font = "800 14px Microsoft YaHei, sans-serif";
      const y = floater.y - floater.t * 24;
      ctx.strokeText(floater.text, floater.x, y);
      ctx.fillText(floater.text, floater.x, y);
      ctx.restore();
    }
  }

  function drawHand() {
    ctx.fillStyle = "rgba(255, 248, 234, 0.95)";
    roundedRect(10, 544, 370, 90, 10);
    ctx.fill();
    ctx.strokeStyle = "rgba(118, 91, 49, 0.25)";
    ctx.stroke();

    for (let i = 0; i < CONFIG.handMax; i += 1) {
      const rect = layout.cards[i];
      const card = state.hand[i];
      if (card) {
        const selected = state.pointer.selectedIndex === i || (state.pointer.dragging && state.pointer.cardIndex === i);
        drawCardFace(rect.x, rect.y, rect.w, rect.h, card.type, selected);
      } else {
        drawEmptyCard(rect);
      }
    }
  }

  function drawCardFace(x, y, w, h, type, selected) {
    const data = TOWERS[type];
    ctx.fillStyle = selected ? "#fff1bf" : "#fffdf7";
    roundedRect(x, y, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = selected ? "#d59b31" : "rgba(118, 91, 49, 0.34)";
    ctx.lineWidth = selected ? 3 : 2;
    ctx.stroke();

    ctx.fillStyle = data.dark;
    ctx.font = "800 18px Microsoft YaHei, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(data.card, x + w / 2, y + 23);
    drawMiniWeapon(x + w / 2, y + 42, type);
    ctx.fillStyle = "#66736d";
    ctx.font = "11px Microsoft YaHei, sans-serif";
    ctx.fillText(`${data.label}/${data.hint}`, x + w / 2, y + 65);
  }

  function drawEmptyCard(rect) {
    ctx.fillStyle = "rgba(255, 253, 247, 0.68)";
    roundedRect(rect.x, rect.y, rect.w, rect.h, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(118, 91, 49, 0.18)";
    ctx.stroke();
    const remain = Math.max(0, Math.ceil(CONFIG.drawEvery - state.drawTimer));
    ctx.fillStyle = "#66736d";
    ctx.font = "800 16px Microsoft YaHei, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${remain}s`, rect.x + rect.w / 2, rect.y + 43);
  }

  function drawMiniWeapon(x, y, type) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = TOWERS[type].dark;
    ctx.fillStyle = TOWERS[type].color;
    ctx.lineWidth = 2;
    if (type === "shield") {
      roundedRect(-10, -10, 20, 20, 5);
      ctx.fill();
      ctx.stroke();
    } else if (type === "spear") {
      ctx.beginPath();
      ctx.moveTo(-14, 12);
      ctx.lineTo(12, -12);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(16, -16);
      ctx.lineTo(8, -11);
      ctx.lineTo(14, -6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, 16, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -16);
      ctx.lineTo(0, 16);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawHpBar(x, y, ratio) {
    ctx.fillStyle = "rgba(35, 48, 41, 0.3)";
    roundedRect(x - 12, y, 24, 4, 2);
    ctx.fill();
    ctx.fillStyle = ratio > 0.45 ? "#69a665" : "#c45b4a";
    roundedRect(x - 12, y, 24 * clamp(ratio, 0, 1), 4, 2);
    ctx.fill();
  }

  function drawOverlay(text) {
    ctx.fillStyle = "rgba(30, 24, 18, 0.35)";
    ctx.fillRect(0, 0, 390, 640);
    ctx.fillStyle = "#fff8ea";
    ctx.font = "800 34px Microsoft YaHei, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(text, 195, 320);
  }

  function drawArrow(x, y, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 13);
    ctx.lineTo(9, -7);
    ctx.lineTo(0, -3);
    ctx.lineTo(-9, -7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function strokePath(path) {
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i += 1) ctx.lineTo(path[i].x, path[i].y);
    ctx.stroke();
  }

  function pathLength(path) {
    let len = 0;
    for (let i = 1; i < path.length; i += 1) {
      len += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    }
    return len;
  }

  function pointAt(path, progress) {
    const target = clamp(progress, 0, 1) * pathLength(path);
    let walked = 0;
    for (let i = 1; i < path.length; i += 1) {
      const a = path[i - 1];
      const b = path[i];
      const seg = Math.hypot(b.x - a.x, b.y - a.y);
      if (walked + seg >= target) {
        const t = (target - walked) / seg;
        return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
      }
      walked += seg;
    }
    return path[path.length - 1];
  }

  function rectContains(rect, x, y) {
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  }

  function roundedRect(x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function shuffle(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function easeOut(t) {
    return 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  init();
})();
