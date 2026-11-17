"""v9.2.6 : effets visuels de COMBAT dessinés image par image par PixelLab (point d'accès /v2/vfx, artiste « lite »).

Impacts par arme et par élément, critiques, projectiles, morts, butin, niveau, soins, auras, apparition des boss,
poussières. La table VFX (nom -> [taille cible en pixels de jeu, description]) est la source unique.

Sources : tools/art/pixellab/vfx/<nom>.png (planche horizontale renvoyée par PixelLab) + <nom>.json (images, durées).
Construction : chaque image est recadrée sur la boîte commune de l'effet, réduite à la taille cible (pixels nets),
alpha franc, couleurs ramenées à 48 teintes communes, puis tout est rangé dans un atlas PNG indexé, embarqué en
base64 dans src/render/art-vfx.js (lu par src/render/vfx.js).

Usage :
  PIXELLAB_API_KEY=… python3 tools/art/pixellab_vfx.py gen [noms…]   génère les effets manquants (ou ceux nommés)
  python3 tools/art/pixellab_vfx.py build                             écrit src/render/art-vfx.js
  python3 tools/art/pixellab_vfx.py bal                               crédits restants
La clé n'est jamais affichée ni écrite.
"""
import base64
import io
import json
import os
import sys
import time
import urllib.request

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SRC = os.path.join(HERE, 'pixellab', 'vfx')
OUT = os.path.join(ROOT, 'src', 'render', 'art-vfx.js')
API = 'https://api.pixellab.ai/v2'

STYLE = ('Crisp retro 16-bit pixel art game effect, side view, bright saturated fantasy palette, '
         'dark outline accents, transparent background, no character, effect only, centered. ')
