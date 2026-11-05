// v9.2.5 : calage des images dessinées (PixelLab) des ennemis sur leur sprite de base.
// Retour joueur : « toujours des sprites pas correctement alignés » (loup frénétique qui flotte). Les animations
// générées gardent le cadre de PixelLab, qui dérive d'une image et d'une animation à l'autre : pieds au-dessus ou
// sous la ligne du sol, corps qui glisse de quelques pixels. On recale donc à l'exécution, sur la silhouette opaque :
//   - pieds : le bas opaque de l'image est posé sur le bas opaque du sprite de base (donc sur le sol) ;
//     image par image pour la marche, le coup reçu et le flottement (pas de saut voulu), et pour l'animation entière
//     (image la plus basse) pour l'attaque, la mort, la sortie du sol et du portail (le saut du crapaud reste un saut) ;
//   - centre horizontal : centre moyen de la silhouette de l'animation sur le centre du sprite de base (l'élan de
//     l'attaque reste, le corps ne glisse plus d'une animation à l'autre) ;
//   - tête : haut opaque du sprite de base (stable), pour l'étiquette et la barre de PV.
// Fonctions pures sur masques alpha (testées) + cache par image.

const boxCache = new WeakMap();

// Boîte opaque d'un masque alpha (seuil > 0), ou null.
export function opaqueBox(alpha, w, h) {
  let top = h, bottom = -1, left = w, right = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (alpha[y * w + x] > 0) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  return bottom < 0 ? null : { top, bottom, left, right, cx: (left + right + 1) / 2 };
}

export function boxOf(img) {
  if (!img) return null;
  if (boxCache.has(img)) return boxCache.get(img);
  let b = null;
  try {
    const d = img.getContext('2d').getImageData(0, 0, img.width, img.height).data;
    const a = new Uint8Array(img.width * img.height);
    for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3];
    b = opaqueBox(a, img.width, img.height);
  } catch { b = null; }
  boxCache.set(img, b);
  return b;
}

// Animations calées image par image sur les pieds (les autres : sur l'image la plus basse de l'animation).
export const PER_FRAME_FEET = new Set(['walk', 'hurt', 'swim']);

// Décalage (ox, oy, en pixels du sprite) de l'image `i` d'une animation, par rapport au cadre du sprite de base.
// base : boîte du sprite de base ; boxes : boîtes des images ; name : nom de l'animation ; feet : false = garder le
// décalage vertical d'origine (volants, nage) ; orig : {ox, oy} d'origine.
export function anchorOffset(base, boxes, i, name, orig = { ox: 0, oy: 0 }, feet = true) {
  const ok = boxes.filter(Boolean);
  if (!base || !ok.length || !boxes[i]) return { ox: orig.ox, oy: orig.oy };
  const meanCx = ok.reduce((s, b) => s + b.cx, 0) / ok.length;
  const ox = Math.round(base.cx - meanCx);
  if (!feet) return { ox, oy: orig.oy };
  const bottom = PER_FRAME_FEET.has(name) ? boxes[i].bottom : Math.max(...ok.map((b) => b.bottom));
  return { ox, oy: base.bottom - bottom };
}

// Haut de la tête et centre (en pixels du sprite de base) pour l'étiquette et la barre de PV.
export function headOf(base) {
  return base ? { top: base.top, cx: base.cx, bottom: base.bottom } : null;
}

// Boîtes des images d'une animation (cache par animation ; `toCanvas` : clé d'image → canvas).
const animCache = new WeakMap();
export function animBoxes(anim, toCanvas) {
  if (animCache.has(anim)) return animCache.get(anim);
  const boxes = anim.frames.map((k) => boxOf(toCanvas(k)));
  animCache.set(anim, boxes);
  return boxes;
}
