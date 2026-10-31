// Produit l'empreinte d'un mot de passe pour ADMIN_PASSWORD_HASH (/etc/idle-rpg.env).
// Usage : node tools/hash-password.mjs < fichier-contenant-le-mot-de-passe
// Le mot de passe n'apparaît ni en argument ni dans l'historique du shell.
import { hashPassword } from '../server/app.mjs';

let input = '';
for await (const chunk of process.stdin) input += chunk;
const password = input.replace(/\r?\n$/, '');
if (password.length < 12) {
  console.error('Mot de passe admin : 12 caractères minimum.');
  process.exit(1);
}
console.log(await hashPassword(password));