# nom -> [taille cible (plus grand côté, pixels de jeu), description]
VFX = {
    # Impacts par arme
    'hit_slash': [30, 'a white and pale blue crescent sword slash impact, a sharp diagonal arc that flashes and fades with a few sparks, 6 frames, fast'],
    'hit_pierce': [26, 'a quick piercing thrust impact: a narrow horizontal white spear streak that punches forward into a small star burst, 6 frames'],
    'hit_blunt': [30, 'a heavy blunt hammer impact: round yellow-white shockwave puff with small debris and stars radiating out, 6 frames'],
    'hit_arrow': [20, 'a small arrow impact: a tiny white and beige spark burst with splinters flying, 5 frames, very fast'],
    # Impacts par élément
    'hit_fire': [32, 'a fire impact explosion: orange and yellow flames burst outward then curl up into dark smoke and embers, 8 frames'],
    'hit_ice': [30, 'an ice impact: pale blue ice crystals and shards shatter outward from a frosty burst, white highlights, 8 frames'],
    'hit_thunder': [32, 'a lightning impact: bright white and cyan electric burst with zigzag sparks crackling outward, 7 frames'],
    'hit_poison': [28, 'a poison impact: toxic green splash with bubbling droplets and a small green gas puff, 8 frames'],
    'hit_shadow': [30, 'a shadow magic impact: dark purple and violet void burst with swirling wisps converging then dispersing, 8 frames'],
    'hit_holy': [32, 'a holy light impact: golden yellow and white radiant burst with a cross shaped glint and rising light motes, 8 frames'],
    # Critique
    'crit_flash': [40, 'a critical hit flash: a big golden star shaped burst with sharp white rays that pops very fast and fades, 6 frames'],
    'crit_wave': [48, 'a critical hit shockwave: an expanding golden and white ring wave seen slightly from the side, oval, growing and fading, 7 frames'],
    # Projectiles (boucles, vers la droite)
    'proj_arrow': [16, 'a flying wooden arrow pointing right with a soft white motion trail behind it, looping 4 frames, horizontal'],
    'proj_fireball': [20, 'a flying fireball moving to the right, bright yellow core, orange flames and a flickering flame trail on the left, looping 6 frames'],
    'proj_bolt': [24, 'a flying electric orb projectile moving to the right: round white hot core with cyan crackling sparks around it and a short jagged cyan lightning tail on the left, looping 6 frames'],
    'proj_soul': [18, 'a flying ghostly green soul wisp moving to the right with a wavy spectral trail, looping 6 frames'],
    'proj_ice': [18, 'a flying ice shard projectile moving to the right, pale blue crystal with frosty sparkle trail, looping 4 frames'],
    # Morts
    'death_smoke': [36, 'an enemy defeat poof: a round puff of grey and lavender smoke clouds bursting out then dissipating, 8 frames'],
    'death_soul': [30, 'a small ghostly white and pale cyan soul wisp rising upward and fading away, with a faint trail, 8 frames, vertical'],
    'boss_explode': [64, 'a big boss defeat explosion: large fiery orange and yellow blast with smoke ring and flying debris, then dark smoke, 10 frames'],
    # Butin
    'loot_coin': [12, 'a spinning gold coin, shiny yellow with white glint, looping 6 frames, small'],
    'loot_gem': [12, 'a sparkling cyan blue gem crystal rotating with a white twinkle, looping 6 frames, small'],
    'loot_shine': [24, 'a twinkling sparkle glint: a thin four pointed white star with a few tiny pixel sparkles around it, growing and shrinking, no ring, no circle, mostly empty, looping 6 frames'],
    'loot_burst': [32, 'a loot drop burst: upward fountain of golden sparkles and little stars bursting out, 7 frames'],
    # Héros
    'level_up': [56, 'a level up effect: golden rising pillar of light with spiraling sparkles and upward arrows of light, 10 frames, vertical'],
    'heal': [36, 'a healing effect: soft green and white plus signs and light motes rising upward with a gentle glow, 8 frames, vertical'],
    'buff_aura': [40, 'a subtle power up buff aura: thin golden ellipse on the ground with a few small golden light motes and short vertical light streaks rising from it, sparse and airy, looping 6 frames, empty center'],
    'debuff_aura': [40, 'a debuff curse aura at ground level: dark purple downward dripping wisps and skull-like smoke ring around a character spot, looping 6 frames, empty center'],
    'boss_appear': [72, 'a boss summoning portal: dark red and black magic circle on the ground erupting with crimson flames and lightning, 10 frames'],
    # Poussières
    'dust_step': [12, 'a tiny dust puff kicked up from a footstep on the ground, beige and grey, 5 frames, very small'],
    'dust_land': [28, 'a landing dust cloud: beige and grey dust puffs spreading left and right along the ground, 6 frames, wide and low'],
}

