// GitHub Tracker Script
const DEFAULT_USER = 'octocat';
const els = {
  profileArea: document.getElementById('profileArea'),
  statFollowers: document.getElementById('statFollowers'),
  statFollowing: document.getElementById('statFollowing'),
  statRepos: document.getElementById('statRepos'),
  statStars: document.getElementById('statStars'),
  reposGrid: document.getElementById('reposGrid'),
  username: document.getElementById('username'),
  repoSearch: document.getElementById('repoSearch'),
  sortBy: document.getElementById('sortBy'),
  onlyForks: document.getElementById('onlyForks'),
  trackBtn: document.getElementById('trackBtn'),
  langChart: document.getElementById('langChart'),
  starsChart: document.getElementById('starsChart'),
};

let state = { user:null, repos:[], charts:{ lang:null, stars:null } };

// Fetch user and repos
async function fetchAll(username){
  if(!username) return;
  try{
    renderLoading();
    const [uRes, rRes] = await Promise.all([
      fetch(`https://api.github.com/users/${username}`),
      fetch(`https://api.github.com/users/${username}/repos?per_page=100&type=owner&sort=updated`)
    ]);
    if(uRes.status === 404) throw new Error('User not found');
    if(!uRes.ok) throw new Error('User fetch failed: ' + uRes.status);
    if(!rRes.ok) throw new Error('Repos fetch failed: ' + rRes.status);
    const [user, repos] = await Promise.all([uRes.json(), rRes.json()]);
    state.user = user;
    state.repos = Array.isArray(repos)? repos: [];
    renderAll();
  }catch(err){
    els.profileArea.innerHTML = `<div class="error"><i class='fa-solid fa-circle-exclamation'></i> ${err.message}</div>`;
    els.reposGrid.innerHTML = '';
    clearCharts();
    updateStats({ followers:'—', following:'—', repos:'—', stars:'—' });
  }
}

function renderLoading(){
  els.profileArea.innerHTML = `<div class='skeleton'></div>`;
  els.reposGrid.innerHTML = '';
}

function renderAll(){
  const u = state.user;
  const repos = state.repos;
  const totalStars = repos.reduce((a,b)=> a + (b.stargazers_count||0),0);

  els.profileArea.innerHTML = `
    <div class='profile'>
      <img class='avatar' src='${u.avatar_url}' alt='${u.login} avatar' />
      <div>
        <div class='name'>${u.name || u.login}</div>
        <div class='muted'>@${u.login}</div>
        ${u.bio? `<div class='muted' style='margin-top:6px'>${escapeHtml(u.bio)}</div>`: ''}
        <div class='chips'>
          ${u.location? `<span class='chip'><i class="fa-solid fa-location-dot"></i> ${escapeHtml(u.location)}</span>`: ''}
          ${u.company? `<span class='chip'><i class="fa-solid fa-building"></i> ${escapeHtml(u.company)}</span>`: ''}
          ${u.blog? `<span class='chip'><i class="fa-solid fa-link"></i> <a href='${formatUrl(u.blog)}' target='_blank'>${escapeHtml(u.blog)}</a></span>`: ''}
          <span class='chip'><i class="fa-solid fa-clock"></i> Joined ${new Date(u.created_at).toDateString()}</span>
        </div>
      </div>
    </div>`;

  updateStats({ followers:u.followers, following:u.following, repos:u.public_repos, stars: totalStars });
  drawLangChart(repos);
  drawStarsChart(repos);
  renderRepos();
}

function updateStats({followers, following, repos, stars}){
  els.statFollowers.textContent = formatNum(followers);
  els.statFollowing.textContent = formatNum(following);
  els.statRepos.textContent = formatNum(repos);
  els.statStars.textContent = formatNum(stars);
}

