<!-- ===== app.js ===== -->
// 1) PASTE YOUR GAS WEB APP URL BELOW after you deploy GAS.
//    Example: const GAS_URL = 'https://script.google.com/macros/s/AKfycb.../exec';
const GAS_URL = 'https://script.googleusercontent.com/macros/echo?user_content_key=AehSKLjmomFyve1WXs018gqnvN-BNEdogr4Dq077C93Mq7Z7c7LR6bd9TH3p-pWSf2lphrYjbGczMbDJKpok7d7URZ6VpMTn0jJ-cp0pjDBaXu9COwaPYnIoagWOhXRhLKCEmqj64CVLE96M8U0pp9dfYrul2R3pdR9Ebun6Df8hNAHNQ8M62eiWRxNxmm91FfaL4bZwQhcqdxL3xPSbS5E0pGNA-lne-k887NthIAHggmYV1f3iDHJjFSbcQTDqPFnuBUy9qN-r-kU1msCrDkYv84ZgJGdnww&lib=MGCBecPUqvyFFM19T9bHHTjI3yRUM8Pyy';

// ---------- state ----------
const state = {
  token: localStorage.getItem('bes_token') || '',
  user: null,
  dropdowns: {},
  rows: [],
  sortKey: 'Unique ID',
  sortDir: 'asc',
  files: { kml: null, picture: null },
};

// ---------- boot ----------
document.addEventListener('DOMContentLoaded', init);
function $(s){ return document.querySelector(s); }
function show(id){
  const protectedViews = ['#view-form','#view-list','#view-changePw'];
  if (protectedViews.includes(id) && !state.user) id = '#view-login';
  ['#view-login','#view-form','#view-list','#view-changePw'].forEach(sel => $(sel).classList.add('hidden'));
  $(id).classList.remove('hidden');
}
function renderMenu(){
  const nav = $('#dropdown'); nav.innerHTML='';
  const add = (text,fn)=>{ const b=document.createElement('button'); b.textContent=text; b.onclick=()=>{ fn(); nav.classList.add('hidden'); }; nav.appendChild(b); };
  if (!state.user) {
    add('Login', ()=> show('#view-login'));
  } else {
    add('Engineer Survey Form', ()=> show('#view-form'));
    add('Entered Data', ()=> { show('#view-list'); refreshTable(); });
    nav.appendChild(document.createElement('hr'));
    add('Change Password', ()=> show('#view-changePw'));
    add('Logout', ()=> doLogout());
  }
}
function init(){
  $('#hamburger').onclick = () => $('#dropdown').classList.toggle('hidden');
  document.addEventListener('click', (e)=>{ if (!$('#dropdown').contains(e.target) && e.target !== $('#hamburger')) $('#dropdown').classList.add('hidden'); });

  $('#loginForm').addEventListener('submit', onLogin);
  $('#pwForm').addEventListener('submit', onChangePw);
  $('#surveyForm').addEventListener('submit', onSave);
  $('#resetBtn').addEventListener('click', ()=> resetForm());
  $('#kml').addEventListener('change', e=> readAsBase64(e.target.files[0],'kml'));
  $('#picture').addEventListener('change', e=> readAsBase64(e.target.files[0],'picture'));
  $('#search').addEventListener('input', renderTable);
  $('#dataTable thead').addEventListener('click', onSortClick);

  api('bootstrap',{}).then(({dropdowns})=>{
    state.dropdowns = dropdowns || {};
    fillOptions('#assistance', state.dropdowns.assistance);
    fillOptions('#sub_district', state.dropdowns.subDistricts);
    fillOptions('#section', state.dropdowns.sections);

    if (state.token) {
      api('who',{ token: state.token })
        .then(me => { state.user = me; $('#who').textContent = `Signed in: ${me.username} (${me.role})`; renderMenu(); show('#view-form'); })
        .catch(()=>{ doLogout(true); renderMenu(); show('#view-login'); });
    } else {
      renderMenu(); show('#view-login');
    }
  }).catch(err => alert(err.message||err));
}

// ---------- API helper ----------
async function api(action, payload){
  if (!GAS_URL || GAS_URL.startsWith('PASTE_')) throw new Error('Set GAS_URL in app.js');
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ action, payload })
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'API error');
  return json.data;
}

// ---------- UI helpers ----------
function fillOptions(sel, arr){ const el=$(sel); el.innerHTML=''; (arr||[]).forEach(v=>{ const o=document.createElement('option'); o.value=v; o.textContent=v; el.appendChild(o); }); }
function readAsBase64(file,key){ if(!file){ state.files[key]=null; return; } const r=new FileReader(); r.onload=()=>{ state.files[key]={ name:file.name, mimeType:file.type||'', dataUrlBase64:r.result }; }; r.readAsDataURL(file); }
function collectForm(){ return {
  id: $('#currentId').value.trim(),
  owner_name: $('#owner_name').value.trim(),
  assistance: $('#assistance').value,
  width: $('#width').value.trim(),
  length: $('#length').value.trim(),
  sub_district: $('#sub_district').value,
  section: $('#section').value,
  nearby: $('#nearby').value.trim(),
  gps_link: $('#gps_link').value.trim(),
}; }
function resetForm(preserveId=false){ const keepId = preserveId ? $('#currentId').value : ''; $('#surveyForm').reset(); $('#currentId').value = keepId; state.files={kml:null, picture:null}; $('#saveBtn').textContent = keepId ? 'Update Entry' : 'Save Entry'; }