# v9.2.6 (deuxième vague) : compétences (une par effet de skill-fx.js), mécaniques de boss, malus d'environnement,
# mutations, ambiance par monde, divers.
SK = {
    'meteor': [56, 'a flaming meteor crashing down diagonally from the top left, long fire trail, hits the ground with a fiery explosion and leaves a glowing crater, 10 frames'],
    'arrow_rain': [48, 'a volley of many arrows raining down vertically onto the ground with small dust impacts, 8 frames'],
    'prayer': [48, 'a soft golden vertical prayer light ray descending from above onto the ground with feathers of light, 8 frames'],
    'dawn_prayer': [48, 'a warm peach and pink dawn light beam descending with a sun halo and soft sparkles, 8 frames'],
    'blessing': [40, 'a golden blessing: glowing rune circle on the ground with rising golden sparkles and a small crown of light, 8 frames'],
    'divine_light': [48, 'a big divine pillar of white and pale yellow holy light descending from the sky with radiant rays, 8 frames'],
    'sacred_ray': [48, 'a narrow sacred golden laser ray striking down from above with a bright impact flare on the ground, 7 frames'],
    'judgement': [52, 'a giant blue and white holy sword of light falling from the sky and stabbing the ground with a shockwave, 9 frames'],
    'guardian_wings': [48, 'a pair of large translucent pale blue angel wings of light unfolding protectively then fading into feathers, 8 frames'],
    'frost_nova': [52, 'a frost nova: icy blue ring exploding outward along the ground with ice spikes popping up, 8 frames'],
    'eternal_winter': [56, 'a blizzard storm of snow and ice crystals swirling wide with tall ice spikes rising from the ground, 9 frames'],
    'frost_storm': [52, 'a row of sharp ice spikes erupting from the ground one after another, pale blue crystal, 8 frames'],
    'fireball': [36, 'a large fireball impact explosion with orange flames and black smoke, 8 frames'],
    'flame_spray': [48, 'a horizontal cone of flames spraying to the right, orange and yellow fire jet, 8 frames'],
    'hellfire': [56, 'several tall columns of hellfire erupting from the ground, red orange and black flames, 9 frames'],
    'ash_crown': [48, 'a crown of fire: a ring of flames rising in a circle on the ground with falling ash, 8 frames'],
    'void_orb': [40, 'a dark purple void orb pulsing then imploding with violet lightning and a black core, 8 frames'],
    'eclipse': [56, 'an eclipse: a black sun with a glowing purple corona appearing in the sky and casting dark rays down, 9 frames'],
    'heavy_cut': [44, 'a heavy red sword cleave: a thick crimson vertical slash arc with sparks, 6 frames'],
    'valiant_cut': [44, 'a valiant blue sword slash: wide bright blue horizontal arc with white edge, 6 frames'],
    'void_blade': [48, 'a purple void blade slash: dark violet crescent cutting through space leaving a black rift, 7 frames'],
    'shield_bash': [36, 'a blue shield bash impact: a shield shaped shockwave flash with radiating blue lines, 6 frames'],
    'taunt': [36, 'a red angry taunt: a pulsing red exclamation shockwave ring with red anger marks, 6 frames'],
    'rampart': [44, 'a golden stone rampart wall of light rising from the ground as a protective barrier, 8 frames'],
    'holy_shield': [44, 'a glowing blue hexagonal holy shield bubble appearing around a spot, shimmering, 8 frames'],
    'pierce_arrow': [48, 'a piercing arrow shot: a glowing beige arrow streak flying right with a long wind trail and shock rings, 7 frames'],
    'ranger_shot': [44, 'a green magic arrow flying right with leaves trailing behind and a green burst at the end, 7 frames'],
    'falcon': [44, 'a falcon made of golden green light swooping down diagonally and striking with feathers flying, 8 frames'],
    'low_strike': [36, 'a quick low purple dagger slash near the ground with a shadow trail, 6 frames'],
    'blade_dance': [48, 'a blade dance: many crossing pale lilac slashes in an X pattern flurry, 8 frames'],
    'thorn_waltz': [44, 'a swirl of pink rose petals and thorny vines spinning in a circle, 8 frames'],
    'blood_whirl': [48, 'a spinning red blood whirlwind slash circle with red droplets, 8 frames'],
    'execution': [52, 'an execution strike: a huge dark red and crimson vertical sword slash streak from top to bottom with white edge, blood red sparks burst at the bottom, 7 frames'],
    'twin_blades': [44, 'two crossing purple dagger slashes forming an X with sparks, 6 frames'],
    'flash_strike': [48, 'a flash strike: a purple lightning fast horizontal dash streak with afterimages, 6 frames'],
    'pierce': [44, 'a crimson spear thrust shock: long horizontal red streak with a pointed shock cone, 6 frames'],
    'axe_whirl': [48, 'a spinning orange axe whirlwind: circular orange slash arcs spinning, 8 frames'],
    'war_howl': [44, 'a red sonic howl: expanding red shockwave arcs going outward with red sparks, 7 frames'],
    'fury': [40, 'a fury aura: red flames and steam bursting upward around a spot, 8 frames'],
    'carnage': [52, 'carnage: multiple red slashes and a big red explosion of energy on the ground, 8 frames'],
    'bite': [28, 'a white animal bite: two rows of white fangs snapping shut with an impact star, 5 frames'],
    'frenzy': [36, 'orange frenzy: speed lines and orange sparks swirling upward, 7 frames'],
    'instinct': [36, 'golden instinct: a glowing yellow eye shape flashing with radiating lines, 6 frames'],
    'gold_rain': [44, 'a rain of shiny gold coins falling from above and bouncing with sparkles, 8 frames'],
    'claw': [32, 'three white claw slash marks scratching diagonally, 5 frames'],
    'dive': [40, 'a pale purple owl dive streak from above with feathers, 6 frames'],
    'fairy_heal': [40, 'fairy healing dust: mint green and pink sparkles swirling down in a spiral, 8 frames'],
    'sap_of_life': [44, 'green sap of life: glowing green vines and leaves sprouting from the ground with heal sparkles, 8 frames'],
    'harvest': [44, 'harvest: golden wheat and green leaves swirling upward with sparkles, 8 frames'],
    'ki_wave': [40, 'a cyan ki energy wave: a horizontal crescent wave of blue energy flying right, 6 frames'],
    'whirlwind': [44, 'a white grey tornado whirlwind spinning with dust and debris, looping 6 frames'],
    'war_cry': [44, 'a golden war cry shout: expanding golden shockwave rings with sparks, 7 frames'],
    'holy_smite': [44, 'a holy smite: a golden hammer of light slamming down with a cross shaped burst, 7 frames'],
    # v9.2.9 : nouveaux familiers
    'crystal_spikes': [40, 'a burst of sharp pale violet crystal shards flying outward and shattering with lilac sparkles, 7 frames'],
    'ember_breath': [44, 'a small dragon fire breath: a horizontal stream of glowing embers and orange flames shooting to the right, 7 frames'],
    'dragon_blaze': [52, 'a dragon blaze: a tall swirling pillar of red and orange dragon fire erupting from the ground with embers, 9 frames'],
    'jade_shell': [44, 'a jade turtle shell barrier: a translucent green hexagon shell dome forming over a spot with golden rune lines, 8 frames'],
    'jade_sanctuary': [48, 'a jade sanctuary: a green glowing rune circle on the ground with lotus flowers blooming and soft green light rising, 8 frames'],
    'foxfire': [36, 'blue foxfire: small floating cyan and blue spirit flames swirling then bursting into blue sparks, 7 frames'],
    'nine_tails': [48, 'nine tails: a fan of nine blue spirit flame tails sweeping forward as a blue wave with golden sparks, 8 frames'],
    'phoenix_feather': [40, 'phoenix feathers: glowing golden and red fire feathers drifting down in a spiral with warm healing sparkles, 8 frames'],
    'rebirth': [52, 'phoenix rebirth: a burst of golden fire wings spreading wide with a rising flame ring and healing embers, 9 frames'],
}
for _k, (_s, _d) in SK.items():
    VFX['sk_' + _k] = [_s, _d]
