class_name NumberFormat
extends RefCounted
## Formate les grands nombres pour l'affichage (ex. 1,2 K, 3,4 M).
## N'affecte que le texte affiché : les valeurs sauvegardées restent exactes.

const SUFFIXES := ["", "K", "M", "B", "T"]


static func short(value: float) -> String:
	var v := value
	var index := 0
	while absf(v) >= 1000.0 and index < SUFFIXES.size() - 1:
		v /= 1000.0
		index += 1

	var text: String
	if index == 0:
		text = str(int(floorf(v)))
	else:
		text = "%.1f" % v
		# Séparateur décimal français, et on retire le ",0" inutile.
		text = text.replace(".", ",")
		if text.ends_with(",0"):
			text = text.trim_suffix(",0")

	return text if index == 0 else "%s %s" % [text, SUFFIXES[index]]
