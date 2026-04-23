/**
 * Perspective (homography) transform utilities for the document scanner.
 *
 * Algorithm:
 *   1. computeHomography – solves the 8-DOF DLT for 4-point correspondences
 *   2. perspectiveCorrect – backward-maps every output pixel via H⁻¹ with
 *      bilinear interpolation (no holes, good quality)
 *   3. enhanceScan – grayscale + contrast stretch so the output looks like a
 *      flatbed scanner rather than a photograph
 *
 * All math is plain JS (no OpenCV dependency).
 */

export type Point = readonly [number, number]

// ─── Gaussian elimination ─────────────────────────────────────────────────────

function gaussSolve(A: number[][], b: number[]): number[] {
  const n = b.length
  // Build augmented matrix [A | b]
  const M = A.map((row, i) => [...row, b[i]])

  for (let col = 0; col < n; col++) {
    // Partial pivoting
    let maxRow = col
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row
    }
    ;[M[col], M[maxRow]] = [M[maxRow], M[col]]

    const d = M[col][col]
    if (Math.abs(d) < 1e-12) continue

    for (let row = col + 1; row < n; row++) {
      const f = M[row][col] / d
      for (let k = col; k <= n; k++) M[row][k] -= f * M[col][k]
    }
  }

  const x = new Array(n).fill(0)
  for (let i = n - 1; i >= 0; i--) {
    x[i] = M[i][n]
    for (let j = i + 1; j < n; j++) x[i] -= M[i][j] * x[j]
    x[i] /= M[i][i]
  }
  return x
}

// ─── Homography ───────────────────────────────────────────────────────────────

/**
 * Compute the 3×3 homography matrix H mapping src[i] → dst[i].
 * Returns 9 elements [h00…h22] in row-major order (h22 = 1).
 */
export function computeHomography(src: Point[], dst: Point[]): number[] {
  const A: number[][] = []
  const b: number[] = []

  for (let i = 0; i < 4; i++) {
    const [sx, sy] = src[i]
    const [dx, dy] = dst[i]
    A.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy])
    b.push(dx)
    A.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy])
    b.push(dy)
  }

  const h = gaussSolve(A, b)
  return [...h, 1] // append h22 = 1
}

// ─── Output size helper ───────────────────────────────────────────────────────

function dist(a: Point, b: Point): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

/**
 * Compute the natural output width × height for a perspective-corrected quad.
 * corners: [topLeft, topRight, bottomRight, bottomLeft]
 */
export function computeOutputSize(corners: Point[]): [number, number] {
  const [tl, tr, br, bl] = corners
  const w = Math.round(Math.max(dist(tl, tr), dist(bl, br)))
  const h = Math.round(Math.max(dist(tl, bl), dist(tr, br)))
  return [w, h]
}

// ─── Perspective correction ───────────────────────────────────────────────────

/**
 * Warp the quadrilateral `corners` in `src` to a rectangle.
 *
 * corners: [topLeft, topRight, bottomRight, bottomLeft] in src pixel coords.
 * maxLongEdge: cap the longer output edge (avoids huge canvases on high-DPI).
 *
 * Uses backward mapping (dst → src) so every output pixel is filled.
 * Bilinear interpolation gives clean sub-pixel edges.
 */
export function perspectiveCorrect(
  src: HTMLCanvasElement,
  corners: Point[],
  maxLongEdge = 1800,
): HTMLCanvasElement {
  const [rawW, rawH] = computeOutputSize(corners)
  const scale = Math.min(1, maxLongEdge / Math.max(rawW, rawH, 1))
  const outW = Math.round(rawW * scale)
  const outH = Math.round(rawH * scale)

  // Destination corners (rectangle)
  const dstCorners: Point[] = [[0, 0], [outW, 0], [outW, outH], [0, outH]]

  // Inverse homography: dst → src (backward mapping)
  const H = computeHomography(dstCorners, corners)

  const srcCtx = src.getContext('2d')!
  const srcData = srcCtx.getImageData(0, 0, src.width, src.height)
  const srcPx = srcData.data
  const srcW = src.width
  const srcH = src.height

  const out = document.createElement('canvas')
  out.width = outW
  out.height = outH
  const outCtx = out.getContext('2d')!
  const outData = outCtx.createImageData(outW, outH)
  const outPx = outData.data

  for (let dy = 0; dy < outH; dy++) {
    for (let dx = 0; dx < outW; dx++) {
      // Apply H⁻¹ to map output pixel → source
      const w3 = H[6] * dx + H[7] * dy + H[8]
      const sx = (H[0] * dx + H[1] * dy + H[2]) / w3
      const sy = (H[3] * dx + H[4] * dy + H[5]) / w3

      const x0 = Math.floor(sx)
      const y0 = Math.floor(sy)
      if (x0 < 0 || y0 < 0 || x0 >= srcW - 1 || y0 >= srcH - 1) continue

      // Bilinear weights
      const fx = sx - x0
      const fy = sy - y0
      const i00 = (y0 * srcW + x0) * 4
      const i10 = i00 + 4
      const i01 = i00 + srcW * 4
      const i11 = i01 + 4
      const oi = (dy * outW + dx) * 4

      for (let c = 0; c < 3; c++) {
        outPx[oi + c] = Math.round(
          srcPx[i00 + c] * (1 - fx) * (1 - fy) +
          srcPx[i10 + c] * fx       * (1 - fy) +
          srcPx[i01 + c] * (1 - fx) * fy +
          srcPx[i11 + c] * fx       * fy,
        )
      }
      outPx[oi + 3] = 255
    }
  }

  outCtx.putImageData(outData, 0, 0)
  return out
}

// ─── Scan enhancement ─────────────────────────────────────────────────────────

/**
 * Make the image look like a flatbed scanner output:
 *   1. Convert to grayscale (luminance-weighted)
 *   2. Stretch contrast to fill [0, 255]
 *   3. Slight adaptive threshold to clean up shadows
 *
 * Mutates the canvas in place and returns it.
 */
export function enhanceScan(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext('2d')!
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const px = data.data

  // Pass 1: grayscale + find min/max luminance
  let minL = 255, maxL = 0
  for (let i = 0; i < px.length; i += 4) {
    const g = Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2])
    px[i] = px[i + 1] = px[i + 2] = g
    if (g < minL) minL = g
    if (g > maxL) maxL = g
  }

  // Pass 2: contrast stretch (percentile clamp to ignore extreme pixels)
  const range = Math.max(maxL - minL, 1)
  // Compress whites slightly so text is crisper
  const boost = Math.min(1.15, 255 / range)
  for (let i = 0; i < px.length; i += 4) {
    const stretched = Math.round(((px[i] - minL) / range) * 255 * boost)
    const v = Math.min(255, Math.max(0, stretched))
    px[i] = px[i + 1] = px[i + 2] = v
  }

  ctx.putImageData(data, 0, 0)
  return canvas
}
