const MODULE_ID = "gluniverse-critical";
const SOCKET_CHANNEL = `module.${MODULE_ID}`;
const FLAG_SCOPE = MODULE_ID;
const SCHEMA_VERSION = 2;
const DURATION_MIN_MS = 600;
const DURATION_MAX_MS = 3e3;
const DURATION_DEFAULT_MS = 1e3;
const EASE_IN_FRACTION = 0.15;
const EASE_OUT_FRACTION = 0.2;
const BREAK_FADE_IN_FRACTION = 0.22;
const BREAK_HOLD_FRACTION = 0.12;
const QUEUE_MAX = 3;
const DEDUPE_WINDOW_MS = 500;
const OVERLAY_Z_INDEX = 99999;
const OVERLAY_CONTAINER_ID = `${MODULE_ID}-overlay`;
const SETTINGS = {
  GM_AVATAR: "gmAvatar",
  PC_CRITICAL_SFX: "pcCriticalSfx",
  GM_CRITICAL_SFX: "gmCriticalSfx",
  CINEMATIC_DURATION: "cinematicDuration",
  ANIMATION_MODE: "animationMode",
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
const ANIMATION_MODES = {
  STANDARD: "standard",
  BREAK: "break"
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
const SHARD_VERT = `
precision highp float;

attribute vec2 a_pos;     // normalized quad position, [-1, 1]
attribute vec2 a_uv;      // [0, 1]
attribute vec2 a_center;  // shard centroid, [-1, 1]
attribute vec4 a_rand;    // per-shard random params

uniform mat4 u_proj;
uniform float u_halfW;    // world half-extents of the fitted quad
uniform float u_halfH;
uniform float u_depth;    // distance of the image plane in front of the camera
uniform float u_shatter;  // 0..1 shatter progress
uniform float u_scale;    // uniform zoom about the image center (standard punch)

varying vec2 v_uv;
varying float v_shardFade;

// Rodrigues rotation of v about a unit axis by angle.
vec3 rotateAxis(vec3 v, vec3 axis, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return v * c + cross(axis, v) * s + axis * dot(axis, v) * (1.0 - c);
}

void main() {
  vec3 P = vec3(a_pos * vec2(u_halfW, u_halfH), -u_depth);
  vec3 C = vec3(a_center * vec2(u_halfW, u_halfH), -u_depth);
  vec3 local = P - C; // offset of this vertex from its shard centroid

  v_shardFade = 1.0;

  if (u_shatter > 0.0) {
    float sh = u_shatter;
    // Tumble: rotate the shard about a per-shard axis.
    vec3 axis = normalize(vec3(a_rand.y - 0.5, a_rand.z - 0.5, 0.6));
    float angle = (a_rand.w - 0.5) * 9.0 * sh;
    local = rotateAxis(local, axis, sh * sh * angle);

    // Fly toward the viewer (+z), with outward radial spread and gravity.
    vec2 radial = normalize(a_center + vec2(a_rand.y - 0.5, a_rand.z - 0.5) * 0.5 + 0.0001);
    float towardZ = (2.4 + a_rand.x * 1.6) * u_depth * 0.45;
    vec3 disp = vec3(
      radial * (0.6 + a_rand.x * 0.7) * u_halfW * sh,
      towardZ * sh
    );
    disp.y -= sh * sh * 1.4 * u_halfH; // gravity
    C += disp;

    // Shards fade out as they pass the camera.
    v_shardFade = 1.0 - smoothstep(0.55, 1.0, sh);
  }

  vec3 world = C + local;
  world.xy *= u_scale;
  gl_Position = u_proj * vec4(world, 1.0);
  v_uv = a_uv;
}
`;
const SHARD_FRAG = `
precision highp float;

uniform sampler2D u_texture;
uniform float u_alpha;   // overall fade
uniform float u_wipe;    // centered vertical reveal, 0..1 (1 = full image)
uniform float u_flash;   // additive white pop at shatter start, 0..1

varying vec2 v_uv;
varying float v_shardFade;

void main() {
  // Centered vertical wipe used by standard mode.
  if (abs(v_uv.y - 0.5) > u_wipe * 0.5) discard;

  vec4 tex = texture2D(u_texture, v_uv);
  float a = tex.a * u_alpha * v_shardFade;
  if (a <= 0.001) discard;

  vec3 rgb = tex.rgb + u_flash;
  gl_FragColor = vec4(rgb, a);
}
`;
const BACKDROP_VERT = `
precision highp float;
attribute vec2 a_clip;
void main() {
  gl_Position = vec4(a_clip, 0.0, 1.0);
}
`;
const BACKDROP_FRAG = `
precision highp float;
uniform float u_alpha;
void main() {
  gl_FragColor = vec4(0.0, 0.0, 0.0, u_alpha);
}
`;
function hash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function buildShardMesh(cols, rows, jitter = 0.6) {
  const gw = cols + 1;
  const gh = rows + 1;
  const px = new Float32Array(gw * gh);
  const py = new Float32Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const i = gy * gw + gx;
      let nx = gx / cols;
      let ny = gy / rows;
      const interior = gx > 0 && gx < cols && gy > 0 && gy < rows;
      if (interior) {
        nx += (hash(gx, gy) - 0.5) * jitter / cols;
        ny += (hash(gx + 7.3, gy - 2.1) - 0.5) * jitter / rows;
      }
      px[i] = nx * 2 - 1;
      py[i] = ny * 2 - 1;
    }
  }
  const triCount = cols * rows * 2;
  const vCount = triCount * 3;
  const positions = new Float32Array(vCount * 2);
  const uvs = new Float32Array(vCount * 2);
  const centers = new Float32Array(vCount * 2);
  const rands = new Float32Array(vCount * 4);
  let v = 0;
  const emitTri = (ax, ay, bx, by, cx, cy, seedX, seedY) => {
    const cenX = (ax + bx + cx) / 3;
    const cenY = (ay + by + cy) / 3;
    const r0 = hash(seedX, seedY);
    const r1 = hash(seedX + 2.7, seedY + 9.1);
    const r2 = hash(seedX - 4.4, seedY + 3.3);
    const r3 = hash(seedX + 1.9, seedY - 6.6);
    const pushVertex = (vx, vy) => {
      positions[v * 2] = vx;
      positions[v * 2 + 1] = vy;
      uvs[v * 2] = (vx + 1) * 0.5;
      uvs[v * 2 + 1] = (vy + 1) * 0.5;
      centers[v * 2] = cenX;
      centers[v * 2 + 1] = cenY;
      rands[v * 4] = r0;
      rands[v * 4 + 1] = r1;
      rands[v * 4 + 2] = r2;
      rands[v * 4 + 3] = r3;
      v++;
    };
    pushVertex(ax, ay);
    pushVertex(bx, by);
    pushVertex(cx, cy);
  };
  const gx0 = (i) => px[i];
  const gy0 = (i) => py[i];
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const i00 = gy * gw + gx;
      const i10 = gy * gw + gx + 1;
      const i01 = (gy + 1) * gw + gx;
      const i11 = (gy + 1) * gw + gx + 1;
      if (hash(gx + 0.5, gy + 0.5) > 0.5) {
        emitTri(gx0(i00), gy0(i00), gx0(i10), gy0(i10), gx0(i11), gy0(i11), gx, gy);
        emitTri(gx0(i00), gy0(i00), gx0(i11), gy0(i11), gx0(i01), gy0(i01), gx + 0.5, gy + 0.5);
      } else {
        emitTri(gx0(i00), gy0(i00), gx0(i10), gy0(i10), gx0(i01), gy0(i01), gx, gy);
        emitTri(gx0(i10), gy0(i10), gx0(i11), gy0(i11), gx0(i01), gy0(i01), gx + 0.5, gy + 0.5);
      }
    }
  }
  return { positions, uvs, centers, rands, vertexCount: vCount };
}
const FOVY = 50 * Math.PI / 180;
const DEPTH = 3;
const NEAR = 0.05;
const FAR = 100;
const SHARD_COLS = 16;
const SHARD_ROWS = 11;
class CutinRenderer {
  canvas;
  gl;
  #shard;
  #backdrop;
  #mesh;
  #posBuf;
  #uvBuf;
  #centerBuf;
  #randBuf;
  #quadBuf;
  #texture;
  #proj = new Float32Array(16);
  #halfW = 1;
  #halfH = 1;
  #imgAspect = 1;
  constructor(canvas, gl) {
    this.canvas = canvas;
    this.gl = gl;
    this.#shard = this.#buildShardProgram();
    this.#backdrop = this.#buildBackdropProgram();
    this.#mesh = buildShardMesh(SHARD_COLS, SHARD_ROWS);
    this.#posBuf = this.#makeBuffer(this.#mesh.positions);
    this.#uvBuf = this.#makeBuffer(this.#mesh.uvs);
    this.#centerBuf = this.#makeBuffer(this.#mesh.centers);
    this.#randBuf = this.#makeBuffer(this.#mesh.rands);
    this.#quadBuf = this.#makeBuffer(
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1])
    );
    const tex = gl.createTexture();
    if (!tex) throw new Error("failed to create texture");
    this.#texture = tex;
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    this.resize();
  }
  resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.floor(window.innerWidth * dpr));
    const h = Math.max(1, Math.floor(window.innerHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.gl.viewport(0, 0, w, h);
    this.#updateProjection();
  }
  #updateProjection() {
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    const f = 1 / Math.tan(FOVY / 2);
    this.#proj.set([
      f / aspect,
      0,
      0,
      0,
      0,
      f,
      0,
      0,
      0,
      0,
      (FAR + NEAR) / (NEAR - FAR),
      -1,
      0,
      0,
      2 * FAR * NEAR / (NEAR - FAR),
      0
    ]);
    const visHalfH = DEPTH * Math.tan(FOVY / 2);
    const visHalfW = visHalfH * aspect;
    if (this.#imgAspect > aspect) {
      this.#halfW = visHalfW;
      this.#halfH = visHalfW / this.#imgAspect;
    } else {
      this.#halfH = visHalfH;
      this.#halfW = visHalfH * this.#imgAspect;
    }
  }
  setImage(image, width, height) {
    this.#imgAspect = width && height ? width / height : 1;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.#texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    this.#updateProjection();
  }
  draw(frame) {
    const gl = this.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (frame.bgAlpha > 1e-3) this.#drawBackdrop(frame.bgAlpha);
    if (frame.imgAlpha > 1e-3) this.#drawShards(frame);
  }
  clear() {
    const gl = this.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }
  #drawBackdrop(alpha) {
    const gl = this.gl;
    const bp = this.#backdrop;
    gl.useProgram(bp.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.#quadBuf);
    gl.enableVertexAttribArray(bp.attribClip);
    gl.vertexAttribPointer(bp.attribClip, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1f(bp.uniformAlpha, alpha);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  #drawShards(frame) {
    const gl = this.gl;
    const sp = this.#shard;
    gl.useProgram(sp.program);
    this.#bindAttrib(sp.attribs.pos, this.#posBuf, 2);
    this.#bindAttrib(sp.attribs.uv, this.#uvBuf, 2);
    this.#bindAttrib(sp.attribs.center, this.#centerBuf, 2);
    this.#bindAttrib(sp.attribs.rand, this.#randBuf, 4);
    gl.uniformMatrix4fv(sp.uniforms.proj, false, this.#proj);
    gl.uniform1f(sp.uniforms.halfW, this.#halfW);
    gl.uniform1f(sp.uniforms.halfH, this.#halfH);
    gl.uniform1f(sp.uniforms.depth, DEPTH);
    gl.uniform1f(sp.uniforms.shatter, frame.shatter);
    gl.uniform1f(sp.uniforms.scale, frame.scaleMul);
    gl.uniform1f(sp.uniforms.alpha, frame.imgAlpha);
    gl.uniform1f(sp.uniforms.wipe, frame.wipe);
    gl.uniform1f(sp.uniforms.flash, frame.flash);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.#texture);
    gl.uniform1i(sp.uniforms.texture, 0);
    gl.drawArrays(gl.TRIANGLES, 0, this.#mesh.vertexCount);
  }
  #bindAttrib(loc, buf, size) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
  }
  #makeBuffer(data) {
    const gl = this.gl;
    const buf = gl.createBuffer();
    if (!buf) throw new Error("failed to create buffer");
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return buf;
  }
  #buildShardProgram() {
    const gl = this.gl;
    const program = linkProgram(gl, SHARD_VERT, SHARD_FRAG);
    return {
      program,
      attribs: {
        pos: gl.getAttribLocation(program, "a_pos"),
        uv: gl.getAttribLocation(program, "a_uv"),
        center: gl.getAttribLocation(program, "a_center"),
        rand: gl.getAttribLocation(program, "a_rand")
      },
      uniforms: {
        proj: gl.getUniformLocation(program, "u_proj"),
        halfW: gl.getUniformLocation(program, "u_halfW"),
        halfH: gl.getUniformLocation(program, "u_halfH"),
        depth: gl.getUniformLocation(program, "u_depth"),
        shatter: gl.getUniformLocation(program, "u_shatter"),
        scale: gl.getUniformLocation(program, "u_scale"),
        texture: gl.getUniformLocation(program, "u_texture"),
        alpha: gl.getUniformLocation(program, "u_alpha"),
        wipe: gl.getUniformLocation(program, "u_wipe"),
        flash: gl.getUniformLocation(program, "u_flash")
      }
    };
  }
  #buildBackdropProgram() {
    const gl = this.gl;
    const program = linkProgram(gl, BACKDROP_VERT, BACKDROP_FRAG);
    return {
      program,
      attribClip: gl.getAttribLocation(program, "a_clip"),
      uniformAlpha: gl.getUniformLocation(program, "u_alpha")
    };
  }
  destroy() {
    const gl = this.gl;
    gl.deleteBuffer(this.#posBuf);
    gl.deleteBuffer(this.#uvBuf);
    gl.deleteBuffer(this.#centerBuf);
    gl.deleteBuffer(this.#randBuf);
    gl.deleteBuffer(this.#quadBuf);
    gl.deleteTexture(this.#texture);
    gl.deleteProgram(this.#shard.program);
    gl.deleteProgram(this.#backdrop.program);
  }
}
function compileShader(gl, type, src) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("failed to create shader");
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`shader compile error: ${log}`);
  }
  return shader;
}
function linkProgram(gl, vert, frag) {
  const program = gl.createProgram();
  if (!program) throw new Error("failed to create program");
  const vs = compileShader(gl, gl.VERTEX_SHADER, vert);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, frag);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`program link error: ${log}`);
  }
  return program;
}
let renderer = null;
let container = null;
let resizeHandler = null;
function mountGLOverlay() {
  if (renderer) return;
  container = document.createElement("div");
  container.id = OVERLAY_CONTAINER_ID;
  Object.assign(container.style, {
    position: "fixed",
    inset: "0",
    pointerEvents: "none",
    zIndex: String(OVERLAY_Z_INDEX)
  });
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl", { premultipliedAlpha: false, alpha: true }) ?? canvas.getContext("experimental-webgl", {
    premultipliedAlpha: false,
    alpha: true
  });
  if (!gl) {
    console.warn(`${MODULE_ID} | WebGL unavailable; cut-in overlay not mounted.`);
    return;
  }
  container.appendChild(canvas);
  document.body.appendChild(container);
  try {
    renderer = new CutinRenderer(canvas, gl);
  } catch (err) {
    console.error(`${MODULE_ID} | failed to initialize WebGL renderer:`, err);
    container.remove();
    container = null;
    return;
  }
  resizeHandler = () => renderer?.resize();
  window.addEventListener("resize", resizeHandler);
}
function getRenderer() {
  return renderer;
}
const Base$1 = foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
);
class GMConfigMenu extends Base$1 {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-gm-config`,
    tag: "form",
    classes: ["gluc-gm-config"],
    window: { title: "GLUC.Settings.MenuName", icon: "fa-solid fa-cog" },
    position: { width: 520, height: "auto" },
    form: {
      handler: GMConfigMenu.#onSubmit,
      closeOnSubmit: true,
      submitOnChange: false
    }
  };
  static PARTS = {
    form: { template: `modules/${MODULE_ID}/templates/gm-config.html` }
  };
  async _prepareContext() {
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
  static async #onSubmit(_event, _form, formData) {
    const data = formData.object;
    await Promise.all([
      setSetting(SETTINGS.GM_AVATAR, String(data.gmAvatar ?? "")),
      setSetting(SETTINGS.PC_CRITICAL_SFX, String(data.pcCriticalSfx ?? "")),
      setSetting(SETTINGS.GM_CRITICAL_SFX, String(data.gmCriticalSfx ?? "")),
      setSetting(SETTINGS.CINEMATIC_DURATION, Number(data.cinematicDuration))
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
  game.settings.register(MODULE_ID, SETTINGS.ANIMATION_MODE, {
    name: "GLUC.Settings.AnimationMode",
    hint: "GLUC.Settings.AnimationModeHint",
    scope: "world",
    config: true,
    type: String,
    choices: {
      [ANIMATION_MODES.STANDARD]: "GLUC.Settings.AnimationModeChoiceStandard",
      [ANIMATION_MODES.BREAK]: "GLUC.Settings.AnimationModeChoiceBreak"
    },
    default: ANIMATION_MODES.STANDARD
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
  const renderer2 = getRenderer();
  if (!renderer2) {
    console.warn(`${MODULE_ID} | no WebGL renderer; skipping cinematic`);
    return;
  }
  const image = await loadImage(event.imagePath);
  if (!image) {
    console.warn(`${MODULE_ID} | could not load image:`, event.imagePath);
    return;
  }
  renderer2.resize();
  renderer2.setImage(image, image.naturalWidth, image.naturalHeight);
  const isBreak = event.mode === ANIMATION_MODES.BREAK;
  const frameFor = isBreak ? breakFrame : standardFrame;
  playSfx(event.isPC ? "pc" : "gm");
  const start = performance.now();
  await new Promise((resolve) => {
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / event.durationMs);
      renderer2.draw(frameFor(t));
      if (t >= 1) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  renderer2.clear();
}
function backdropAlpha(t) {
  if (t < BG_FADE_IN_FRACTION) {
    return easeOutCubic(t / BG_FADE_IN_FRACTION) * BG_PEAK_ALPHA;
  }
  if (t > 1 - BG_FADE_OUT_FRACTION) {
    const k = (t - (1 - BG_FADE_OUT_FRACTION)) / BG_FADE_OUT_FRACTION;
    return BG_PEAK_ALPHA * (1 - easeInCubic(k));
  }
  return BG_PEAK_ALPHA;
}
const HOLD_DRIFT = 0.04;
const OUT_SCALE_BOOST = 0.16;
function standardFrame(t) {
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
  return { bgAlpha: backdropAlpha(t), imgAlpha, shatter: 0, scaleMul, wipe, flash: 0 };
}
const SHATTER_START = BREAK_FADE_IN_FRACTION + BREAK_HOLD_FRACTION;
function breakFrame(t) {
  let imgAlpha = 1;
  let scaleMul = 1;
  let shatter = 0;
  let flash = 0;
  if (t < BREAK_FADE_IN_FRACTION) {
    const k = t / BREAK_FADE_IN_FRACTION;
    imgAlpha = easeOutCubic(k);
    scaleMul = 1.12 - 0.12 * easeOutCubic(k);
  } else if (t >= SHATTER_START) {
    const k = (t - SHATTER_START) / (1 - SHATTER_START);
    shatter = k * k;
    flash = 0.7 * Math.max(0, 1 - k * 6);
    imgAlpha = 1 - easeInCubic(Math.max(0, (k - 0.7) / 0.3));
  }
  return {
    bgAlpha: backdropAlpha(t),
    imgAlpha,
    shatter,
    scaleMul,
    wipe: 1,
    flash
  };
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
async function loadImage(src) {
  const tryLoad = (url) => new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load ${url}`));
    img.src = url;
  });
  try {
    return await tryLoad(src);
  } catch (err) {
    console.warn(`${MODULE_ID} | image load failed, using fallback:`, src, err);
    try {
      return await tryLoad(FALLBACK_IMAGE$1);
    } catch {
      return null;
    }
  }
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
    mode: getSetting(SETTINGS.ANIMATION_MODE),
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
  const isCriticalSuccess = input.context.outcome === "criticalSuccess";
  const isUngradedNat20 = !input.context.outcome && input.nat20Detected;
  if (!isCriticalSuccess && !isUngradedNat20) {
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
  return { fire: true, reason: isCriticalSuccess ? "pf2e-critical-success" : "nat20" };
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
      const message = getChatMessageById(messageId);
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
function getChatMessageById(messageId) {
  const fromCollection = game.messages?.get(messageId);
  if (fromCollection) return fromCollection;
  const ChatMessage = globalThis.ChatMessage;
  return ChatMessage?.get(messageId);
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
function buildManualEvent(actorId) {
  const actor = game.actors.get(actorId);
  const isPC = actor?.hasPlayerOwner ?? true;
  return resolveCritEvent({
    messageId: `manual-${Date.now()}`,
    actorId,
    isPC,
    originUserId: game.user.id
  });
}
function createPublicAPI(version) {
  return {
    version,
    async triggerLocal(actorId) {
      const event = buildManualEvent(actorId);
      if (!event) return;
      await runCinematic(event);
    },
    async triggerBroadcast(actorId) {
      if (!game.user.isGM) {
        console.warn(`${MODULE_ID} | triggerBroadcast is GM-only; ignoring call.`);
        return;
      }
      const event = buildManualEvent(actorId);
      if (!event) return;
      broadcastCrit(event);
      await runCinematic(event);
    }
  };
}
const Base = foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
);
class ActorConfigModal extends Base {
  #actor;
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-actor-config`,
    tag: "form",
    classes: ["gluc-actor-config"],
    window: { title: "GLUC.Actor.HeaderButton", icon: "fa-solid fa-bolt" },
    position: { width: 480, height: "auto" },
    form: {
      handler: ActorConfigModal.#onSubmit,
      closeOnSubmit: true,
      submitOnChange: false
    },
    actions: {
      test: ActorConfigModal.#onTest,
      broadcast: ActorConfigModal.#onBroadcast
    }
  };
  static PARTS = {
    form: { template: `modules/${MODULE_ID}/templates/actor-config.html` }
  };
  constructor(actor, options = {}) {
    super(options);
    this.#actor = actor;
  }
  get actor() {
    return this.#actor;
  }
  /**
   * Always operate on the world (base) actor, not a synthetic token-actor.
   * Synthetic actors write flags to the token's delta — those overrides
   * are invisible to the detector, which resolves speakers via
   * `game.actors.get(speaker.actor)` (always the base).
   */
  get #baseActor() {
    const a = this.#actor;
    return game.actors.get(a.id) ?? a;
  }
  get title() {
    const isNPC = !this.#actor.hasPlayerOwner;
    const key = isNPC ? "GLUC.Actor.ModalTitleNPC" : "GLUC.Actor.ModalTitlePC";
    return game.i18n.format(key, { name: this.#actor.name ?? "Actor" });
  }
  async _prepareContext() {
    const flags = readActorFlags(this.#baseActor);
    const isNPC = !this.#actor.hasPlayerOwner;
    return {
      isNPC,
      isGM: game.user.isGM,
      data: {
        enabled: flags.enabled ?? false,
        portraitOverride: flags.portraitOverride ?? ""
      }
    };
  }
  static async #onSubmit(_event, _form, formData) {
    const base = this.#baseActor;
    const isNPC = !base.hasPlayerOwner;
    const data = formData.object;
    const enabled = isNPC ? Boolean(data.enabled) : true;
    await writeActorFlags(base, {
      enabled,
      portraitOverride: String(data.portraitOverride ?? "") || null
    });
  }
  static #onTest() {
    void this.#runTest(false);
  }
  static #onBroadcast() {
    void this.#runTest(true);
  }
  async #runTest(broadcast) {
    const base = this.#baseActor;
    const event = resolveCritEvent({
      messageId: `${broadcast ? "manual" : "test"}-${Date.now()}`,
      actorId: base.id,
      isPC: base.hasPlayerOwner,
      originUserId: game.user.id
    });
    if (!event) return;
    if (broadcast) broadcastCrit(event);
    try {
      await runCinematic(event);
    } catch (err) {
      console.error(`${MODULE_ID} | ${broadcast ? "broadcast" : "test"} cinematic failed:`, err);
    }
  }
}
const HEADER_BTN_CLASS = `${MODULE_ID}-header-btn`;
function registerActorSheetHooks() {
  Hooks.on("renderActorSheetV2", (sheet, element) => {
    const actor = sheet.actor ?? sheet.document;
    if (!actor) return;
    const canOpen = actor.isOwner || game.user.isGM;
    if (!canOpen) return;
    const header = element.querySelector(".window-header");
    if (!header) return;
    if (header.querySelector(`.${HEADER_BTN_CLASS}`)) return;
    const label = game.i18n.localize("GLUC.Actor.HeaderButton");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `header-control icon fa-solid fa-bolt ${HEADER_BTN_CLASS}`;
    btn.dataset.tooltip = label;
    btn.setAttribute("aria-label", label);
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      new ActorConfigModal(actor).render(true);
    });
    const closeBtn = header.querySelector('[data-action="close"]');
    if (closeBtn) header.insertBefore(btn, closeBtn);
    else header.appendChild(btn);
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
  mountGLOverlay();
  registerSockets();
  registerDetector();
  registerActorSheetHooks();
});
//# sourceMappingURL=module.js.map