// ---------- Auth ----------
async function onLogin(e){
  e.preventDefault();
  const u=$('#loginUser').value.trim(), p=$('#loginPass').value;
  $('#loginMsg').classList.add('hidden');
  try {
    const res = await api('login', { username:u, password:p });
    state.token = res.token; state.user = { username: res.username, role: res.role };
    localStorage.setItem('bes_token', state.token);
    $('#who').textContent = `Signed in: ${state.user.username} (${state.user.role})`;
    $('#loginForm').reset(); renderMenu(); show('#view-form');
  } catch (err) {
    $('#loginMsg').textContent = err.message || 'Login failed';
    $('#loginMsg').classList.remove('hidden');
  }
}
function doLogout(silent){
  const tok = state.token; state.token=''; state.user=null; localStorage.removeItem('bes_token');
  $('#who').textContent=''; renderMenu(); if (tok) api('logout',{ token: tok });
  if (!silent) show('#view-login');
}
async function onChangePw(e){
  e.preventDefault();
  if (!state.user) return show('#view-login');
  const oldPw=$('#oldPw').value, newPw=$('#newPw').value;
  $('#pwMsg').classList.add('hidden');
  try { await api('changePassword',{ token: state.token, oldPw, newPw }); alert('Password updated.'); $('#pwForm').reset(); show('#view-form'); }
  catch(err){ $('#pwMsg').textContent = err.message || 'Failed to update password'; $('#pwMsg').classList.remove('hidden'); }
}

// ---------- Save / Update ----------
async function onSave(e){
  e.preventDefault();
  if (!state.user) return show('#view-login');
  const data = collectForm();
  if (!data.owner_name) return alert('Owner Name is required.');
  const files = { kml: state.files.kml, picture: state.files.picture };
  const isUpdate = Boolean(data.id);
  if (!confirm(isUpdate ? 'Update this entry?' : 'Save new entry?')) return;

  try {
    const rec = isUpdate
      ? await api('update', { token: state.token, id: data.id, record: data, files })
      : await api('create', { token: state.token, record: data, files });
    alert((isUpdate?'Updated: ':'Saved. ID: ') + rec['Unique ID']);
    resetForm(false); show('#view-list'); refreshTable();
  } catch (err) { alert(err.message || 'Operation failed'); }
}

// ---------- Table ----------
async function refreshTable(){
  if (!state.user) return show('#view-login');
  try { state.rows = await api('list',{ token: state.token }); renderTable(); }
  catch(err){ alert(err.message||err); }
}
function onSortClick(e){
  const th=e.target.closest('th'); if(!th||!th.dataset.k) return;
  const key=th.dataset.k;
  state.sortDir = (state.sortKey===key && state.sortDir==='asc') ? 'desc' : 'asc';
  state.sortKey = key; renderTable();
}
function renderTable(){
  const q=$('#search').value.trim().toLowerCase();
  let rows=state.rows.slice();
  if(q){ rows=rows.filter(r => ['Unique ID','Owner Name','Section','Sub-District'].some(k => String(r[k]||'').toLowerCase().includes(q))); }
  const k=state.sortKey, dir=state.sortDir;
  rows.sort((a,b)=>{ const A=String(a[k]??'').toLowerCase(), B=String(b[k]??'').toLowerCase(); return A<B ? (dir==='asc'?-1:1) : A>B ? (dir==='asc'?1:-1) : 0; });
  const tb=$('#dataTable tbody'); tb.innerHTML='';
  rows.forEach(r=>{
    const tr=document.createElement('tr');
    tr.appendChild(td(r['Unique ID'])); tr.appendChild(td(r['Owner Name'])); tr.appendChild(td(r['Assistance']));
    tr.appendChild(td(r['Width'])); tr.appendChild(td(r['Length'])); tr.appendChild(td(r['Sub-District'])); tr.appendChild(td(r['Section']));
    tr.appendChild(tdLink(r['GPS Link'],'Map')); tr.appendChild(tdLink(r['KML File Link'],'KML')); tr.appendChild(tdLink(r['Picture File Link'],'Photo'));
    const act=document.createElement('td'); act.className='nowrap';
    act.appendChild(btn('Edit', ()=> onEdit(r['Unique ID']))); act.appendChild(document.createTextNode(' '));
    act.appendChild(btn('Delete', ()=> onDelete(r['Unique ID']), 'danger'));
    tr.appendChild(act); tb.appendChild(tr);
  });
}
async function onEdit(id){
  if (!state.user) return show('#view-login');
  try {
    const rec = await api('get',{ token: state.token, id });
    $('#currentId').value = rec['Unique ID'];
    $('#owner_name').value = rec['Owner Name'] || '';
    $('#assistance').value = rec['Assistance'] || '';
    $('#width').value = rec['Width'] || '';
    $('#length').value = rec['Length'] || '';
    $('#sub_district').value = rec['Sub-District'] || '';
    $('#section').value = rec['Section'] || '';
    $('#nearby').value = rec['Nearby'] || '';
    $('#gps_link').value = rec['GPS Link'] || '';
    state.files = { kml:null, picture:null };
    $('#saveBtn').textContent='Update Entry';
    show('#view-form');
  } catch(err){ alert(err.message||err); }
}
async function onDelete(id){
  if (!state.user) return show('#view-login');
  if (!confirm('Delete '+id+'? This cannot be undone. Files will be kept.')) return;
  try { await api('delete',{ token: state.token, id }); refreshTable(); }
  catch(err){ alert(err.message||err); }
}

// helpers
function td(t){ const d=document.createElement('td'); d.textContent=t||''; return d; }
function tdLink(u,l){ const d=document.createElement('td'); if(u){ const a=document.createElement('a'); a.href=u; a.target='_blank'; a.textContent=l; d.appendChild(a);} return d; }
function btn(t,fn,variant){ const b=document.createElement('button'); b.textContent=t; b.className='btn'+(variant==='danger'?' danger':''); b.onclick=fn; return b; }
