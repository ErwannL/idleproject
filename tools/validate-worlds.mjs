// v9.6.5 (10.2) : vérifie les fiches monde (src/data/zones.js) avant d'ajouter un monde.
// node tools/validate-worlds.mjs → liste les erreurs, code de sortie 1 s'il y en a.
import { ZONES } from '../src/data/zones.js';
import { BOSSES, ENEMIES } from '../src/data/enemies.js';

const ELEMENTS = ['red', 'blue', 'green', 'light', 'dark'];
export function validateWorlds(zones = ZONES, enemies = { ...ENEMIES, ...BOSSES }) {
  const errors = [];
  const ids = new Set();
  const known = (id) => (Array.isArray(enemies) ? enemies.some((e) => e.id === id) : Boolean(enemies?.[id]));
  zones.forEach((z, i) => {
    const at = `monde ${i + 1} (${z.id ?? '?'})`;
    if (!z.id || ids.has(z.id)) errors.push(`${at} : identifiant manquant ou en double`);
    ids.add(z.id);
    if (!z.name) errors.push(`${at} : nom manquant`);
    if (!ELEMENTS.includes(z.element)) errors.push(`${at} : élément invalide (${z.element})`);
    if (!Array.isArray(z.enemies) || z.enemies.length < 3) errors.push(`${at} : au moins 3 ennemis`);
    for (const e of [...(z.enemies ?? []), ...(z.bosses ?? []), ...Object.values(z.tierBosses ?? {})]) {
      if (!known(e)) errors.push(`${at} : ennemi inconnu « ${e} »`);
    }
    if (!z.gauntlet) for (const t of ['mini', 'mid', 'hard']) if (!z.tierBosses?.[t]) errors.push(`${at} : boss ${t} manquant`);
    if (!z.bosses?.length) errors.push(`${at} : méga boss manquant`);
  });
  return errors;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const errors = validateWorlds();
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  console.log(`${ZONES.length} mondes valides.`);
}
