/* Huschel App Speicher V1.2.0 – ausschließlich die originalen Wildhogs-Checklisten.
   Statische Tages-/Routenseiten bleiben unverändert. */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PROJECT = 'https://qijordwpbwwbizfcslrv.supabase.co';
const APP_ID = 'wildhogs-reiseplaner';
const USER_ID = '9be7d1bc-4d69-4cb8-bb42-cb2d3c705f75';
const PUB_KEY = 'huschel-wildhogs-publishable-v1';
const EMAIL_KEY = 'huschel-wildhogs-email-v1';
const SESSION_KEY = 'huschel-wildhogs-auth-v1';
const SNAP_KEY = 'huschel-wildhogs-local-snapshot-v1';
const $ = id => document.getElementById(id);
const checkboxes = [...document.querySelectorAll('.checkitem input[type="checkbox"][data-key]')];
const known = new Set(checkboxes.map(input => input.dataset.key));
const sortedKeys = [...known].sort();
let client = null, clientKey = null, loggedIn = false, busy = false;
let cloudSha = undefined, cloudRevision = 0, cloudTime = null, cloudData = null, cloudExists = false;
let priorScroll = 0;

function stamp(v) { return v && !Number.isNaN(Date.parse(v)) ? new Date(v).toLocaleString('de-DE',{dateStyle:'medium',timeStyle:'short'}) : '–'; }
function note(v) { $('hsMessage').textContent = String(v); }
function lamp(v, kind='warn') {
  $('hsLamp').className = 'hs-lamp' + (kind==='ok'?' ok':kind==='error'?' error':'');
  $('hsLamp').textContent = (kind==='ok'?'🟢 ':kind==='error'?'🔴 ':'🟡 ') + v;
}
function meta() {
  $('hsMeta').textContent = 'Privater GitHub-Speicher · Revision: ' + (cloudSha===undefined?'nicht geprüft':cloudRevision) + ' · Letzte Speicherung: ' + stamp(cloudTime);
}
function authState(on,email='',error='') {
  loggedIn=on;
  $('hsAuthInputs').hidden=on;
  $('hsSigned').hidden=!on;
  $('hsAuthPanel').classList.toggle('hs-auth-ok',on);
  $('hsAuthStatus').className='hs-auth-status' + (on?' ok':error?' error':'');
  $('hsAuthStatus').textContent=on?'🟢 Angemeldet · Supabase-Zugang aktiv':error||'⚪ Nicht angemeldet';
  $('hsSignedEmail').textContent=on?'Angemeldet als '+email:'';
}
function read() {
  const checks={};
  for (const key of sortedKeys) checks[key]=localStorage.getItem('wildhogs_'+key)==='1';
  return {schemaVersion:1,app:APP_ID,checks};
}
function validate(value) {
  if (!value || typeof value!=='object' || Array.isArray(value) || value.schemaVersion!==1 || value.app!==APP_ID ||
      !value.checks || typeof value.checks!=='object' || Array.isArray(value.checks)) {
    throw Error('Kein gültiges Wildhogs-Checklisten-Backup. Bestehende Daten bleiben erhalten.');
  }
  if (Object.keys(value.checks).length!==sortedKeys.length ||
      Object.keys(value.checks).some(k=>!known.has(k) || typeof value.checks[k]!=='boolean') ||
      sortedKeys.some(k=>!Object.hasOwn(value.checks,k))) {
    throw Error('Die Checklisten stimmen nicht mit dieser Wildhogs-Version überein. Es wurden keine Daten übernommen.');
  }
  return {schemaVersion:1,app:APP_ID,checks:Object.fromEntries(sortedKeys.map(k=>[k,value.checks[k]]))};
}
function same(a,b) {
  try {return JSON.stringify(validate(a).checks)===JSON.stringify(validate(b).checks);}catch{return false;}
}
function restoreChecks(data) {
  const normalized=validate(data);
  const before=read();
  try {
    for(const input of checkboxes) {
      const checked=normalized.checks[input.dataset.key];
      localStorage.setItem('wildhogs_'+input.dataset.key,checked?'1':'0');
      input.checked=checked;
      input.closest('.checkitem')?.classList.toggle('done',checked);
    }
  } catch(err) {
    for(const input of checkboxes) {
      const old=before.checks[input.dataset.key];
      localStorage.setItem('wildhogs_'+input.dataset.key,old?'1':'0');
      input.checked=old;
      input.closest('.checkitem')?.classList.toggle('done',old);
    }
    throw Error('Lokal konnte nicht alles übernommen werden: '+(err?.message||err));
  }
}
function remoteInfo(value, data) {
  cloudSha=value.sha??null;
  cloudRevision=Number(value.revision||0);
  cloudTime=value.savedAt||null;
  cloudExists=Boolean(value.exists);
  cloudData=cloudExists?data:null;
  meta();
}
function updateLamp() {
  if (busy) return;
  if (cloudSha===undefined) lamp('GitHub-Stand noch nicht geprüft · zuerst GitHub Laden');
  else if (!cloudExists) lamp('Noch keine Wildhogs-Sicherung auf GitHub');
  else if (same(read(),cloudData)) lamp('Alle 60 Checklisten sicher auf GitHub gespeichert','ok');
  else lamp('Checklisten geändert · noch nicht auf GitHub gespeichert');
}
function cancelled(action) {
  lamp(action+' von dir abgebrochen – Daten unverändert');
  note('Du hast den Vorgang abgebrochen. Weder deine lokalen Checklisten noch die private GitHub-Datei wurden verändert.');
}
async function task(label,fn) {
  if (busy) return;
  busy=true;
  document.querySelectorAll('#hsView button').forEach(b=>b.disabled=true);
  try {await fn();}
  catch(err) {
    if(label==='Anmeldung') {authState(false,'','🔴 Anmeldung fehlgeschlagen');$('hsPass').value='';}
    const detail=err?.message||String(err);
    lamp(label+' fehlgeschlagen','error');
    note(label+' fehlgeschlagen: '+detail+'\nVorhandene Checklisten wurden nicht absichtlich verändert.');
  } finally {
    busy=false;
    document.querySelectorAll('#hsView button').forEach(b=>b.disabled=false);
  }
}
function getClient(key) {
  if (client && key===clientKey) return client;
  const previous=client;
  const current=createClient(PROJECT,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:SESSION_KEY}});
  client=current;clientKey=key;
  if(previous && previous!==current) void previous.auth.stopAutoRefresh();
  current.auth.onAuthStateChange((event)=>{if(client===current && event==='SIGNED_OUT') authState(false);});
  return current;
}
async function restoreSession() {
  const key=$('hsKey').value.trim();
  if(!key.startsWith('sb_publishable_')) return;
  const current=getClient(key);
  $('hsAuthStatus').textContent='🟡 Gespeicherte Anmeldung wird geprüft …';
  try {
    const {data:session,error:sessionError}=await current.auth.getSession();
    if (current!==client) return;
    if(sessionError) throw sessionError;
    if(!session.session) {authState(false);return;}
    const {data,error}=await current.auth.getUser();
    if (current!==client) return;
    if(error || data.user?.id!==USER_ID) {
      await current.auth.signOut({scope:'local'});
      throw error||Error('Benutzerkonto nicht freigeschaltet.');
    }
    authState(true,data.user.email||$('hsEmail').value.trim());
    note('Anmeldung automatisch wiederhergestellt. Zum Versionsabgleich bitte GitHub Laden wählen.');
  } catch(err) {
    if (current!==client) return;
    authState(false,'','🔴 Automatische Anmeldung nicht möglich');
    note('Bitte erneut anmelden: '+(err?.message||err));
  }
}
async function invoke(payload) {
  if(!client || !loggedIn) throw Error('Bitte zuerst bei Supabase anmelden.');
  const {data,error}=await client.functions.invoke('github-app-storage',{body:payload});
  if(error) {
    let text=error.message||'Supabase nicht erreichbar';
    if(error.context instanceof Response) {
      text+=' (HTTP '+error.context.status+')';
      try {const info=await error.context.json();text+=': '+(info.error||info.message||JSON.stringify(info));} catch {}
    }
    throw Error(text);
  }
  if(!data?.ok) throw Error(data?.error||'Ungültige Antwort der GitHub-Funktion.');
  return data;
}
function backupFile(data) {
  const filename='Wildhogs_Checklisten_'+new Date().toISOString().slice(0,16).replace('T','_').replace(':','')+'.json';
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2500);
  note(filename+' heruntergeladen. GitHub wurde nicht verändert.');
}