function renderRepos(){
  const q = (els.repoSearch.value||'').toLowerCase();
  const onlyForks = els.onlyForks.checked;
  const sortBy = els.sortBy.value;

  let list = state.repos.slice();
  if(onlyForks) list = list.filter(r=> r.fork);
  if(q) list = list.filter(r=> (r.name||'').toLowerCase().includes(q) || (r.description||'').toLowerCase().includes(q));

  const sorters = {
    updated: (a,b) => new Date(b.updated_at) - new Date(a.updated_at),
    stars: (a,b) => (b.stargazers_count||0) - (a.stargazers_count||0),
    forks: (a,b) => (b.forks_count||0) - (a.forks_count||0),
    name: (a,b) => a.name.localeCompare(b.name)
  };
  list.sort(sorters[sortBy] || sorters.updated);

  els.reposGrid.innerHTML = list.map(r=> `
    <article class='repo'>
      <div class='title'>
        <a href='${r.html_url}' target='_blank'><i class='fa-brands fa-github'></i> ${escapeHtml(r.name)}</a>
        <span class='muted' style='font-size:12px'>${new Date(r.updated_at).toLocaleDateString()}</span>
      </div>
      ${r.description? `<div class='desc'>${escapeHtml(r.description)}</div>`: ''}
      <div class='badges'>
        ${r.language? `<span class='badge'><i class='fa-solid fa-code'></i> ${escapeHtml(r.language)}</span>`: ''}
        <span class='badge'><i class='fa-solid fa-star'></i> ${r.stargazers_count}</span>
        <span class='badge'><i class='fa-solid fa-code-fork'></i> ${r.forks_count}</span>
        ${(r.topics||[]).slice(0,4).map(t=> `<span class='badge'>#${escapeHtml(t)}</span>`).join('')}
      </div>
    </article>`).join('');

  if(!list.length) els.reposGrid.innerHTML = `<div class='muted'>No repositories match your filters.</div>`;
}

function drawLangChart(repos){
  const counts = {};
  repos.forEach(r=>{ if(r.language) counts[r.language]=(counts[r.language]||0)+1; });
  const labels = Object.keys(counts);
  const data = Object.values(counts);
  const colors = palette(labels.length);
  const cfg = {
    type:'doughnut',
    data:{ labels, datasets:[{ data, backgroundColor: colors, borderColor:'#0b1020' }] },
    options:{ plugins:{ legend:{ labels:{ color:'#cbd5e1' } }, tooltip:{ enabled:true } } }
  };
  state.charts.lang && state.charts.lang.destroy();
  state.charts.lang = new Chart(els.langChart.getContext('2d'), cfg);
}

function drawStarsChart(repos){
  const top = repos.slice().sort((a,b)=> (b.stargazers_count||0)-(a.stargazers_count||0)).slice(0,10);
  const labels = top.map(r=> r.name);
  const data = top.map(r=> r.stargazers_count||0);
  const cfg = {
    type:'bar',
    data:{ labels, datasets:[{ label:'Stars', data, backgroundColor:'#6366f1' }] },
    options:{ scales:{ x:{ ticks:{ color:'#cbd5e1' } }, y:{ ticks:{ color:'#cbd5e1' } } }, plugins:{ legend:{ labels:{ color:'#cbd5e1' } }, tooltip:{ enabled:true } } }
  };
  state.charts.stars && state.charts.stars.destroy();
  state.charts.stars = new Chart(els.starsChart.getContext('2d'), cfg);
}

function clearCharts(){
  if(state.charts.lang){ state.charts.lang.destroy(); state.charts.lang=null; }
  if(state.charts.stars){ state.charts.stars.destroy(); state.charts.stars=null; }
}

function formatUrl(url){ try{ return /^(https?:)?\/\//i.test(url)?url:`https://${url}` }catch{ return url } }
function formatNum(n){ if(n===null||n===undefined||n==='—') return n; const s=Number(n); return s>=1000? (s/1000).toFixed(1).replace(/\.0$/,'')+'k':s }
function escapeHtml(str){ return String(str).replace(/[&<>"']/g, s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[s])) }
function palette(n){ const base=['#60a5fa','#34d399','#f472b6','#f59e0b','#a78bfa','#22d3ee','#fb7185','#84cc16','#e879f9','#38bdf8','#f43f5e','#10b981']; const out=[]; for(let i=0;i<n;i++){ out.push(base[i%base.length]); } return out; }

// Event listeners
els.trackBtn.addEventListener('click', ()=> fetchAll((els.username.value||'').trim() || DEFAULT_USER));
els.username.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); els.trackBtn.click(); }});
els.repoSearch.addEventListener('input', ()=> renderRepos());
els.sortBy.addEventListener('change', ()=> renderRepos());
els.onlyForks.addEventListener('change', ()=> renderRepos());

// Boot
els.username.value = DEFAULT_USER;
fetchAll(DEFAULT_USER);