# v9.7.1 (lot E) : les 12 effets les plus vus refaits — taille doublée, 12 images, trois temps lisibles (départ, impact,
# dissipation) — et les soins, ralliement et bouclier (autrefois disques et colonnes tracés par le code).
THREE = ', 12 frames, three clearly readable stages: a short anticipation glow, a strong full impact, then a slow dissipation into smoke and sparks'
REMAKE = {
    'hit_slash': 'a white and pale blue crescent sword slash impact, a sharp diagonal arc with sparks',
    'hit_fire': 'a fire impact explosion: orange and yellow flames burst outward then curl up into dark smoke and embers',
    'hit_ice': 'an ice impact: pale blue ice crystals and shards shatter outward from a frosty burst, white highlights',
    'crit_flash': 'a critical hit flash: a big golden star shaped burst with sharp white rays',
    'sk_fireball': 'a big fireball flying right and exploding into a fiery orange blast with embers',
    'sk_frost_nova': 'a frost nova: a ring of ice spikes erupting outward from the ground with frosty mist',
    'sk_meteor': 'a flaming meteor falling diagonally from the sky and crashing into the ground with a huge fiery explosion and debris',
    'sk_arrow_rain': 'a rain of glowing arrows falling from the sky and striking the ground in a wide area with dust',
    'sk_divine_light': 'a divine light: a tall pillar of golden holy light descending from the sky with a cross shaped flare',
    'boss_appear': 'a boss summoning portal: dark red and black magic circle on the ground erupting with crimson flames and lightning',
    'boss_explode': 'a big boss defeat explosion: large fiery orange and yellow blast with smoke ring and flying debris',
    'level_up': 'a level up effect: golden rising pillar of light with spiraling sparkles and upward arrows of light',
}
for _k, _d in REMAKE.items():
    VFX[_k] = [min(128, max(64, VFX.get(_k, [48])[0] * 2)), _d + THREE]
