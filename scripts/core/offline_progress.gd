class_name OfflineProgress
extends RefCounted
## Calcule les gains hors ligne à partir de l'horodatage de la dernière sauvegarde.
## Logique pure (sans nœud ni état) : facile à tester.


## Retourne un dictionnaire :
##   elapsed_seconds : durée réellement prise en compte (après plafond)
##   gold            : or gagné (entier)
##   capped          : true si la limite hors ligne a été atteinte
##   clock_suspicious: true si l'horodatage est dans le futur (horloge modifiée ?)
static func compute(last_saved_unix: int, now_unix: int, gold_per_second: float, balance: Dictionary) -> Dictionary:
	var offline: Dictionary = balance["offline"]
	var elapsed := float(now_unix - last_saved_unix)

	# Pas de sauvegarde valide, ou horloge reculée : aucun gain fictif.
	if last_saved_unix <= 0 or elapsed < 0.0:
		return {"elapsed_seconds": 0.0, "gold": 0, "capped": false, "clock_suspicious": elapsed < 0.0}

	var cap_seconds := float(offline["cap_hours"]) * 3600.0
	var counted := minf(elapsed, cap_seconds)
	var multiplier := float(offline["farm_multiplier"])
	var gold := int(floorf(counted * maxf(gold_per_second, 0.0) * multiplier))

	return {
		"elapsed_seconds": counted,
		"gold": gold,
		"capped": elapsed > cap_seconds,
		"clock_suspicious": false,
	}
