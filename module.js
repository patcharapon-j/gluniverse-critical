const MODULE_ID = "gluniverse-critical";
const SOCKET_CHANNEL = `module.${MODULE_ID}`;
const FLAG_SCOPE = MODULE_ID;
const SCHEMA_VERSION = 2;
const DURATION_MIN_MS = 600;
const DURATION_MAX_MS = 3e3;
const DURATION_DEFAULT_MS = 1e3;
const EASE_IN_FRACTION = 0.15;
const EASE_OUT_FRACTION = 0.2;
const QUEUE_MAX = 3;
const DEDUPE_WINDOW_MS = 500;
const OVERLAY_Z_INDEX = 99999;
const OVERLAY_CONTAINER_ID = `${MODULE_ID}-overlay`;
const SETTINGS = {
  GM_AVATAR: "gmAvatar",
  PC_CRITICAL_SFX: "pcCriticalSfx",
  GM_CRITICAL_SFX: "gmCriticalSfx",
  CINEMATIC_DURATION: "cinematicDuration",
  TRIGGER_MODE: "triggerMode",
  ENABLE_SKILL_CRITS: "enableSkillCrits",
  ENABLE_PERCEPTION_CRITS: "enablePerceptionCrits",
  ALLOW_PLAYER_OPT_OUT: "allowPlayerOptOut",
  SHOW_CINEMATICS: "showCinematics",
  AUDIO_ENABLED: "audioEnabled",
  VOLUME: "volume"
};
const TRIGGER_MODES = {
  PF2E_DEGREE_OF_SUCCESS: "pf2e",
  NAT20_ONLY: "nat20"
};
const ACTOR_FLAGS = {
  SCHEMA_VERSION: "schemaVersion",
  ENABLED: "enabled",
  PORTRAIT_OVERRIDE: "portraitOverride"
};
const LEGACY_ACTOR_FLAG_KEYS = [
  "templateSlug",
  "colorPrimary",
  "colorAccent",
  "colorBg"
];
const PF2E_SYSTEM_ID$1 = "pf2e";
let app = null;
let container = null;
let resizeHandler = null;
function mountOverlay() {
  if (app) return;
  if (typeof PIXI === "undefined") {
    console.warn(`${MODULE_ID} | PIXI not available on globalThis; overlay not mounted.`);
    return;
  }
  container = document.createElement("div");
  container.id = OVERLAY_CONTAINER_ID;
  Object.assign(container.style, {
    position: "fixed",
    inset: "0",
    pointerEvents: "none",
    zIndex: String(OVERLAY_Z_INDEX)
  });
  document.body.appendChild(container);
  app = new PIXI.Application({
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundAlpha: 0,
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1
  });
  container.appendChild(app.view);
  app.stop();
  resizeHandler = () => {
    if (!app) return;
    app.renderer.resize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener("resize", resizeHandler);
}
function getOverlayApp() {
  return app;
}
class GMConfigMenu extends FormApplication {
  static get defaultOptions() {
    return {
      ...FormApplication.defaultOptions,
      id: `${MODULE_ID}-gm-config`,
      title: "GLUniverse Critical — GM Configuration",
      template: `modules/${MODULE_ID}/templates/gm-config.html`,
      width: 520,
      height: "auto",
      closeOnSubmit: true,
      submitOnChange: false
    };
  }
  getData() {
    return {
      data: {
        gmAvatar: getSetting(SETTINGS.GM_AVATAR),
        pcCriticalSfx: getSetting(SETTINGS.PC_CRITICAL_SFX),
        gmCriticalSfx: getSetting(SETTINGS.GM_CRITICAL_SFX),
        cinematicDuration: getSetting(SETTINGS.CINEMATIC_DURATION)
      },
      durationMin: DURATION_MIN_MS,
      durationMax: DURATION_MAX_MS
    };
  }
  async _updateObject(_event, formData) {
    await Promise.all([
      setSetting(SETTINGS.GM_AVATAR, String(formData.gmAvatar ?? "")),
      setSetting(SETTINGS.PC_CRITICAL_SFX, String(formData.pcCriticalSfx ?? "")),
      setSetting(SETTINGS.GM_CRITICAL_SFX, String(formData.gmCriticalSfx ?? "")),
      setSetting(SETTINGS.CINEMATIC_DURATION, Number(formData.cinematicDuration))
    ]);
  }
}
function registerSettings() {
  game.settings.registerMenu(MODULE_ID, "gmConfigMenu", {
    name: "GLUC.Settings.MenuName",
    label: "GLUC.Settings.MenuLabel",
    hint: "GLUC.Settings.MenuHint",
    icon: "fas fa-cog",
    type: GMConfigMenu,
    restricted: true
  });
  game.settings.register(MODULE_ID, SETTINGS.GM_AVATAR, {
    name: "GLUC.Settings.GMAvatar",
    hint: "GLUC.Settings.GMAvatarHint",
    scope: "world",
    config: false,
    type: String,
    default: ""
  });
  game.settings.register(MODULE_ID, SETTINGS.PC_CRITICAL_SFX, {
    name: "GLUC.Settings.PCCriticalSFX",
    hint: "GLUC.Settings.PCCriticalSFXHint",
    scope: "world",
    config: false,
    type: String,
    default: ""
  });
  game.settings.register(MODULE_ID, SETTINGS.GM_CRITICAL_SFX, {
    name: "GLUC.Settings.GMCriticalSFX",
    hint: "GLUC.Settings.GMCriticalSFXHint",
    scope: "world",
    config: false,
    type: String,
    default: ""
  });
  game.settings.register(MODULE_ID, SETTINGS.CINEMATIC_DURATION, {
    name: "GLUC.Settings.CinematicDuration",
    hint: "GLUC.Settings.CinematicDurationHint",
    scope: "world",
    config: false,
    type: Number,
    default: DURATION_DEFAULT_MS,
    range: { min: DURATION_MIN_MS, max: DURATION_MAX_MS, step: 50 }
  });
  game.settings.register(MODULE_ID, SETTINGS.TRIGGER_MODE, {
    name: "GLUC.Settings.TriggerMode",
    hint: "GLUC.Settings.TriggerModeHint",
    scope: "world",
    config: true,
    type: String,
    choices: {
      [TRIGGER_MODES.PF2E_DEGREE_OF_SUCCESS]: "GLUC.Settings.TriggerModeChoicePF2e",
      [TRIGGER_MODES.NAT20_ONLY]: "GLUC.Settings.TriggerModeChoiceNat20"
    },
    default: TRIGGER_MODES.PF2E_DEGREE_OF_SUCCESS
  });
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_SKILL_CRITS, {
    name: "GLUC.Settings.EnableSkillCrits",
    hint: "GLUC.Settings.EnableSkillCritsHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_PERCEPTION_CRITS, {
    name: "GLUC.Settings.EnablePerceptionCrits",
    hint: "GLUC.Settings.EnablePerceptionCritsHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });
  game.settings.register(MODULE_ID, SETTINGS.ALLOW_PLAYER_OPT_OUT, {
    name: "GLUC.Settings.AllowPlayerOptOut",
    hint: "GLUC.Settings.AllowPlayerOptOutHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
  game.settings.register(MODULE_ID, SETTINGS.SHOW_CINEMATICS, {
    name: "GLUC.Settings.ShowCinematics",
    hint: "GLUC.Settings.ShowCinematicsHint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });
  game.settings.register(MODULE_ID, SETTINGS.AUDIO_ENABLED, {
    name: "GLUC.Settings.AudioEnabled",
    hint: "GLUC.Settings.AudioEnabledHint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });
  game.settings.register(MODULE_ID, SETTINGS.VOLUME, {
    name: "GLUC.Settings.Volume",
    hint: "GLUC.Settings.VolumeHint",
    scope: "client",
    config: true,
    type: Number,
    default: 0.8,
    range: { min: 0, max: 1, step: 0.05 }
  });
}
function getSetting(key) {
  return game.settings.get(MODULE_ID, key);
}
function setSetting(key, value) {
  return game.settings.set(MODULE_ID, key, value);
}
const audioCache = /* @__PURE__ */ new Map();
function playSfx(kind) {
  if (!getSetting(SETTINGS.AUDIO_ENABLED)) return;
  const path = getSetting(
    kind === "pc" ? SETTINGS.PC_CRITICAL_SFX : SETTINGS.GM_CRITICAL_SFX
  );
  if (!path) return;
  let el = audioCache.get(path);
  if (!el) {
    el = new Audio(path);
    el.preload = "auto";
    audioCache.set(path, el);
  }
  const volume = clamp01(getSetting(SETTINGS.VOLUME));
  const globalVolume = readGlobalInterfaceVolume();
  el.volume = clamp01(volume * globalVolume);
  el.currentTime = 0;
  el.play().catch((err) => {
    console.warn(`${MODULE_ID} | sfx play failed:`, err);
  });
}
function clamp01(n) {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
function readGlobalInterfaceVolume() {
  try {
    const v = game.settings.get("core", "globalInterfaceVolume");
    if (typeof v === "number") return clamp01(v);
  } catch {
  }
  return 1;
}
const FALLBACK_IMAGE$1 = "icons/svg/mystery-man.svg";
const BG_FADE_IN_FRACTION = 0.2;
const BG_FADE_OUT_FRACTION = 0.28;
const BG_PEAK_ALPHA = 0.85;
async function runCinematic(event) {
  const app2 = getOverlayApp();
  if (!app2) {
    console.warn(`${MODULE_ID} | no overlay app; skipping cinematic`);
    return;
  }
  const texture = await loadImage(event.imagePath);
  if (!texture) {
    console.warn(`${MODULE_ID} | could not load image:`, event.imagePath);
    return;
  }
  const stage = new PIXI.Container();
  app2.stage.addChild(stage);
  const { sw, sh } = screenSize();
  const backdrop = new PIXI.Graphics();
  backdrop.beginFill(0, 1).drawRect(0, 0, sw, sh).endFill();
  backdrop.alpha = 0;
  stage.addChild(backdrop);
  const sprite = new PIXI.Sprite(texture);
  sprite.anchor.set(0.5);
  sprite.position.set(sw * 0.5, sh * 0.5);
  const baseScale = aspectFitScale(texture, sw, sh);
  sprite.scale.set(baseScale);
  sprite.alpha = 0;
  stage.addChild(sprite);
  const tw = texture.baseTexture?.realWidth ?? texture.width ?? 0;
  const th = texture.baseTexture?.realHeight ?? texture.height ?? 0;
  const fitW = tw * baseScale;
  const fitH = th * baseScale;
  const mask = new PIXI.Graphics();
  stage.addChild(mask);
  sprite.mask = mask;
  const drawMask = (frac) => {
    const clamped = Math.max(0, Math.min(1, frac));
    const h = fitH * clamped;
    const x = sw * 0.5 - fitW * 0.5;
    const y = sh * 0.5 - h * 0.5;
    mask.clear().beginFill(16777215, 1).drawRect(x, y, fitW, h).endFill();
  };
  drawMask(0);
  playSfx(event.isPC ? "pc" : "gm");
  app2.start();
  const start = performance.now();
  await new Promise((resolve) => {
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / event.durationMs);
      const frame = animate(t);
      backdrop.alpha = frame.bgAlpha;
      sprite.alpha = frame.imgAlpha;
      sprite.scale.set(baseScale * frame.scaleMul);
      drawMask(frame.wipe);
      if (t >= 1) {
        app2.ticker.remove(tick);
        resolve();
      }
    };
    app2.ticker.add(tick);
  });
  sprite.mask = null;
  stage.removeChildren();
  app2.stage.removeChildren();
  sprite.destroy?.({ children: true });
  backdrop.destroy?.({ children: true });
  mask.destroy?.({ children: true });
  stage.destroy?.({ children: true });
  app2.stop();
}
const HOLD_DRIFT = 0.04;
const OUT_SCALE_BOOST = 0.16;
function animate(t) {
  let bgAlpha;
  if (t < BG_FADE_IN_FRACTION) {
    bgAlpha = easeOutCubic(t / BG_FADE_IN_FRACTION) * BG_PEAK_ALPHA;
  } else if (t > 1 - BG_FADE_OUT_FRACTION) {
    const k = (t - (1 - BG_FADE_OUT_FRACTION)) / BG_FADE_OUT_FRACTION;
    bgAlpha = BG_PEAK_ALPHA * (1 - easeInCubic(k));
  } else {
    bgAlpha = BG_PEAK_ALPHA;
  }
  let imgAlpha = 1;
  let scaleMul = 1;
  let wipe = 1;
  if (t < EASE_IN_FRACTION) {
    const k = t / EASE_IN_FRACTION;
    imgAlpha = easeOutCubic(k);
    scaleMul = 0.92 + 0.08 * easeOutQuint(k);
    wipe = easeOutQuart(k);
  } else if (t > 1 - EASE_OUT_FRACTION) {
    const k = (t - (1 - EASE_OUT_FRACTION)) / EASE_OUT_FRACTION;
    imgAlpha = 1 - easeInCubic(k);
    scaleMul = 1 + HOLD_DRIFT + OUT_SCALE_BOOST * easeOutCubic(k);
  } else {
    const holdLen = 1 - EASE_IN_FRACTION - EASE_OUT_FRACTION;
    const k = (t - EASE_IN_FRACTION) / holdLen;
    scaleMul = 1 + HOLD_DRIFT * easeInOutSine(k);
  }
  return { bgAlpha, imgAlpha, scaleMul, wipe };
}
function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}
function easeInCubic(t) {
  return t ** 3;
}
function easeOutQuart(t) {
  return 1 - (1 - t) ** 4;
}
function easeOutQuint(t) {
  return 1 - (1 - t) ** 5;
}
function easeInOutSine(t) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}
function screenSize() {
  return { sw: window.innerWidth, sh: window.innerHeight };
}
function aspectFitScale(texture, sw, sh) {
  const tw = texture.baseTexture?.realWidth ?? texture.width ?? 0;
  const th = texture.baseTexture?.realHeight ?? texture.height ?? 0;
  if (!tw || !th) return 1;
  return Math.min(sw / tw, sh / th);
}
async function loadImage(src) {
  try {
    const fromGlobal = globalThis.loadTexture;
    if (typeof fromGlobal === "function") {
      const t = await fromGlobal(src, { fallback: FALLBACK_IMAGE$1 });
      if (t) return t;
    }
    if (typeof PIXI?.Texture?.from === "function") {
      return PIXI.Texture.from(src);
    }
  } catch (err) {
    console.warn(`${MODULE_ID} | image load failed:`, src, err);
  }
  return null;
}
const queue = [];
const recentMessages = /* @__PURE__ */ new Map();
let playing = false;
function enqueue(event) {
  if (!getSetting(SETTINGS.SHOW_CINEMATICS)) return;
  const now = performance.now();
  const seen = recentMessages.get(event.messageId);
  if (seen !== void 0 && now - seen < DEDUPE_WINDOW_MS) return;
  recentMessages.set(event.messageId, now);
  pruneSeen(now);
  if (queue.length >= QUEUE_MAX) {
    const dropped = queue.shift();
    console.debug(`${MODULE_ID} | queue full, dropped:`, dropped?.event.messageId);
  }
  queue.push({ event, enqueuedAt: now });
  if (!playing) void drain();
}
async function drain() {
  if (playing) return;
  playing = true;
  try {
    while (queue.length > 0) {
      const slot = queue.shift();
      if (!slot) break;
      try {
        await runCinematic(slot.event);
      } catch (err) {
        console.error(`${MODULE_ID} | cinematic failed:`, err);
      }
    }
  } finally {
    playing = false;
  }
}
function pruneSeen(now) {
  for (const [id, ts] of recentMessages) {
    if (now - ts > DEDUPE_WINDOW_MS * 4) recentMessages.delete(id);
  }
}
const FALLBACK_IMAGE = "icons/svg/mystery-man.svg";
function resolveCritEvent(input) {
  const actor = game.actors.get(input.actorId);
  if (!actor) return null;
  return {
    messageId: input.messageId,
    actorId: input.actorId,
    actorName: actor.name ?? "Unknown",
    isPC: input.isPC,
    imagePath: resolveImage(actor, input.isPC),
    durationMs: getSetting(SETTINGS.CINEMATIC_DURATION),
    startTimestamp: Date.now(),
    originUserId: input.originUserId
  };
}
function resolveImage(actor, isPC) {
  const override = actor.getFlag(FLAG_SCOPE, ACTOR_FLAGS.PORTRAIT_OVERRIDE);
  if (override) return override;
  if (isPC) return actor.img ?? FALLBACK_IMAGE;
  const gmAvatar = getSetting(SETTINGS.GM_AVATAR);
  if (gmAvatar) return gmAvatar;
  return actor.img ?? FALLBACK_IMAGE;
}
function registerSockets() {
  game.socket.on(SOCKET_CHANNEL, (raw) => {
    const payload = raw;
    if (!payload || payload.type !== "critical") return;
    if (payload.event.originUserId === game.user.id) return;
    enqueue(payload.event);
  });
  console.debug(`${MODULE_ID} | socket listener registered on`, SOCKET_CHANNEL);
}
function broadcastCrit(event) {
  const payload = { type: "critical", event };
  game.socket.emit(SOCKET_CHANNEL, payload);
}
const SUPPORTED_ROLL_TYPES = /* @__PURE__ */ new Set([
  "attack-roll",
  "spell-attack-roll",
  "saving-throw",
  "skill-check",
  "perception-check"
]);
const HARD_BLOCK = /* @__PURE__ */ new Set(["flat-check", "damage-roll", "initiative"]);
const PF2E_SYSTEM_ID = "pf2e";
function detect(input) {
  if (input.systemId !== PF2E_SYSTEM_ID) return { fire: false, reason: "wrong-system" };
  if (input.rollMode === "blindroll" || input.blind) {
    return { fire: false, reason: "secret-or-blind-roll" };
  }
  if (!input.hasActor) return { fire: false, reason: "no-actor" };
  if (input.triggerMode === "nat20") {
    if (!input.nat20Detected) return { fire: false, reason: "not-nat20" };
    if (!input.actorHasPlayerOwner && !input.npcEnabled) {
      return { fire: false, reason: "npc-not-enabled" };
    }
    return { fire: true, reason: "nat20" };
  }
  if (!input.context) return { fire: false, reason: "no-context" };
  const type = input.context.type;
  if (!type) return { fire: false, reason: "no-context" };
  if (HARD_BLOCK.has(type)) {
    return {
      fire: false,
      reason: type === "flat-check" ? "flat-check-blocked" : "damage-or-initiative-blocked"
    };
  }
  if (!SUPPORTED_ROLL_TYPES.has(type)) {
    return { fire: false, reason: "unsupported-roll-type" };
  }
  if (input.context.outcome !== "criticalSuccess") {
    return { fire: false, reason: "not-critical-success" };
  }
  if (type === "skill-check" && !input.skillCritsEnabled) {
    return { fire: false, reason: "skill-crits-disabled" };
  }
  if (type === "perception-check" && !input.perceptionCritsEnabled) {
    return { fire: false, reason: "perception-crits-disabled" };
  }
  if (!input.actorHasPlayerOwner && !input.npcEnabled) {
    return { fire: false, reason: "npc-not-enabled" };
  }
  return { fire: true, reason: "pf2e-critical-success" };
}
function buildInputFromMessage(message) {
  const actorId = message.speaker?.actor;
  const actor = actorId ? game.actors.get(actorId) : void 0;
  return {
    systemId: game.system.id,
    context: message.flags?.pf2e?.context ?? null,
    rollMode: message.rollMode ?? "publicroll",
    whisperLength: message.whisper?.length ?? 0,
    blind: message.blind ?? false,
    hasActor: !!actor,
    actorHasPlayerOwner: actor?.hasPlayerOwner ?? false,
    npcEnabled: actor ? actor.getFlag(FLAG_SCOPE, ACTOR_FLAGS.ENABLED) ?? false : false,
    triggerMode: getSetting(SETTINGS.TRIGGER_MODE),
    nat20Detected: hasNat20Result(message),
    skillCritsEnabled: getSetting(SETTINGS.ENABLE_SKILL_CRITS),
    perceptionCritsEnabled: getSetting(SETTINGS.ENABLE_PERCEPTION_CRITS)
  };
}
function hasNat20Result(message) {
  const rolls = message.rolls;
  if (!Array.isArray(rolls)) return false;
  for (const roll of rolls) {
    const dice = roll.dice;
    if (!Array.isArray(dice)) continue;
    for (const die of dice) {
      if (die.faces !== 20) continue;
      const results = die.results ?? [];
      for (const r of results) {
        if (r.discarded === true) continue;
        if (r.active === false) continue;
        if (r.result === 20) return true;
      }
    }
  }
  return false;
}
let lastDiceSoNiceMessageId = null;
let lastDiceSoNiceTimestamp = 0;
function registerDetector() {
  const dsnActive = !!game.dice3d;
  if (dsnActive) {
    Hooks.on("diceSoNiceRollComplete", (messageId) => {
      lastDiceSoNiceMessageId = messageId;
      lastDiceSoNiceTimestamp = performance.now();
      const ChatMessage = globalThis.ChatMessage;
      const message = ChatMessage?.get(messageId);
      if (message) processMessage(message);
    });
  }
  Hooks.on("createChatMessage", (message) => {
    if (dsnActive && message.id && lastDiceSoNiceMessageId === message.id && performance.now() - lastDiceSoNiceTimestamp < 5e3) {
      return;
    }
    if (!dsnActive) processMessage(message);
  });
}
function messageAuthorId(message) {
  return message.author?.id ?? (typeof message.user === "string" ? message.user : message.user?.id);
}
function processMessage(message) {
  if (messageAuthorId(message) !== game.user.id) return;
  const input = buildInputFromMessage(message);
  const result = detect(input);
  if (!result.fire) {
    if (input.context?.outcome === "criticalSuccess" || input.nat20Detected) {
      console.debug(`${MODULE_ID} | crit suppressed:`, result.reason);
    }
    return;
  }
  const event = resolveCritEvent({
    messageId: message.id ?? `${Date.now()}-${Math.random()}`,
    actorId: message.speaker?.actor ?? "",
    isPC: input.actorHasPlayerOwner,
    originUserId: game.user.id
  });
  if (!event) return;
  enqueue(event);
  if (input.whisperLength === 0 && input.rollMode === "publicroll") {
    broadcastCrit(event);
  }
}
function readActorFlags(actor) {
  return {
    schemaVersion: actor.getFlag(FLAG_SCOPE, ACTOR_FLAGS.SCHEMA_VERSION) ?? 0,
    enabled: actor.getFlag(FLAG_SCOPE, ACTOR_FLAGS.ENABLED) ?? false,
    portraitOverride: actor.getFlag(FLAG_SCOPE, ACTOR_FLAGS.PORTRAIT_OVERRIDE) ?? null
  };
}
async function writeActorFlags(actor, patch) {
  const writes = [];
  if (patch.schemaVersion !== void 0) {
    writes.push(actor.setFlag(FLAG_SCOPE, ACTOR_FLAGS.SCHEMA_VERSION, patch.schemaVersion));
  }
  if (patch.enabled !== void 0) {
    writes.push(actor.setFlag(FLAG_SCOPE, ACTOR_FLAGS.ENABLED, patch.enabled));
  }
  if (patch.portraitOverride !== void 0) {
    writes.push(actor.setFlag(FLAG_SCOPE, ACTOR_FLAGS.PORTRAIT_OVERRIDE, patch.portraitOverride));
  }
  await Promise.all(writes);
}
function migrateActorFlags(actor) {
  const current = actor.getFlag(FLAG_SCOPE, ACTOR_FLAGS.SCHEMA_VERSION) ?? 0;
  if (current === SCHEMA_VERSION) return null;
  return (async () => {
    if (current < 2) {
      for (const key of LEGACY_ACTOR_FLAG_KEYS) {
        const v = actor.getFlag(FLAG_SCOPE, key);
        if (v !== void 0) await actor.unsetFlag(FLAG_SCOPE, key);
      }
    }
    await actor.setFlag(FLAG_SCOPE, ACTOR_FLAGS.SCHEMA_VERSION, SCHEMA_VERSION);
  })();
}
async function runMigrations() {
  const actors = game.actors?.contents ?? (game.actors?.values ? [...game.actors.values()] : []);
  if (!actors.length) return;
  const pending = [];
  for (const actor of actors) {
    const job = migrateActorFlags(actor);
    if (job) pending.push(job);
  }
  if (pending.length) {
    console.log(`${MODULE_ID} | Migrating ${pending.length} actor flag record(s)`);
    await Promise.all(pending);
  }
}
function createPublicAPI(version) {
  return {
    version,
    async triggerLocal(actorId) {
      const actor = game.actors.get(actorId);
      const isPC = actor?.hasPlayerOwner ?? true;
      const event = resolveCritEvent({
        messageId: `manual-${Date.now()}`,
        actorId,
        isPC,
        originUserId: game.user.id
      });
      if (!event) return;
      await runCinematic(event);
    }
  };
}
class ActorConfigModal extends FormApplication {
  static get defaultOptions() {
    return {
      ...FormApplication.defaultOptions,
      id: `${MODULE_ID}-actor-config`,
      template: `modules/${MODULE_ID}/templates/actor-config.html`,
      width: 480,
      height: "auto",
      closeOnSubmit: true,
      submitOnChange: false
    };
  }
  constructor(actor, options = {}) {
    super(actor, options);
  }
  get actor() {
    return this.object;
  }
  /**
   * Always operate on the world (base) actor, not a synthetic token-actor.
   * Synthetic actors write flags to the token's delta — those overrides
   * are invisible to the detector, which resolves speakers via
   * `game.actors.get(speaker.actor)` (always the base).
   */
  get baseActor() {
    const a = this.actor;
    return game.actors.get(a.id) ?? a;
  }
  get title() {
    const isNPC = !this.actor.hasPlayerOwner;
    const key = isNPC ? "GLUC.Actor.ModalTitleNPC" : "GLUC.Actor.ModalTitlePC";
    return game.i18n.format(key, { name: this.actor.name ?? "Actor" });
  }
  getData() {
    const flags = readActorFlags(this.baseActor);
    const isNPC = !this.actor.hasPlayerOwner;
    return {
      isNPC,
      isGM: game.user.isGM,
      data: {
        enabled: flags.enabled ?? false,
        portraitOverride: flags.portraitOverride ?? ""
      }
    };
  }
  activateListeners(html) {
    super.activateListeners(html);
    html.find(".gluc-test-button").on("click", () => {
      void this.runTest();
    });
  }
  async runTest() {
    const base = this.baseActor;
    const event = resolveCritEvent({
      messageId: `test-${Date.now()}`,
      actorId: base.id,
      isPC: base.hasPlayerOwner,
      originUserId: game.user.id
    });
    if (!event) return;
    try {
      await runCinematic(event);
    } catch (err) {
      console.error(`${MODULE_ID} | test cinematic failed:`, err);
    }
  }
  async _updateObject(_event, formData) {
    const base = this.baseActor;
    const isNPC = !base.hasPlayerOwner;
    const enabled = isNPC ? Boolean(formData.enabled) : true;
    await writeActorFlags(base, {
      enabled,
      portraitOverride: String(formData.portraitOverride ?? "") || null
    });
  }
}
function registerActorSheetHooks() {
  Hooks.on("getActorSheetHeaderButtons", (sheet, buttons) => {
    const actor = sheet.actor;
    if (!actor) return;
    const canOpen = actor.isOwner || game.user.isGM;
    if (!canOpen) return;
    buttons.unshift({
      label: "GLUC.Actor.HeaderButton",
      class: `${MODULE_ID}-header-btn`,
      icon: "fas fa-bolt",
      onclick: () => {
        new ActorConfigModal(actor).render(true);
      }
    });
  });
}
Hooks.once("init", () => {
  if (game.system.id !== PF2E_SYSTEM_ID$1) {
    console.warn(`${MODULE_ID} | Non-PF2e system detected (${game.system.id}). Module disabled.`);
    return;
  }
  console.log(`${MODULE_ID} | init`);
  registerSettings();
  const mod = game.modules.get(MODULE_ID);
  if (mod) {
    mod.api = createPublicAPI(mod.version);
  }
});
Hooks.once("ready", async () => {
  if (game.system.id !== PF2E_SYSTEM_ID$1) return;
  console.log(`${MODULE_ID} | ready`);
  await runMigrations();
  mountOverlay();
  registerSockets();
  registerDetector();
  registerActorSheetHooks();
});
//# sourceMappingURL=module.js.map
