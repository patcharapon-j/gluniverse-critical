// GLSL for the WebGL cut-in. One textured-shard program drives both modes:
// "standard" keeps shards in place (u_shatter = 0) and applies a centered
// vertical wipe + scale punch; "break" flings each shard toward the camera with
// per-shard rotation and gravity so the portrait shatters like glass.

export const SHARD_VERT = `
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

export const SHARD_FRAG = `
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

// Fullscreen dark backdrop, drawn in clip space with no perspective.
export const BACKDROP_VERT = `
precision highp float;
attribute vec2 a_clip;
void main() {
  gl_Position = vec4(a_clip, 0.0, 1.0);
}
`;

export const BACKDROP_FRAG = `
precision highp float;
uniform float u_alpha;
void main() {
  gl_FragColor = vec4(0.0, 0.0, 0.0, u_alpha);
}
`;
