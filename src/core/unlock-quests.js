// v9.7.1 (lot 3) : les systèmes s'ouvrent par des mini-quêtes en trois gestes, l'une après l'autre (plus de seuils
// d'étape qui ouvraient neuf systèmes en dix minutes). Ordre : équipement, améliorations, compétences, premier
// compagnon (histoire), forge, invocation, donjons, talents, défis, renaissance. Une quête finie ouvre son système et
// lance la suivante ; son avancée part des compteurs de la partie au moment où elle commence (state.unlocks.base).
// Une sauvegarde d'avant la 9.7.1 garde tout ce qui était ouvert (state.unlocks.legacy).
const sumUp = (s) => Object.values(s.upgrades ?? {}).reduce((a, n) => a + (n || 0), 0);
const sumSkills = (s) => Object.values(s.skills ?? {}).reduce((a, n) => a + (n || 0), 0);
const best = (s) => Math.max(s.maxStage ?? 1, s.records?.bestStage ?? 1);
const delta = (s, b, k) => (s.records?.[k] ?? 0) - (b?.[k] ?? 0);

// steps : [texte, test(state, base)] — texte tutoyé, une consigne courte. Un geste qui demande une action précise a
// une issue de secours (combats, boss) : le joueur passif avance toujours, le joueur présent plus vite.
export const UNLOCK_QUESTS = [
  { id: 'equipment', label: 'Équipement', steps: [
    ['Bats 10 monstres', (s, b) => delta(s, b, 'kills') >= 10],
    ['Ramasse un objet', (s, b) => delta(s, b, 'itemsFound') >= 1],
    ['Équipe un objet', (s) => (s.records?.equips ?? 0) >= 1 || Object.values(s.equipment ?? {}).filter(Boolean).length >= 2],
  ] },
  { id: 'upgrades', label: 'Améliorations', steps: [
    ['Atteins l\'étape 1-4', (s) => best(s) >= 4],
    ['Achète 3 améliorations', (s) => sumUp(s) >= 3],
    ['Bats 40 monstres', (s, b) => delta(s, b, 'kills') >= 40],
  ] },
  { id: 'skills', label: 'Compétences', steps: [
    ['Atteins le niveau 5', (s) => (s.level ?? 1) >= 5],
    ['Apprends une compétence', (s) => sumSkills(s) >= 2],
    ['Lance une compétence à la main', (s, b) => (s.records?.manualCasts ?? 0) >= 1 || delta(s, b, 'kills') >= 60], // v10.1 : 60 victoires suffisent // le passif avance quand même
  ] },
  { id: 'companion', label: 'Premier compagnon', story: 'priestess', steps: [
    // v10.1 (P1 §2.2) : le premier compagnon arrive à l'étape 8 (ordre d'apprentissage), plus à la fin du monde 1.
    ['Bats le premier boss', (s) => (s.records?.bossesDefeated ?? 0) >= 1],
    ['Atteins l\'étape 1-8', (s) => best(s) >= 8],
    ['Achète 5 améliorations', (s) => sumUp(s) >= 5],
  ] },
  { id: 'forge', label: 'Forge', steps: [
    ['Recycle 3 objets', (s, b) => (s.records?.recycled ?? 0) >= 3 || delta(s, b, 'kills') >= 200],
    ['Renforce ton arme', (s, b) => (s.equipment?.weapon?.upgrades ?? 0) >= 1 || delta(s, b, 'kills') >= 400],
    ['Atteins l\'étape 2-5', (s) => best(s) >= 25],
  ] },
  { id: 'summon', label: 'Invocation', steps: [
    ['Bats 3 boss', (s, b) => (s.records?.bossesDefeated ?? 0) >= 3 || delta(s, b, 'kills') >= 300],
    ['Atteins l\'étape 2-10', (s) => best(s) >= 30],
    ['Garde 250 gemmes', (s, b) => (s.gems ?? 0) >= 250 || delta(s, b, 'kills') >= 400],
  ] },
  { id: 'dungeons', label: 'Donjons', story: 'pyromancer', steps: [
    ['Atteins l\'étape 2-15', (s) => best(s) >= 35],
    ['Pare 3 coups lourds', (s, b) => (s.records?.guards ?? 0) >= 3 || delta(s, b, 'kills') >= 600],
    ['Termine le monde 2', (s) => best(s) >= 41],
  ] },
  { id: 'talents', label: 'Talents', steps: [
    ['Atteins l\'étape 3-5', (s) => best(s) >= 45],
    ['Vide un donjon', (s, b) => Object.keys(s.dungeonsCleared ?? {}).length >= 1 || delta(s, b, 'kills') >= 800],
    ['Bats 10 boss', (s) => (s.records?.bossesDefeated ?? 0) >= 10],
  ] },
  { id: 'challenges', label: 'Défis', steps: [
    ['Atteins l\'étape 3-10', (s) => best(s) >= 50],
    ['Apprends 3 talents', (s, b) => Object.values(s.talents ?? s.tree ?? {}).filter(Boolean).length >= 3 || delta(s, b, 'kills') >= 800],
    ['Atteins le niveau 40', (s) => (s.level ?? 1) >= 40],
  ] },
  { id: 'rebirth', label: 'Renaissance', steps: [
    ['Atteins l\'étape 3-15', (s) => best(s) >= 55],
    ['Bats 20 boss', (s) => (s.records?.bossesDefeated ?? 0) >= 20],
    ['Termine le monde 3', (s) => best(s) >= 61],
  ] },
];
export const UNLOCK_IDS = UNLOCK_QUESTS.map((q) => q.id);

export function unlocksOf(state) {
  state.unlocks ??= { done: [], base: { ...(state.records ?? {}) } };
  return state.unlocks;
}
export function isUnlocked(state, id) {
  if (!state) return true;
  const u = state.unlocks;
  if (!u || u.legacy || id === 'upgrades') return true; // v9.8 (0.3) : Améliorations dès la 1re minute. Ancienne partie (ou état minimal des tests) : tout ce qui était ouvert le reste
  // La quête en cours ouvre son système (on l'apprend en faisant) ; la suivante attend qu'elle soit finie.
  return u.done.includes(id) || UNLOCK_QUESTS.find((q) => !u.done.includes(q.id))?.id === id;
}
export function currentQuest(state) {
  const u = state?.unlocks;
  if (!u || u.legacy) return null; // pas de chaîne (ancienne partie, état de test) : rien à faire
  return UNLOCK_QUESTS.find((q) => !u.done.includes(q.id)) ?? null;
}
export function questSteps(state, q = currentQuest(state)) {
  if (!q) return [];
  const base = unlocksOf(state).base;
  return q.steps.map(([text, test]) => ({ text, done: Boolean(test(state, base)) }));
}
// À appeler régulièrement : termine la quête en cours si ses trois gestes sont faits. Renvoie la quête finie, sinon null.
export function advanceUnlocks(state) {
  const q = currentQuest(state);
  if (!q || !questSteps(state, q).every((s) => s.done)) return null;
  const u = unlocksOf(state);
  u.done.push(q.id);
  u.base = { ...(state.records ?? {}) };
  if (q.story && state.companions && !state.companions.owned[q.story]) {
    state.companions.owned[q.story] = { stars: 1, level: 1, story: true }; // compagnon d'histoire : il rejoint l'équipe
    if ((state.companions.equipped?.length ?? 0) < 2) state.companions.equipped = [...(state.companions.equipped ?? []), q.story];
  }
  return q;
}