$('hsLogin').addEventListener('click',()=>task('Anmeldung',async()=>{
  const key=$('hsKey').value.trim();
  if(!key.startsWith('sb_publishable_')) throw Error('Bitte Supabase Publishable Key (sb_publishable_…) eingeben.');
  const current=getClient(key),email=$('hsEmail').value.trim();
  try {
    const {data,error}=await current.auth.signInWithPassword({email,password:$('hsPass').value});
    if(error) throw error;
    if(data.user?.id!==USER_ID) {await current.auth.signOut();throw Error('Dieses Benutzerkonto ist nicht freigeschaltet.');}
    localStorage.setItem(PUB_KEY,key);
    localStorage.setItem(EMAIL_KEY,email);
    authState(true,data.user.email||email);
    note('Supabase-Anmeldung erfolgreich. Bitte GitHub Laden wählen, damit die GitHub-Revision geprüft wird.');
  } finally {$('hsPass').value='';}
}));
$('hsLogout').addEventListener('click',()=>task('Abmeldung',async()=>{
  if(client) await client.auth.signOut();
  cloudSha=undefined;cloudRevision=0;cloudTime=null;cloudData=null;cloudExists=false;
  authState(false);meta();lamp('Abgemeldet · GitHub-Stand nicht geprüft');
  note('Abgemeldet. Die 60 Checklisten und die private GitHub-Datei bleiben unverändert.');
}));
$('hsGithubLoad').addEventListener('click',()=>task('GitHub Laden',async()=>{
  const result=await invoke({action:'load',app:APP_ID});
  const cloud=result.exists?validate(result.data):null;
  remoteInfo(result,cloud);
  if(!result.exists) {lamp('Noch keine Wildhogs-Checklisten auf GitHub');note('Für '+APP_ID+'/data.json ist noch keine Sicherung vorhanden. Du kannst die ersten Daten mit GitHub Speichern anlegen.');return;}
  if(same(read(),cloud)) {lamp('Lokale Checklisten entsprechen GitHub','ok');note('Revision '+cloudRevision+' geprüft: keine Unterschiede, nichts überschrieben.');return;}
  if(!confirm('GitHub Laden ersetzt alle 60 lokal gesetzten Checklisten-Häkchen durch den gespeicherten GitHub-Stand.\n\nDie Tagesseiten, Routen und Bilder bleiben unverändert. Vorher ggf. JSON-Backup erstellen.\n\nJetzt übernehmen?')) {cancelled('GitHub Laden');return;}
  restoreChecks(cloud);
  lamp('GitHub-Checklisten erfolgreich übernommen','ok');
  note('Revision '+cloudRevision+' geladen und lokal gesichert. Die bestehenden Reiseplan-Seiten bleiben unverändert.');
}));
$('hsGithubSave').addEventListener('click',()=>task('GitHub Speichern',async()=>{
  if(cloudSha===undefined) throw Error('Bitte zuerst GitHub Laden wählen, damit kein neuerer Speicherstand überschrieben wird.');
  const current=read();
  if(cloudExists && same(current,cloudData)) {lamp('Keine Änderungen · GitHub schon aktuell','ok');note('Aktuelle Checklisten entsprechen der GitHub-Revision '+cloudRevision+'. Keine neue Revision erstellt.');return;}
  if(cloudExists && !confirm('Lokale Checklisten als neue GitHub-Revision speichern?\n\nBei zwischenzeitlicher Änderung auf GitHub wird der Server die Speicherung blockieren.')) {cancelled('GitHub Speichern');return;}
  const response=await invoke({action:'save',app:APP_ID,sha:cloudSha,revision:cloudRevision,data:current});
  remoteInfo({...response,exists:true},current);
  lamp('Wildhogs-Checklisten sicher auf GitHub gespeichert','ok');
  note('60 Checklisten unter '+APP_ID+'/data.json gespeichert – Revision '+cloudRevision+'. Die öffentliche Reiseführer-App wurde nicht verändert.');
}));
$('hsLocalSave').addEventListener('click',()=>task('Lokal Speichern',async()=>{
  const data=read();localStorage.setItem(SNAP_KEY,JSON.stringify(data));
  note('Zusätzlicher lokaler Checklisten-Schnappschuss gespeichert. GitHub wurde nicht verändert.');updateLamp();
}));
$('hsLocalLoad').addEventListener('click',()=>task('Lokal Laden',async()=>{
  const raw=localStorage.getItem(SNAP_KEY);
  if(!raw) throw Error('Noch kein manueller lokaler Schnappschuss vorhanden.');
  const data=validate(JSON.parse(raw));
  if(same(read(),data)) {note('Lokaler Schnappschuss ist identisch. Nichts geändert.');return;}
  if(!confirm('Den älteren lokalen Checklisten-Schnappschuss übernehmen?\nAlle 60 Häkchen werden entsprechend ersetzt, GitHub bleibt unverändert.')) {cancelled('Lokal Laden');return;}
  restoreChecks(data);note('Lokaler Checklisten-Schnappschuss wiederhergestellt. GitHub wurde nicht verändert.');updateLamp();
}));
$('hsExport').addEventListener('click',()=>task('JSON-Backup',async()=>{backupFile(read());}));
$('hsImport').addEventListener('click',()=>$('hsFile').click());
$('hsFile').addEventListener('change',async e=>{
  const file=e.target.files?.[0];if(!file) return;
  await task('JSON Laden',async()=>{
    if(file.size>1_000_000) throw Error('Datei zu groß für das Checklisten-Backup (max. 1 MB).');
    const data=validate(JSON.parse(await file.text()));
    if(same(read(),data)) {note('Backup und lokale Checklisten sind identisch. Keine Änderung erforderlich.');return;}
    if(!confirm('JSON-Backup „'+file.name+'“ laden?\nAlle 60 Häkchen werden ersetzt. GitHub bleibt unverändert.')) {cancelled('JSON Laden');return;}
    restoreChecks(data);note('JSON-Backup geladen; die Checklisten sind jetzt lokal aktualisiert. GitHub wurde nicht verändert.');updateLamp();
  });e.target.value='';
});
$('hsOpen').addEventListener('click',()=>{
  priorScroll=window.scrollY;
  $('hsView').hidden=false;document.body.classList.add('hs-page-open');
  meta();updateLamp();window.scrollTo(0,0);
});
function closeView(){document.body.classList.remove('hs-page-open');$('hsView').hidden=true;window.scrollTo(0,priorScroll);}
$('hsBack').addEventListener('click',closeView);
document.addEventListener('keydown',e=>{if(e.key==='Escape' && !$('hsView').hidden) closeView();});
checkboxes.forEach(input=>input.addEventListener('change',()=>{if(!$('hsView').hidden) updateLamp();}));
try {
  $('hsKey').value=localStorage.getItem(PUB_KEY)||
    localStorage.getItem('huschel-skipper-publishable-v1')||
    localStorage.getItem('huschel-amflow-publishable-v1')||
    localStorage.getItem('huschel-routen-navigator-publishable-v1')||
    localStorage.getItem('huschel-supabase-publishable-key-v1')||'';
  $('hsEmail').value=localStorage.getItem(EMAIL_KEY)||$('hsEmail').value;
} catch {}
meta();
if(sortedKeys.length!==60 || checkboxes.length!==60) {
  lamp('Checklisten-Datenmodell unvollständig','error');
  note('Es wurden nicht genau 60 Wildhogs-Checklisten erkannt. Bitte ausschließlich die vollständige Wildhogs-V1.2.0-App verwenden.');
  ['hsGithubLoad','hsGithubSave','hsLocalLoad','hsLocalSave','hsExport','hsImport'].forEach(id=>$(id).disabled=true);
} else {void restoreSession();}
