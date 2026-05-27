// Builds a triangulated mesh of the portrait quad used by the WebGL cut-in.
// Each triangle is an independent "shard": its three vertices share the same
// centroid and the same random seed so the vertex shader can transform the
// shard rigidly (fly toward the viewer, tumble) during the "break" animation.
//
// Geometry lives in normalized quad space: x/y in [-1, 1], uv in [0, 1]. The
// renderer scales this to world units via uniforms, so the mesh is built once
// and reused regardless of image aspect or screen size.

export interface ShardMesh {
  // 2 floats per vertex (x, y) in [-1, 1].
  positions: Float32Array;
  // 2 floats per vertex (u, v) in [0, 1].
  uvs: Float32Array;
  // 2 floats per vertex: shard centroid in [-1, 1] (duplicated across the 3 verts).
  centers: Float32Array;
  // 4 floats per vertex: per-shard random params (duplicated across the 3 verts).
  rands: Float32Array;
  vertexCount: number;
}

// Deterministic hash → [0, 1). Keeps shard motion stable across frames without
// pulling in a PRNG dependency.
function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function buildShardMesh(cols: number, rows: number, jitter = 0.6): ShardMesh {
  // Grid of shared corner points (cols+1 by rows+1), interior points jittered so
  // the resulting triangles are irregular like cracked glass.
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
      px[i] = nx * 2 - 1; // → [-1, 1]
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
  const emitTri = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
    cx: number,
    cy: number,
    seedX: number,
    seedY: number,
  ): void => {
    const cenX = (ax + bx + cx) / 3;
    const cenY = (ay + by + cy) / 3;
    const r0 = hash(seedX, seedY);
    const r1 = hash(seedX + 2.7, seedY + 9.1);
    const r2 = hash(seedX - 4.4, seedY + 3.3);
    const r3 = hash(seedX + 1.9, seedY - 6.6);

    const pushVertex = (vx: number, vy: number): void => {
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

  const gx0 = (i: number): number => px[i] as number;
  const gy0 = (i: number): number => py[i] as number;

  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const i00 = gy * gw + gx;
      const i10 = gy * gw + gx + 1;
      const i01 = (gy + 1) * gw + gx;
      const i11 = (gy + 1) * gw + gx + 1;
      // Split each cell along a seed-dependent diagonal for more organic shards.
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
