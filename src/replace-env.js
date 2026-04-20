import fs from 'fs';

console.log('🔍 Variables de entorno disponibles:');
console.log('API_URL:', process.env.API_URL ?? 'NO DEFINIDA');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ?? 'NO DEFINIDA');
console.log('SUPABASE_KEY:', process.env.SUPABASE_KEY ? 'OK' : 'NO DEFINIDA');
console.log('BASE_DOMAIN:', process.env.BASE_DOMAIN ?? 'NO DEFINIDA');

const file = 'src/environments/environment.ts';
let content = fs.readFileSync(file, 'utf8');

const replacements = {
  'API_URL':      process.env.API_URL,
  'SUPABASE_URL': process.env.SUPABASE_URL,
  'SUPABASE_KEY': process.env.SUPABASE_KEY,
  'BASE_DOMAIN':  process.env.BASE_DOMAIN,
};

for (const [placeholder, value] of Object.entries(replacements)) {
  if (!value) { console.warn(`⚠️  ${placeholder} no definida`); continue; }
  content = content.replaceAll(placeholder, value);
  console.log(`✅ ${placeholder} reemplazado`);
}

fs.writeFileSync(file, content);
console.log('✅ environment.production.ts actualizado');
console.log('📄 Contenido final:');
console.log(fs.readFileSync(file, 'utf8'));