VFX.update({
    'sk_heal': [96, 'a healing effect: soft green and mint light swirling upward around a spot with leaves and plus-shaped sparkles, no solid disc' + THREE],
    'sk_rally': [96, 'a rally war cry: golden shockwave rings expanding from the ground with rising golden sparks and banners of light, outline only' + THREE],
    'sk_shield': [96, 'a protective shield: a translucent pale blue hexagon barrier dome forming with rune lines, edges glowing, center transparent' + THREE],
})
VFX.update({
    # Mécaniques de boss
    'boss_shell_chip': [24, 'grey blue stone armor shell fragments chipping off and flying with a small flash, 6 frames'],
    'boss_summon_portal': [40, 'a cyan magic portal opening vertically with swirling energy, a ghost minion steps out, then closes, 9 frames'],
    'boss_rage': [44, 'rising orange and red rage flames and heat haze around a spot, looping 6 frames, empty center'],
    'boss_despair': [48, 'a pulsing crimson red despair aura with dark red smoke wisps rising, looping 6 frames, empty center'],
    'boss_tide': [44, 'a cyan blue water healing wave rising around a spot with bubbles and droplets, 8 frames'],
    # Malus d'environnement (sur le héros)
    'env_gloom': [40, 'a thin gloom veil: sparse wisps of dark purple fog and a few dim shadow particles drifting sideways, mostly empty, looping 6 frames'],
    'env_crystal': [28, 'small pink and purple crystal shards flying in and hitting with sparkles, 6 frames'],
    'env_thirst': [32, 'hot white steam vapor rising in wavy wisps, looping 6 frames'],
    'env_frost': [32, 'frost forming: pale blue ice crystals and snowflakes creeping and glinting, looping 6 frames'],
    'env_curse': [36, 'purple glowing curse runes circling slowly around a spot, looping 6 frames, empty center'],
    'env_mud': [28, 'brown mud splashes and drops splattering from the ground, 6 frames'],
    'env_gust': [40, 'white wind gust streaks and swirling wind lines blowing to the left, looping 6 frames'],
    'env_lava': [28, 'small orange lava embers and tiny flames popping from the ground at feet level, looping 6 frames'],
    'env_distort': [36, 'a glitch distortion: magenta and cyan pixel glitch blocks and scanlines flickering, looping 6 frames'],
    'env_pressure': [32, 'deep sea pressure: small bubbles being squashed and popping, blue, looping 6 frames'],
    'env_corrupt': [40, 'dark purple and black corruption tendrils wriggling up from the ground, looping 6 frames, empty center'],
    # Mutations
    'mut_split': [40, 'a green slime cell splitting in two with goo droplets flying, 8 frames'],
    'mut_block': [28, 'a yellow metal armor block flash: a shield icon spark with clang lines, 5 frames'],
    'mut_frenzy': [36, 'red frenzy steam and anger veins pulsing upward, looping 6 frames, empty center'],
    'mut_drain': [28, 'crimson life drain: red blood orbs streaming and absorbing into a point, 7 frames'],
    'mut_regen': [32, 'green regeneration: small green plus signs and leaves rising, looping 6 frames'],
    'mut_stomp': [44, 'a giant stomp: heavy brown ground crack shockwave with rocks and dust spreading sideways, 6 frames, wide and low'],
    # Ambiance par monde (petites particules en boucle)
    'amb_fireflies': [24, 'a few glowing yellow green fireflies drifting and blinking, looping 8 frames, sparse'],
    'amb_pollen': [24, 'small floating white and yellow pollen motes drifting, looping 8 frames, sparse'],
    'amb_crystal': [24, 'tiny cyan crystal sparkles twinkling in the dark, looping 8 frames, sparse'],
    'amb_sand': [32, 'thin streaks of blowing sand dust drifting left, looping 8 frames, sparse'],
    'amb_snow': [32, 'gentle white snowflakes falling, looping 8 frames, sparse'],
    'amb_wisps': [24, 'small ghostly purple wisps floating, looping 8 frames, sparse'],
    'amb_leaves': [32, 'a few green and brown leaves falling and twirling, looping 8 frames, sparse'],
    'amb_clouds': [32, 'tiny white wind wisps and feathers drifting, looping 8 frames, sparse'],
    'amb_ash': [32, 'falling grey ash flakes and orange embers floating up, looping 8 frames, sparse'],
    'amb_lightning': [48, 'a distant purple lightning bolt flashing in the sky far away, 6 frames'],
    'amb_stars': [48, 'a shooting star streaking diagonally across the sky with a sparkle trail, 7 frames'],
    'amb_bubbles': [24, 'small rising translucent bubbles, looping 8 frames, sparse'],
    'amb_spores': [24, 'glowing teal bioluminescent spores drifting slowly, looping 8 frames, sparse'],
    # Divers
    'combo_burst': [40, 'a combo burst: a yellow and orange comic style impact star explosion with lines, 6 frames'],
    'hero_rage': [44, 'a red battle rage aura of flames rising around a spot, looping 6 frames, empty center'],
    'shield_absorb': [36, 'a blue energy shield bubble flashing as it absorbs a hit with hexagon ripples, 6 frames'],
    'miss_whiff': [28, 'a missed attack whiff: grey swoosh lines with a small puff of air, 5 frames'],
    'stun_stars': [24, 'dizzy stun: three small yellow stars circling in a ring, looping 6 frames'],
    'poison_bubbles': [24, 'small toxic green bubbles rising and popping, looping 6 frames'],
    'wave_clear': [64, 'a wave cleared victory burst: golden firework explosion with confetti stars and sparkles, 9 frames'],
    'teleport': [44, 'a cyan blue teleport beam: vertical column of light with rings and sparkles materializing, 8 frames'],
    # v9.3.0 : World Boss (Colosse des Anciens) — jet de pierre et rayon des yeux
    'wb_boulder': [30, 'a big jagged dark grey-green stone boulder with cracks and patches of green moss, dark outline and shading, rotating as it flies, a few small pebbles, looping 6 frames, no trail'],
    'wb_rock_impact': [72, 'a giant dark grey stone boulder smashing into the ground: a bright yellow white impact flash, the boulder bursts into many dark grey rock chunks flying up and out with dark outlines, brown dirt spray and cracks, 9 frames, wide'],
    'wb_rock_dust': [64, 'a thick billowing cloud of beige and grey dust rolling outward along the ground after a heavy impact, slowly settling, 9 frames, wide and low'],
    'wb_eye_charge': [26, 'a bright turquoise and white light energy gathering into a small glowing point, tiny light particles converging inward, star glint, 8 frames'],
    'wb_beam_flash': [40, 'a bright turquoise and white light beam impact flare: radiant burst with sharp rays and sparks at the point where a laser hits the ground, 7 frames'],
    'wb_beam_burn': [48, 'a burning scorch mark on the ground left by a laser: a glowing turquoise and white hot molten line with bright flames, sparks and grey smoke rising from it, fading to a dark burnt mark, 8 frames, wide and low'],
})


