class_name SaveFile
extends RefCounted
## Lecture/écriture de la sauvegarde JSON avec écriture atomique :
## on écrit d'abord un fichier temporaire, puis on le renomme.
## Une coupure pendant l'écriture ne corrompt donc pas l'ancienne sauvegarde.

const DEFAULT_PATH := "user://save.json"


static func write_atomic(path: String, data: Dictionary) -> bool:
	var tmp_path := path + ".tmp"
	var file := FileAccess.open(tmp_path, FileAccess.WRITE)
	if file == null:
		push_error("Sauvegarde impossible : %s" % error_string(FileAccess.get_open_error()))
		return false
	file.store_string(JSON.stringify(data, "\t"))
	file.close()

	var global_tmp := ProjectSettings.globalize_path(tmp_path)
	var global_path := ProjectSettings.globalize_path(path)
	var err := DirAccess.rename_absolute(global_tmp, global_path)
	if err != OK:
		push_error("Renommage de la sauvegarde échoué : %s" % error_string(err))
		return false
	return true


## Retourne le dictionnaire sauvegardé, ou un dictionnaire vide si absent / illisible.
static func read(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {}
	var parsed = JSON.parse_string(FileAccess.get_file_as_string(path))
	if typeof(parsed) != TYPE_DICTIONARY:
		push_warning("Sauvegarde illisible, ignorée : %s" % path)
		return {}
	return parsed
