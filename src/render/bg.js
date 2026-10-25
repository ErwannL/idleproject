// FICHIER GÉNÉRÉ par tools/art/build.py — ne pas modifier à la main.
// Décor de chaque zone : dégradé du ciel, couleur du sol et calques (assets/bg), du fond vers l'avant.
// anchor "ground" : y relatif à la ligne du sol ; "top" : y depuis le haut ; factor : parallaxe.
export const BG = {
  "plains": {
    "sky": [
      "#3d8ee0",
      "#64aeee",
      "#98cff4",
      "#cdeaf8"
    ],
    "ground": "#1e1814",
    "layers": [
      {
        "file": "plains_clouds.png",
        "factor": 0.03,
        "anchor": "top",
        "y": 2,
        "front": false,
        "drift": 2
      },
      {
        "file": "plains_far.png",
        "factor": 0.08,
        "anchor": "ground",
        "y": -122,
        "front": false
      },
      {
        "file": "plains_hills.png",
        "factor": 0.18,
        "anchor": "ground",
        "y": -110,
        "front": false
      },
      {
        "file": "plains_trees.png",
        "factor": 0.4,
        "anchor": "ground",
        "y": -116,
        "front": false
      },
      {
        "file": "plains_near.png",
        "factor": 0.7,
        "anchor": "ground",
        "y": -62,
        "front": false
      },
      {
        "file": "plains_ground.png",
        "factor": 1.0,
        "anchor": "ground",
        "y": -8,
        "front": false
      },
      {
        "file": "plains_front.png",
        "factor": 1.25,
        "anchor": "ground",
        "y": 7,
        "front": true
      }
    ]
  },
  "forest": {
    "sky": [
      "#0f3a3c",
      "#1a5a58",
      "#2a7e74",
      "#52a490"
    ],
    "ground": "#0e1816",
    "layers": [
      {
        "file": "forest_canopy.png",
        "factor": 0.3,
        "anchor": "top",
        "y": 0,
        "front": false
      },
      {
        "file": "forest_far.png",
        "factor": 0.07,
        "anchor": "ground",
        "y": -158,
        "front": false
      },
      {
        "file": "forest_ruins.png",
        "factor": 0.2,
        "anchor": "ground",
        "y": -126,
        "front": false
      },
      {
        "file": "forest_trees.png",
        "factor": 0.42,
        "anchor": "ground",
        "y": -128,
        "front": false
      },
      {
        "file": "forest_near.png",
        "factor": 0.7,
        "anchor": "ground",
        "y": -62,
        "front": false
      },
      {
        "file": "forest_ground.png",
        "factor": 1.0,
        "anchor": "ground",
        "y": -8,
        "front": false
      },
      {
        "file": "forest_front.png",
        "factor": 1.25,
        "anchor": "ground",
        "y": 7,
        "front": true
      }
    ]
  },
  "caves": {
    "sky": [
      "#06050e",
      "#0d0a1e",
      "#151232",
      "#1c1840"
    ],
    "ground": "#0c0a18",
    "layers": [
      {
        "file": "caves_ceiling_far.png",
        "factor": 0.12,
        "anchor": "top",
        "y": 0,
        "front": false
      },
      {
        "file": "caves_far.png",
        "factor": 0.08,
        "anchor": "ground",
        "y": -178,
        "front": false
      },
      {
        "file": "caves_pools.png",
        "factor": 0.22,
        "anchor": "ground",
        "y": -130,
        "front": false
      },
      {
        "file": "caves_ceiling.png",
        "factor": 0.4,
        "anchor": "top",
        "y": 0,
        "front": false
      },
      {
        "file": "caves_mine.png",
        "factor": 0.45,
        "anchor": "ground",
        "y": -108,
        "front": false
      },
      {
        "file": "caves_near.png",
        "factor": 0.7,
        "anchor": "ground",
        "y": -58,
        "front": false
      },
      {
        "file": "caves_ground.png",
        "factor": 1.0,
        "anchor": "ground",
        "y": -8,
        "front": false
      },
      {
        "file": "caves_front.png",
        "factor": 1.25,
        "anchor": "ground",
        "y": 7,
        "front": true
      }
    ]
  },
  "desert": {
    "sky": [
      "#d8502a",
      "#ea7436",
      "#f49e50",
      "#fac880"
    ],
    "ground": "#3a1c10",
    "layers": [
      {
        "file": "desert_sun.png",
        "factor": 0.01,
        "anchor": "top",
        "y": 0,
        "front": false
      },
      {
        "file": "desert_clouds.png",
        "factor": 0.03,
        "anchor": "top",
        "y": 0,
        "front": false,
        "drift": 1
      },
      {
        "file": "desert_far.png",
        "factor": 0.07,
        "anchor": "ground",
        "y": -108,
        "front": false
      },
      {
        "file": "desert_canyon.png",
        "factor": 0.18,
        "anchor": "ground",
        "y": -102,
        "front": false
      },
      {
        "file": "desert_bones.png",
        "factor": 0.42,
        "anchor": "ground",
        "y": -98,
        "front": false
      },
      {
        "file": "desert_near.png",
        "factor": 0.7,
        "anchor": "ground",
        "y": -58,
        "front": false
      },
      {
        "file": "desert_ground.png",
        "factor": 1.0,
        "anchor": "ground",
        "y": -8,
        "front": false
      },
      {
        "file": "desert_front.png",
        "factor": 1.25,
        "anchor": "ground",
        "y": 7,
        "front": true
      }
    ]
  },
  "mountains": {
    "sky": [
      "#2a66cc",
      "#4a8ce0",
      "#82baf0",
      "#c6e4fa"
    ],
    "ground": "#141c30",
    "layers": [
      {
        "file": "mountains_clouds.png",
        "factor": 0.03,
        "anchor": "top",
        "y": 4,
        "front": false,
        "drift": 3
      },
      {
        "file": "mountains_far.png",
        "factor": 0.05,
        "anchor": "ground",
        "y": -148,
        "front": false
      },
      {
        "file": "mountains_castle.png",
        "factor": 0.15,
        "anchor": "ground",
        "y": -132,
        "front": false
      },
      {
        "file": "mountains_pines.png",
        "factor": 0.4,
        "anchor": "ground",
        "y": -108,
        "front": false
      },
      {
        "file": "mountains_near.png",
        "factor": 0.7,
        "anchor": "ground",
        "y": -62,
        "front": false
      },
      {
        "file": "mountains_ground.png",
        "factor": 1.0,
        "anchor": "ground",
        "y": -8,
        "front": false
      },
      {
        "file": "mountains_front.png",
        "factor": 1.25,
        "anchor": "ground",
        "y": 7,
        "front": true
      }
    ]
  },
  "cursed": {
    "sky": [
      "#180406",
      "#420a0c",
      "#781410",
      "#b0301a"
    ],
    "ground": "#0e0808",
    "layers": [
      {
        "file": "cursed_moon.png",
        "factor": 0.01,
        "anchor": "top",
        "y": 0,
        "front": false
      },
      {
        "file": "cursed_smoke.png",
        "factor": 0.03,
        "anchor": "top",
        "y": 0,
        "front": false,
        "drift": 1.5
      },
      {
        "file": "cursed_far.png",
        "factor": 0.06,
        "anchor": "ground",
        "y": -128,
        "front": false
      },
      {
        "file": "cursed_demon.png",
        "factor": 0.15,
        "anchor": "ground",
        "y": -118,
        "front": false
      },
      {
        "file": "cursed_pillars.png",
        "factor": 0.4,
        "anchor": "ground",
        "y": -108,
        "front": false
      },
      {
        "file": "cursed_near.png",
        "factor": 0.7,
        "anchor": "ground",
        "y": -62,
        "front": false
      },
      {
        "file": "cursed_ground.png",
        "factor": 1.0,
        "anchor": "ground",
        "y": -8,
        "front": false
      },
      {
        "file": "cursed_front.png",
        "factor": 1.25,
        "anchor": "ground",
        "y": 7,
        "front": true
      }
    ]
  },
  "swamp": {
    "sky": [
      "#121c1a",
      "#203628",
      "#3a5638",
      "#7a8e52"
    ],
    "ground": "#0a100a",
    "layers": [
      {
        "file": "swamp_moon.png",
        "factor": 0.01,
        "anchor": "top",
        "y": 0,
        "front": false
      },
      {
        "file": "swamp_clouds.png",
        "factor": 0.03,
        "anchor": "top",
        "y": 0,
        "front": false,
        "drift": 1
      },
      {
        "file": "swamp_far.png",
        "factor": 0.06,
        "anchor": "ground",
        "y": -128,
        "front": false
      },
      {
        "file": "swamp_marsh.png",
        "factor": 0.18,
        "anchor": "ground",
        "y": -122,
        "front": false
      },
      {
        "file": "swamp_trees.png",
        "factor": 0.4,
        "anchor": "ground",
        "y": -148,
        "front": false
      },
      {
        "file": "swamp_fog.png",
        "factor": 0.55,
        "anchor": "ground",
        "y": -36,
        "front": false,
        "drift": 4
      },
      {
        "file": "swamp_near.png",
        "factor": 0.7,
        "anchor": "ground",
        "y": -62,
        "front": false
      },
      {
        "file": "swamp_ground.png",
        "factor": 1.0,
        "anchor": "ground",
        "y": -8,
        "front": false
      },
      {
        "file": "swamp_front.png",
        "factor": 1.25,
        "anchor": "ground",
        "y": 7,
        "front": true
      }
    ]
  },
  "sky": {
    "sky": [
      "#2a66d8",
      "#5294f0",
      "#94c6f8",
      "#e2f2ff"
    ],
    "ground": "#2a2c4a",
    "layers": [
      {
        "file": "sky_sun.png",
        "factor": 0.01,
        "anchor": "top",
        "y": 0,
        "front": false
      },
      {
        "file": "sky_clouds.png",
        "factor": 0.03,
        "anchor": "top",
        "y": 4,
        "front": false,
        "drift": 3
      },
      {
        "file": "sky_far.png",
        "factor": 0.05,
        "anchor": "ground",
        "y": -158,
        "front": false
      },
      {
        "file": "sky_islands.png",
        "factor": 0.16,
        "anchor": "ground",
        "y": -148,
        "front": false
      },
      {
        "file": "sky_temples.png",
        "factor": 0.4,
        "anchor": "ground",
        "y": -148,
        "front": false
      },
      {
        "file": "sky_near.png",
        "factor": 0.7,
        "anchor": "ground",
        "y": -62,
        "front": false
      },
      {
        "file": "sky_ground.png",
        "factor": 1.0,
        "anchor": "ground",
        "y": -8,
        "front": false
      },
      {
        "file": "sky_front.png",
        "factor": 1.25,
        "anchor": "ground",
        "y": 7,
        "front": true
      }
    ]
  },
  "volcano": {
    "sky": [
      "#120808",
      "#30120c",
      "#62200e",
      "#b44c16"
    ],
    "ground": "#08060a",
    "layers": [
      {
        "file": "volcano_smoke.png",
        "factor": 0.03,
        "anchor": "top",
        "y": 0,
        "front": false,
        "drift": 1.5
      },
      {
        "file": "volcano_far.png",
        "factor": 0.05,
        "anchor": "ground",
        "y": -248,
        "front": false
      },
      {
        "file": "volcano_ash.png",
        "factor": 0.08,
        "anchor": "top",
        "y": 0,
        "front": false,
        "drift": 7
      },
      {
        "file": "volcano_flows.png",
        "factor": 0.17,
        "anchor": "ground",
        "y": -132,
        "front": false
      },
      {
        "file": "volcano_forge.png",
        "factor": 0.4,
        "anchor": "ground",
        "y": -132,
        "front": false
      },
      {
        "file": "volcano_near.png",
        "factor": 0.7,
        "anchor": "ground",
        "y": -62,
        "front": false
      },
      {
        "file": "volcano_ground.png",
        "factor": 1.0,
        "anchor": "ground",
        "y": -8,
        "front": false
      },
      {
        "file": "volcano_front.png",
        "factor": 1.25,
        "anchor": "ground",
        "y": 7,
        "front": true
      }
    ]
  },
  "void": {
    "sky": [
      "#04020c",
      "#0c0624",
      "#1c0e44",
      "#301660"
    ],
    "ground": "#06040e",
    "layers": [
      {
        "file": "void_stars.png",
        "factor": 0.01,
        "anchor": "top",
        "y": 0,
        "front": false
      },
      {
        "file": "void_nebula.png",
        "factor": 0.02,
        "anchor": "top",
        "y": 0,
        "front": false,
        "drift": 0.6
      },
      {
        "file": "void_far.png",
        "factor": 0.05,
        "anchor": "ground",
        "y": -178,
        "front": false
      },
      {
        "file": "void_platforms.png",
        "factor": 0.16,
        "anchor": "ground",
        "y": -148,
        "front": false
      },
      {
        "file": "void_monoliths.png",
        "factor": 0.4,
        "anchor": "ground",
        "y": -148,
        "front": false
      },
      {
        "file": "void_near.png",
        "factor": 0.7,
        "anchor": "ground",
        "y": -62,
        "front": false
      },
      {
        "file": "void_ground.png",
        "factor": 1.0,
        "anchor": "ground",
        "y": -8,
        "front": false
      },
      {
        "file": "void_front.png",
        "factor": 1.25,
        "anchor": "ground",
        "y": 7,
        "front": true
      }
    ]
  },
  "abyss": {
    "sky": [
      "#070304",
      "#160608",
      "#2c0a0a",
      "#561a0e"
    ],
    "ground": "#060304",
    "layers": [
      {
        "file": "abyss_far.png",
        "factor": 0.04,
        "anchor": "ground",
        "y": -188,
        "front": false
      },
      {
        "file": "abyss_vault.png",
        "factor": 0.08,
        "anchor": "top",
        "y": 0,
        "front": false
      },
      {
        "file": "abyss_hall.png",
        "factor": 0.15,
        "anchor": "ground",
        "y": -158,
        "front": false
      },
      {
        "file": "abyss_columns.png",
        "factor": 0.4,
        "anchor": "ground",
        "y": -158,
        "front": false
      },
      {
        "file": "abyss_near.png",
        "factor": 0.7,
        "anchor": "ground",
        "y": -62,
        "front": false
      },
      {
        "file": "abyss_ground.png",
        "factor": 1.0,
        "anchor": "ground",
        "y": -8,
        "front": false
      },
      {
        "file": "abyss_front.png",
        "factor": 1.25,
        "anchor": "ground",
        "y": 7,
        "front": true
      }
    ]
  }
};
