// v9.2.9 : audit du héros tenant son arme (tests v929-armes et planches) : rendu d'une image avec et sans arme,
// pixels de l'arme réellement visibles, côté de la prise et de l'impact.
import { SoftCanvas } from './softcanvas.js';
export const W = 140, H = 120, X = 30, Y = 20;
const a = (cv, i) => cv.data[i * 4 + 3];
export function audit(D, pick, eq, palette) {
  const full = new SoftCanvas(W, H), body = new SoftCanvas(W, H);
  const r = D.drawHeroPick(full.getContext('2d'), pick, eq, palette, X, Y);
  D.drawHeroPick(body.getContext('2d'), pick, eq, palette, X, Y, { weapon: false });
  if (!r) return null;
  // pixels de l'arme seule (calque posé au même endroit)
  const wx = X + r.gx - r.x, wy = Y + r.gy - r.y;
  let total = 0, seen = 0;
  for (let y = 0; y < r.canvas.height; y++) for (let x = 0; x < r.canvas.width; x++) {
    if (r.canvas.data[(y * r.canvas.width + x) * 4 + 3] < 100) continue;
    const XX = wx + x, YY = wy + y;
    if (XX < 0 || YY < 0 || XX >= W || YY >= H) continue;
    total++;
    const i = YY * W + XX;
    let diff = false;
    for (let j = 0; j < 3; j++) if (full.data[i * 4 + j] !== body.data[i * 4 + j]) diff = true;
    if (diff || (a(full, i) > 100 && a(body, i) < 100)) seen++;
  }
  // centre du torse (colonnes opaques du corps)
  let sx = 0, n = 0;
  for (let i = 0; i < W * H; i++) if (a(body, i) > 100) { sx += i % W; n++; }
  return { r, total, seen, vis: total ? seen / total : 0, cx: n ? sx / n : X + 32, gx: X + r.gx, full, body };
}
