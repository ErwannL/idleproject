#!/usr/bin/env bash
# Installe et lance Ascendrya (Linux : AppImage ; macOS : plus de version publiée) depuis la dernière release GitHub.
# Usage : curl -fsSL https://github.com/ErwannL/idleproject/releases/latest/download/ascendrya.sh | bash
set -eu

BASE="https://github.com/ErwannL/idleproject/releases/latest/download"
API="https://api.github.com/repos/ErwannL/idleproject/releases/latest"
DEST="${HOME}/.local/share/ascendrya"

say() { printf '%s\n' "$*"; }
die() { printf 'Erreur : %s\n' "$*" >&2; exit 1; }

fetch() { # fetch URL FICHIER
  if command -v curl >/dev/null 2>&1; then curl -fL --progress-bar -o "$2" "$1"
  elif command -v wget >/dev/null 2>&1; then wget -O "$2" "$1"
  else die "curl ou wget est requis."; fi
}

# Version de la dernière release (les fichiers portent la version dans leur nom).
latest_version() {
  if command -v curl >/dev/null 2>&1; then body="$(curl -fsSL "$API")"; else body="$(wget -qO- "$API")"; fi
  printf '%s' "$body" | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"v\{0,1\}\([^"]*\)".*/\1/p' | head -n 1
}

OS="$(uname -s)"
ARCH="$(uname -m)"
VERSION="$(latest_version)" || true
[ -n "${VERSION:-}" ] || die "impossible de trouver la dernière version."
mkdir -p "$DEST"

case "$OS" in
  Linux)
    case "$ARCH" in x86_64|amd64) ;; *) die "architecture Linux non prise en charge : $ARCH (x86_64 uniquement)." ;; esac
    FILE="IdleRPG-${VERSION}.AppImage"
    TARGET="$DEST/Ascendrya.AppImage"
    say "Téléchargement d'Ascendrya ${VERSION}..."
    fetch "$BASE/$FILE" "$TARGET.part"
    mv "$TARGET.part" "$TARGET"
    chmod +x "$TARGET"
    APPS="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
    mkdir -p "$APPS"
    cat > "$APPS/ascendrya.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Ascendrya
Comment=RPG incrémental
Exec="$TARGET" %U
Terminal=false
Categories=Game;RolePlaying;
EOF
    say "Installé : $TARGET (entrée de menu ajoutée)."
    say "Lancement..."
    # Sans FUSE (conteneurs, certaines distributions), l'AppImage s'extrait elle-même.
    if [ -e /dev/fuse ]; then nohup "$TARGET" >/dev/null 2>&1 &
    else nohup "$TARGET" --appimage-extract-and-run >/dev/null 2>&1 &
    fi
    ;;
  Darwin)
    # Plus de version Mac publiée (build macOS trop coûteux en minutes GitHub Actions).
    die "pas de version macOS : utilise l'installateur Windows (IdleRPG-${VERSION}-setup.exe) avec un outil de compatibilité." ;;
  *) die "système non pris en charge : $OS (Linux ou macOS)." ;;
esac
