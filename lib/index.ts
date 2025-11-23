import { supabase, testConnection } from './supabase.js';

// Exemple d'utilisation
async function main() {
  console.log('Test de connexion à Supabase...');
  await testConnection();
}

// Exécuter si le fichier est lancé directement
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { supabase, testConnection };

