import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Client } from 'pg';

for (const file of ['.env.local','.env']) if (fs.existsSync(file)) process.loadEnvFile(file);
const url=process.env.MIGRATION_DATABASE_URL;
if(!url) throw new Error('Set MIGRATION_DATABASE_URL explicitly to the bootstrap/migration database account.');
const client=new Client({connectionString:url});await client.connect();
try{
  await client.query('SELECT pg_advisory_lock(772034911)');
  await client.query('CREATE TABLE IF NOT EXISTS public.app_schema_migrations(name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
  const applied=await client.query<{name:string;checksum:string}>('SELECT name,checksum FROM public.app_schema_migrations');
  const known=new Map(applied.rows.map(r=>[r.name,r.checksum]));
  const files=fs.readdirSync('src/db/migrations').filter(f=>/^\d+.*\.sql$/.test(f)).sort();
  if(!known.size&&(await client.query("SELECT to_regclass('public.wedding_settings') AS existing")).rows[0].existing&&!process.argv.includes('--baseline'))throw new Error('Existing schema has no migration ledger. Back up and verify its applied migrations before explicitly using --baseline.');
  for(const file of files){
    const sql=fs.readFileSync(path.join('src/db/migrations',file),'utf8');const checksum=crypto.createHash('sha256').update(sql).digest('hex');
    if(known.has(file)){if(known.get(file)!==checksum)throw new Error(`Previously applied migration changed: ${file}`);continue;}
    await client.query('BEGIN');
    try{
      if(!(process.argv.includes('--baseline')&&file<'0006'))await client.query(sql);
      await client.query('INSERT INTO public.app_schema_migrations(name,checksum) VALUES($1,$2)',[file,checksum]);await client.query('COMMIT');console.log(`Applied ${file}`);
    }catch(error){await client.query('ROLLBACK');throw error;}
  }
  const role=process.env.APP_DB_USER;const password=process.env.APP_DB_PASSWORD;
  if(role||password){
    if(!role||!password||!/^[a-z][a-z0-9_]{1,62}$/.test(role))throw new Error('APP_DB_USER and APP_DB_PASSWORD are both required; use a lowercase database role name.');
    const current=(await client.query('SELECT current_user AS name,current_database() AS database')).rows[0];
    if(current.name===role)throw new Error('Application role must differ from the migration role.');
    const exists=(await client.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount;
    const statement=(await client.query("SELECT format($fmt$"+(exists?'ALTER':'CREATE')+" ROLE %I LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD %L$fmt$, $1::text, $2::text) AS statement",[role,password])).rows[0].statement;
    await client.query(statement);
    for(const template of ["GRANT CONNECT ON DATABASE %I TO %I","GRANT USAGE ON SCHEMA public TO %I","GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO %I","GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO %I","REVOKE ALL ON public.app_schema_migrations FROM %I"]){
      const values=template.includes('DATABASE')?[current.database,role]:[role];const placeholders=values.map((_,i)=>`$${i+2}::text`).join(',');const q=(await client.query(`SELECT format($1::text,${placeholders}) AS statement`,[template,...values])).rows[0].statement;await client.query(q);
    }
    console.log('Application role granted least-privilege table access with RLS enabled.');
  }
}finally{await client.query('SELECT pg_advisory_unlock(772034911)').catch(()=>{});await client.end();}
