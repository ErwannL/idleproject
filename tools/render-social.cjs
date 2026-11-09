// v9.3.1 : rend l'icône et les bannières réseaux de docs/promo/social/social.html en PNG (docs/promo/social/).
//   NODE_PATH=$(npm root -g) node tools/render-social.cjs
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const dir = path.join(__dirname, '../docs/promo/social');
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 2600, height: 1500 } });
  await p.goto(`file://${dir}/social.html`); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(500);
  const out = { icon: 'icone-1024.png', x: 'banniere-x-1500x500.png', youtube: 'banniere-youtube-2560x1440.png', discord: 'banniere-discord-960x540.png' };
  for (const [id, f] of Object.entries(out)) { await p.locator(`#${id}`).screenshot({ path: `${dir}/${f}` }); console.log(f); }
  await b.close();
})();
