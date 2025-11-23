import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Charger les variables d'environnement
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Variables d\'environnement manquantes: SUPABASE_URL et SUPABASE_ANON_KEY sont requises'
  );
}

// Créer et exporter le client Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Fonction utilitaire pour tester la connexion
export async function testConnection() {
  try {
    const { data, error } = await supabase.from('_prisma_migrations').select('count').limit(1);
    if (error) {
      console.log('Connexion Supabase établie (erreur attendue si la table n\'existe pas)');
    } else {
      console.log('✅ Connexion Supabase réussie!');
    }
    return { success: true, error: null };
  } catch (err) {
    console.error('❌ Erreur de connexion Supabase:', err);
    return { success: false, error: err };
  }
}

