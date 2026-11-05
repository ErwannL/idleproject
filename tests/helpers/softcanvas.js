// v9.2.5 : canvas logiciel minimal (pixels RGBA, plus proche voisin) pour rendre les sprites dans les tests Node,
// sans navigateur : fillRect, clearRect, drawImage (3, 5 ou 9 arguments), getImageData/putImageData/createImageData,
// globalAlpha, globalCompositeOperation (source-over, source-atop, destination-out, lighter), save/restore et
// transformations affines (translate, scale, rotate, setTransform). Installe document.createElement('canvas').
const hex = (s) => {
  if (typeof s !== 'string') return [0, 0, 0, 255];
  if (s[0] === '#') {
    let h = s.slice(1);
    if (h.length === 3) h = [...h].map((c) => c + c).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length >= 8 ? parseInt(h.slice(6, 8), 16) : 255];
  }
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (m) { const p = m[1].split(',').map(Number); return [p[0], p[1], p[2], Math.round((p[3] ?? 1) * 255)]; }
  return [0, 0, 0, 255];
};

class Ctx {
  constructor(canvas) {
    this.canvas = canvas;
    this.fillStyle = '#000000';
    this.globalAlpha = 1;
    this.globalCompositeOperation = 'source-over';
    this.imageSmoothingEnabled = false;
    this.m = [1, 0, 0, 1, 0, 0];
    this.stack = [];
  }
  save() { this.stack.push({ m: [...this.m], a: this.globalAlpha, op: this.globalCompositeOperation, f: this.fillStyle }); }
  restore() { const s = this.stack.pop(); if (s) { this.m = s.m; this.globalAlpha = s.a; this.globalCompositeOperation = s.op; this.fillStyle = s.f; } }
  setTransform(a = 1, b = 0, c = 0, d = 1, e = 0, f = 0) { this.m = [a, b, c, d, e, f]; }
  transform(a, b, c, d, e, f) {
    const [A, B, C, D, E, F] = this.m;
    this.m = [A * a + C * b, B * a + D * b, A * c + C * d, B * c + D * d, A * e + C * f + E, B * e + D * f + F];
  }
  translate(x, y) { this.transform(1, 0, 0, 1, x, y); }
  scale(x, y) { this.transform(x, 0, 0, y, 0, 0); }
  rotate(r) { const c = Math.cos(r), s = Math.sin(r); this.transform(c, s, -s, c, 0, 0); }
  // Pose un pixel source (r, g, b, a 0..255) en (x, y) selon le mode de composition.
  put(x, y, r, g, b, a) {
    const cv = this.canvas;
    if (x < 0 || y < 0 || x >= cv.width || y >= cv.height) return;
    const d = cv.data, o = (y * cv.width + x) * 4;
    const sa = (a / 255) * this.globalAlpha, da = d[o + 3] / 255;
    const op = this.globalCompositeOperation;
    if (op === 'source-atop') {
      if (!da) return;
      for (let j = 0; j < 3; j++) d[o + j] = Math.round([r, g, b][j] * sa + d[o + j] * (1 - sa));
      return;
    }
    if (op === 'destination-out') { d[o + 3] = Math.round(d[o + 3] * (1 - sa)); return; }
    if (op === 'lighter') { for (let j = 0; j < 3; j++) d[o + j] = Math.min(255, d[o + j] + Math.round([r, g, b][j] * sa)); d[o + 3] = Math.min(255, d[o + 3] + Math.round(sa * 255)); return; }
    const oa = sa + da * (1 - sa);
    if (!oa) return;
    for (let j = 0; j < 3; j++) d[o + j] = Math.round(([r, g, b][j] * sa + d[o + j] * da * (1 - sa)) / oa);
    d[o + 3] = Math.round(oa * 255);
  }
  // Parcourt les pixels de destination d'un rectangle (repère utilisateur) et rappelle fn(u, v) en coordonnées
  // relatives au rectangle (0..w, 0..h) pour chaque centre de pixel couvert.
  cover(x, y, w, h, fn) {
    const [a, b, c, d, e, f] = this.m;
    const pts = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].map(([px, py]) => [a * px + c * py + e, b * px + d * py + f]);
    const x0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p[0])))), x1 = Math.min(this.canvas.width, Math.ceil(Math.max(...pts.map((p) => p[0]))));
    const y0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p[1])))), y1 = Math.min(this.canvas.height, Math.ceil(Math.max(...pts.map((p) => p[1]))));
    const det = a * d - b * c;
    if (!det) return;
    for (let Y = y0; Y < y1; Y++) for (let X = x0; X < x1; X++) {
      const px = X + 0.5 - e, py = Y + 0.5 - f;
      const ux = (d * px - c * py) / det - x, uy = (-b * px + a * py) / det - y;
      if (ux < 0 || uy < 0 || ux >= w || uy >= h) continue;
      fn(X, Y, ux, uy);
    }
  }
  fillRect(x, y, w, h) {
    const [r, g, b, a] = hex(this.fillStyle);
    this.cover(x, y, w, h, (X, Y) => this.put(X, Y, r, g, b, a));
  }
  clearRect(x, y, w, h) {
    const op = this.globalCompositeOperation, ga = this.globalAlpha;
    this.globalCompositeOperation = 'destination-out'; this.globalAlpha = 1;
    this.cover(x, y, w, h, (X, Y) => this.put(X, Y, 0, 0, 0, 255));
    this.globalCompositeOperation = op; this.globalAlpha = ga;
  }
  drawImage(img, ...args) {
    let sx = 0, sy = 0, sw = img.width, sh = img.height, dx, dy, dw = img.width, dh = img.height;
    if (args.length === 2) [dx, dy] = args;
    else if (args.length === 4) [dx, dy, dw, dh] = args;
    else [sx, sy, sw, sh, dx, dy, dw, dh] = args;
    const src = img.data;
    if (!src || !sw || !sh) return;
    this.cover(dx, dy, dw, dh, (X, Y, u, v) => {
      const ix = Math.floor(sx + (u * sw) / dw), iy = Math.floor(sy + (v * sh) / dh);
      if (ix < 0 || iy < 0 || ix >= img.width || iy >= img.height) return;
      const o = (iy * img.width + ix) * 4;
      if (!src[o + 3]) return;
      this.put(X, Y, src[o], src[o + 1], src[o + 2], src[o + 3]);
    });
  }
  createImageData(w, h) { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; }
  getImageData(x, y, w, h) {
    const out = this.createImageData(w, h), cv = this.canvas;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const X = x + i, Y = y + j;
      if (X < 0 || Y < 0 || X >= cv.width || Y >= cv.height) continue;
      const o = (Y * cv.width + X) * 4, p = (j * w + i) * 4;
      for (let k = 0; k < 4; k++) out.data[p + k] = cv.data[o + k];
    }
    return out;
  }
  putImageData(img, x, y) {
    const cv = this.canvas;
    for (let j = 0; j < img.height; j++) for (let i = 0; i < img.width; i++) {
      const X = x + i, Y = y + j;
      if (X < 0 || Y < 0 || X >= cv.width || Y >= cv.height) continue;
      const o = (Y * cv.width + X) * 4, p = (j * img.width + i) * 4;
      for (let k = 0; k < 4; k++) cv.data[o + k] = img.data[p + k];
    }
  }
  beginPath() {} closePath() {} moveTo() {} lineTo() {} arc() {} fill() {} stroke() {} fillText() {}
  measureText(s) { return { width: String(s).length * 6 }; }
}

export class SoftCanvas {
  constructor(w = 300, h = 150) { this._w = w; this._h = h; this.data = new Uint8ClampedArray(w * h * 4); this._ctx = null; }
  get width() { return this._w; }
  set width(v) { this._w = v; this.data = new Uint8ClampedArray(this._w * this._h * 4); }
  get height() { return this._h; }
  set height(v) { this._h = v; this.data = new Uint8ClampedArray(this._w * this._h * 4); }
  getContext() { return (this._ctx ??= new Ctx(this)); }
  toDataURL() { return 'data:image/png;base64,'; }
}

export function installSoftCanvas() {
  globalThis.document ??= {};
  globalThis.document.createElement = (tag) => (tag === 'canvas' ? new SoftCanvas() : {});
}

// Écrit l'image en PPM-RGBA brut lisible par tools : { width, height, rgba } (pour les planches de contrôle).
export function rawOf(canvas) { return { width: canvas.width, height: canvas.height, rgba: Buffer.from(canvas.data) }; }