def _key():
    k = os.environ.get('PIXELLAB_API_KEY')
    if not k:
        sys.exit('PIXELLAB_API_KEY manquante')
    return k


def _req(method, url, body=None):
    r = urllib.request.Request(API + url, method=method, data=json.dumps(body).encode() if body else None,
                               headers={'Authorization': 'Bearer ' + _key(), 'Content-Type': 'application/json'})
    try:
        return json.load(urllib.request.urlopen(r, timeout=180))
    except urllib.error.HTTPError as e:
        return {'error': e.code, 'body': e.read().decode()[:400]}


def balance():
    return _req('GET', '/balance')['subscription']['generations']


def gen_one(name):
    size, desc = VFX[name]
    j = _req('POST', '/vfx', {'description': STYLE + desc, 'artist': 'lite', 'name': 'ascendrya_' + name})
    if 'error' in j:
        print(name, 'ERREUR', j, flush=True)
        return False
    jid = j.get('background_job_id') or j.get('id')
    s = {}
    for _ in range(60):
        time.sleep(8)
        s = _req('GET', f'/background-jobs/{jid}')
        if s.get('status') in ('completed', 'failed'):
            break
    if s.get('status') != 'completed':
        print(name, 'ÉCHEC', str(s)[:300], flush=True)
        return False
    lr = s['last_response']
    files = lr.get('files') or {}
    items = files.items() if isinstance(files, dict) else [(f.get('name', ''), f.get('url')) for f in files]
    got = {}
    for fname, url in items:
        url = url if isinstance(url, str) else (url or {}).get('url')
        if not url:
            continue
        for ext in ('.png', '.json'):
            if fname.endswith(ext) and '-normals' not in fname and not got.get(ext):
                got[ext] = urllib.request.urlopen(url, timeout=120).read()
    if '.png' not in got:
        print(name, 'pas de planche', json.dumps(lr)[:400], flush=True)
        return False
    open(os.path.join(SRC, name + '.png'), 'wb').write(got['.png'])
    meta = {k: lr.get(k) for k in ('canvas', 'frames', 'fps', 'loop', 'anchor', 'message', 'effect_id')}
    if '.json' in got:
        meta['sheet'] = json.loads(got['.json'])
    json.dump(meta, open(os.path.join(SRC, name + '.json'), 'w'), ensure_ascii=False, indent=1)
    print(name, 'ok', lr.get('canvas'), lr.get('frames'), flush=True)
    return True


