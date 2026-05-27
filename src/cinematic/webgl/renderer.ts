import { MODULE_ID, OVERLAY_CONTAINER_ID, OVERLAY_Z_INDEX } from '../../constants';
import {
  BACKDROP_FRAG,
  BACKDROP_VERT,
  SHARD_FRAG,
  SHARD_VERT,
} from './shaders';
import { buildShardMesh, type ShardMesh } from './shatter-mesh';

const FOVY = (50 * Math.PI) / 180;
const DEPTH = 3.0; // distance of the image plane in front of the camera
const NEAR = 0.05;
const FAR = 100.0;
const SHARD_COLS = 16;
const SHARD_ROWS = 11;

export interface DrawFrame {
  bgAlpha: number;
  imgAlpha: number;
  shatter: number;
  scaleMul: number;
  wipe: number;
  flash: number;
}

interface ShardProgram {
  program: WebGLProgram;
  attribs: { pos: number; uv: number; center: number; rand: number };
  uniforms: {
    proj: WebGLUniformLocation | null;
    halfW: WebGLUniformLocation | null;
    halfH: WebGLUniformLocation | null;
    depth: WebGLUniformLocation | null;
    shatter: WebGLUniformLocation | null;
    scale: WebGLUniformLocation | null;
    texture: WebGLUniformLocation | null;
    alpha: WebGLUniformLocation | null;
    wipe: WebGLUniformLocation | null;
    flash: WebGLUniformLocation | null;
  };
}

interface BackdropProgram {
  program: WebGLProgram;
  attribClip: number;
  uniformAlpha: WebGLUniformLocation | null;
}

class CutinRenderer {
  readonly canvas: HTMLCanvasElement;
  readonly gl: WebGLRenderingContext;

  #shard: ShardProgram;
  #backdrop: BackdropProgram;
  #mesh: ShardMesh;
  #posBuf: WebGLBuffer;
  #uvBuf: WebGLBuffer;
  #centerBuf: WebGLBuffer;
  #randBuf: WebGLBuffer;
  #quadBuf: WebGLBuffer;
  #texture: WebGLTexture;

  #proj = new Float32Array(16);
  #halfW = 1;
  #halfH = 1;
  #imgAspect = 1;

  constructor(canvas: HTMLCanvasElement, gl: WebGLRenderingContext) {
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
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    );

    const tex = gl.createTexture();
    if (!tex) throw new Error('failed to create texture');
    this.#texture = tex;

    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    this.resize();
  }

  resize(): void {
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

  #updateProjection(): void {
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    const f = 1 / Math.tan(FOVY / 2);
    // Column-major perspective matrix; camera at origin looking down -z.
    this.#proj.set([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (FAR + NEAR) / (NEAR - FAR), -1,
      0, 0, (2 * FAR * NEAR) / (NEAR - FAR), 0,
    ]);

    // Aspect-fit (contain) the image into the visible plane at z = -DEPTH.
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

  setImage(image: TexImageSource, width: number, height: number): void {
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

  draw(frame: DrawFrame): void {
    const gl = this.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (frame.bgAlpha > 0.001) this.#drawBackdrop(frame.bgAlpha);
    if (frame.imgAlpha > 0.001) this.#drawShards(frame);
  }

  clear(): void {
    const gl = this.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  #drawBackdrop(alpha: number): void {
    const gl = this.gl;
    const bp = this.#backdrop;
    gl.useProgram(bp.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.#quadBuf);
    gl.enableVertexAttribArray(bp.attribClip);
    gl.vertexAttribPointer(bp.attribClip, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1f(bp.uniformAlpha, alpha);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  #drawShards(frame: DrawFrame): void {
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

  #bindAttrib(loc: number, buf: WebGLBuffer, size: number): void {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
  }

  #makeBuffer(data: Float32Array): WebGLBuffer {
    const gl = this.gl;
    const buf = gl.createBuffer();
    if (!buf) throw new Error('failed to create buffer');
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return buf;
  }

  #buildShardProgram(): ShardProgram {
    const gl = this.gl;
    const program = linkProgram(gl, SHARD_VERT, SHARD_FRAG);
    return {
      program,
      attribs: {
        pos: gl.getAttribLocation(program, 'a_pos'),
        uv: gl.getAttribLocation(program, 'a_uv'),
        center: gl.getAttribLocation(program, 'a_center'),
        rand: gl.getAttribLocation(program, 'a_rand'),
      },
      uniforms: {
        proj: gl.getUniformLocation(program, 'u_proj'),
        halfW: gl.getUniformLocation(program, 'u_halfW'),
        halfH: gl.getUniformLocation(program, 'u_halfH'),
        depth: gl.getUniformLocation(program, 'u_depth'),
        shatter: gl.getUniformLocation(program, 'u_shatter'),
        scale: gl.getUniformLocation(program, 'u_scale'),
        texture: gl.getUniformLocation(program, 'u_texture'),
        alpha: gl.getUniformLocation(program, 'u_alpha'),
        wipe: gl.getUniformLocation(program, 'u_wipe'),
        flash: gl.getUniformLocation(program, 'u_flash'),
      },
    };
  }

  #buildBackdropProgram(): BackdropProgram {
    const gl = this.gl;
    const program = linkProgram(gl, BACKDROP_VERT, BACKDROP_FRAG);
    return {
      program,
      attribClip: gl.getAttribLocation(program, 'a_clip'),
      uniformAlpha: gl.getUniformLocation(program, 'u_alpha'),
    };
  }

  destroy(): void {
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

function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('failed to create shader');
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`shader compile error: ${log}`);
  }
  return shader;
}

function linkProgram(gl: WebGLRenderingContext, vert: string, frag: string): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error('failed to create program');
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

let renderer: CutinRenderer | null = null;
let container: HTMLDivElement | null = null;
let resizeHandler: (() => void) | null = null;

export function mountGLOverlay(): void {
  if (renderer) return;

  container = document.createElement('div');
  container.id = OVERLAY_CONTAINER_ID;
  Object.assign(container.style, {
    position: 'fixed',
    inset: '0',
    pointerEvents: 'none',
    zIndex: String(OVERLAY_Z_INDEX),
  } satisfies Partial<CSSStyleDeclaration>);

  const canvas = document.createElement('canvas');
  const gl = (canvas.getContext('webgl', { premultipliedAlpha: false, alpha: true }) ??
    canvas.getContext('experimental-webgl', {
      premultipliedAlpha: false,
      alpha: true,
    })) as WebGLRenderingContext | null;
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
  window.addEventListener('resize', resizeHandler);
}

export function getRenderer(): CutinRenderer | null {
  return renderer;
}

export function unmountGLOverlay(): void {
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }
  renderer?.destroy();
  renderer = null;
  if (container?.parentNode) {
    container.parentNode.removeChild(container);
    container = null;
  }
}

export type { CutinRenderer };
