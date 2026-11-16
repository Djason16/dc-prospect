#!/usr/bin/env bash
# Menu of the project on macOS and Linux (start.bat and start.ps1 on Windows): ./start.sh, or ./start.sh D
# The menu texts are read by the user: in French
cd "$(dirname "$0")" || exit 1
build=build:linux
[ "$(uname)" = Darwin ] && build=build:mac
install() { echo 'Installation des dépendances...'; npm install; }
action=$(printf '%s' "$1" | tr '[:lower:]' '[:upper:]')
if [ -z "$action" ]; then
    echo
    echo '  DC PROSPECT'
    echo
    echo '  D  Développement   Lance l'"'"'application en mode développement (fenêtre Electron)'
    echo '  M  Moteur seul     Le moteur sans fenêtre, page sur http://localhost:4747'
    echo '  T  Tester          Vérifie le dossier, la signature, l'"'"'envoi, Claude et le registre, sans rien envoyer'
    echo '  I  Installer       npm install (après un git clone ou un paquet ajouté)'
    echo "  B  Build           Fabrique l'application de ce système dans dist/ (npm run $build)"
    echo
    read -r -p '  Ton choix : ' action
    action=$(printf '%s' "$action" | tr '[:lower:]' '[:upper:]')
fi
case "$action" in
    D) [ -d node_modules ] || install; npm start ;;
    M) [ -d node_modules ] || install; npm run engine ;;
    T) npm run check ;;
    I) install ;;
    B) npm run "$build" ;;
    *) echo 'Choix inconnu' ;;
esac