def gen(names):
    os.makedirs(SRC, exist_ok=True)
    todo = names or [n for n in VFX if not os.path.exists(os.path.join(SRC, n + '.png'))]
    b0 = balance()
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(6) as ex:
        list(ex.map(gen_one, todo))
    b1 = balance()
    print('coût', b0 - b1, 'générations, reste', b1, flush=True)


def _frames(name):
    im = Image.open(os.path.join(SRC, name + '.png')).convert('RGBA')
    meta = json.load(open(os.path.join(SRC, name + '.json')))
    out = []
    for f in meta['sheet']['frames']:
        r = f['frame']
        fr = im.crop((r['x'], r['y'], r['x'] + r['w'], r['y'] + r['h']))
        # Alpha franc (pas de demi-transparence : le jeu dessine pixel net) et poussières isolées retirées.
        px = fr.load()
        for y in range(fr.height):
            for x in range(fr.width):
                c = px[x, y]
                px[x, y] = (c[0], c[1], c[2], 255) if c[3] >= 110 else (0, 0, 0, 0)
        out.append((fr, f.get('duration', 100)))
    # Images vides retirées (la fin d'un effet s'efface déjà par le lecteur).
    while out and out[-1][0].getbbox() is None:
        out.pop()
    while out and out[0][0].getbbox() is None:
        out.pop(0)
    anchor = meta.get('anchor') or {'x': out[0][0].width // 2, 'y': out[0][0].height // 2}
    return out, anchor, meta.get('loop', False)


def _pack(items, width=1024):
    """Rangement en étagères : items = [(clé, w, h)] -> {clé: (x, y)}, hauteur totale."""
    pos, x, y, row = {}, 0, 0, 0
    for k, w, h in sorted(items, key=lambda i: -i[2]):
        if x + w > width:
            x, y, row = 0, y + row + 1, 0
        pos[k] = (x, y)
        x += w + 1
        row = max(row, h)
    return pos, y + row


def build():
    effects, items, crops = {}, [], {}
    for name, (size, _desc) in VFX.items():
        if not os.path.exists(os.path.join(SRC, name + '.png')):
            print('manque', name)
            continue
        frames, anchor, loop = _frames(name)
        box = None
        for fr, _d in frames:
            b = fr.getbbox()
            if b:
                box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
        w, h = box[2] - box[0], box[3] - box[1]
        for i, (fr, _d) in enumerate(frames):
            crops[(name, i)] = fr.crop(box)
            items.append(((name, i), w, h))
        effects[name] = {'w': w, 'h': h, 'n': len(frames), 'ms': [d for _f, d in frames],
                         'ax': anchor['x'] - box[0], 'ay': anchor['y'] - box[1], 'loop': bool(loop),
                         'scale': round(size / max(w, h), 4)}
    pos, height = _pack(items)
    atlas = Image.new('RGBA', (1024, height + 1), (0, 0, 0, 0))
    for k, (x, y) in pos.items():
        atlas.paste(crops[k], (x, y))
    for name, e in effects.items():
        e['f'] = [list(pos[(name, i)]) for i in range(e['n'])]
    # Atlas indexé (palette commune de 255 teintes + transparent) : bien plus léger qu'en RGBA.
    rgb = atlas.convert('RGB')
    alpha = atlas.getchannel('A')
    q = rgb.quantize(colors=255, method=Image.MEDIANCUT, dither=Image.NONE)
    pal = q.getpalette()[:255 * 3]
    data = bytes(0 if a == 0 else v + 1 for v, a in zip(q.tobytes(), alpha.tobytes()))
    q2 = Image.frombytes('P', atlas.size, data)
    q2.putpalette([0, 0, 0] + pal)  # indice 0 : transparent
    buf = io.BytesIO()
    q2.save(buf, 'PNG', optimize=True, transparency=0)
    png = buf.getvalue()
    q2.save(os.path.join(SRC, '_atlas.png'), optimize=True, transparency=0)
    with open(OUT, 'w') as f:
        f.write('// FICHIER GÉNÉRÉ par tools/art/pixellab_vfx.py — ne pas modifier à la main.\n')
        f.write('// v9.2.6 : effets de combat dessinés image par image par PixelLab (impacts, critiques, projectiles, morts,\n')
        f.write('// butin, niveau, soins, auras, boss, poussières). Atlas PNG indexé ; `scale` ramène l\'effet à sa taille de jeu.\n')
        f.write('export const VFX_ATLAS = \'data:image/png;base64,' + base64.b64encode(png).decode() + '\';\n')
        f.write('export const VFX = ' + json.dumps(effects, separators=(',', ':')) + ';\n')
    print('atlas', atlas.size, len(png) // 1024, 'Kio,', len(effects), 'effets')


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'build'
    if cmd == 'bal':
        print(balance())
    elif cmd == 'gen':
        gen(sys.argv[2:])
    else:
        build()
