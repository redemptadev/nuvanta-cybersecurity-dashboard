const API_BASE = 'http://localhost:3000/api';
let authToken = null;
let threats = [];
let alerts = [];
let activityChart = null;
let pieChart = null;

// --- AUTH ---
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const errorEl = document.getElementById('loginError');
  errorEl.textContent = '';

  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (!res.ok) throw new Error('Invalid credentials');
    
    const { token, user } = await res.json();
    authToken = token;
    localStorage.setItem('auth_token', token);
    
    document.getElementById('loginScreen').style.display = 'none';
    document.querySelector('.app').classList.remove('hidden');
    
    initDashboard();
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  authToken = null;
  localStorage.removeItem('auth_token');
  document.getElementById('loginScreen').style.display = 'flex';
  document.querySelector('.app').classList.add('hidden');
  document.getElementById('loginForm').reset();
});

// --- ADD USER FUNCTIONALITY ---
document.getElementById('addUserBtn').addEventListener('click', () => {
  document.getElementById('addUserModal').style.display = 'flex';
});

function closeAddUserModal() {
  document.getElementById('addUserModal').style.display = 'none';
  document.getElementById('addUserForm').reset();
}

document.getElementById('addUserForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('newUsername').value;
  const password = document.getElementById('newPassword').value;
  const role = document.getElementById('newRole').value;

  try {
    const res = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ username, password, role })
    });

    if (!res.ok) {
      const error = await res.json();
      alert('Error: ' + (error.error || 'Failed to create user'));
      return;
    }

    alert('User created successfully!');
    closeAddUserModal();
    // Refresh the page to show new user
    location.reload();
  } catch (err) {
    alert('Error creating user: ' + err.message);
  }
});

// --- DARK MODE & SETTINGS ---
document.getElementById('darkModeToggle').addEventListener('change', (e) => {
  if (e.target.checked) {
    document.body.classList.remove('light-mode');
    localStorage.setItem('darkMode', 'true');
  } else {
    document.body.classList.add('light-mode');
    localStorage.setItem('darkMode', 'false');
  }
});

// Load dark mode preference on page load
window.addEventListener('load', () => {
  const darkModeSetting = localStorage.getItem('darkMode');
  if (darkModeSetting === 'false') {
    document.getElementById('darkModeToggle').checked = false;
    document.body.classList.add('light-mode');
  }
});

document.getElementById('saveSettingsBtn').addEventListener('click', () => {
  const emailNotif = document.querySelector('input[type="checkbox"]:nth-of-type(1)').checked;
  const highSevAlerts = document.querySelector('input[type="checkbox"]:nth-of-type(2)').checked;
  const darkMode = document.getElementById('darkModeToggle').checked;

  localStorage.setItem('emailNotifications', emailNotif);
  localStorage.setItem('highSeverityAlerts', highSevAlerts);
  localStorage.setItem('darkMode', darkMode);

  alert('Settings saved successfully!');
});

document.getElementById('resetSettingsBtn').addEventListener('click', () => {
  if (confirm('Reset all settings to default?')) {
    localStorage.removeItem('emailNotifications');
    localStorage.removeItem('highSeverityAlerts');
    localStorage.setItem('darkMode', 'true');
    
    document.querySelector('input[type="checkbox"]:nth-of-type(1)').checked = true;
    document.querySelector('input[type="checkbox"]:nth-of-type(2)').checked = true;
    document.getElementById('darkModeToggle').checked = true;
    document.body.classList.remove('light-mode');
    
    alert('Settings reset to default!');
  }
});

// --- DASHBOARD INIT ---
function initDashboard() {
  // Load saved settings
  const savedDarkMode = localStorage.getItem('darkMode');
  const savedEmailNotif = localStorage.getItem('emailNotifications');
  const savedHighSev = localStorage.getItem('highSeverityAlerts');
  
  if (savedDarkMode === 'false') {
    document.body.classList.add('light-mode');
    document.getElementById('darkModeToggle').checked = false;
  } else {
    document.body.classList.remove('light-mode');
    document.getElementById('darkModeToggle').checked = true;
  }
  
  if (savedEmailNotif !== null) {
    document.querySelector('input[type="checkbox"]:nth-of-type(1)').checked = savedEmailNotif === 'true';
  }
  if (savedHighSev !== null) {
    document.querySelector('input[type="checkbox"]:nth-of-type(2)').checked = savedHighSev === 'true';
  }
  
  setupTabSwitching();
  loadStats();
  loadThreats();
  loadAlerts();
  makeCharts();
  initMap();
  generateSampleThreats();
  setInterval(loadStats, 10000);
  setInterval(loadAlerts, 8000);
}

// --- API CALLS ---
async function apiCall(endpoint, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'Authorization': `Bearer ${authToken}` }
  };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${API_BASE}${endpoint}`, opts);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function loadStats() {
  try {
    const stats = await apiCall('/stats');
    document.getElementById('totalThreats').textContent = stats.total;
    document.getElementById('activeThreats').textContent = stats.active;
    document.getElementById('criticalThreats').textContent = stats.critical;
    document.getElementById('resolvedThreats').textContent = stats.resolved;
  } catch (err) {
    console.error('Stats load error:', err);
  }
}

async function loadThreats() {
  try {
    threats = await apiCall('/threats');
    renderThreats();
  } catch (err) {
    console.error('Threats load error:', err);
  }
}

async function loadAlerts() {
  try {
    alerts = await apiCall('/alerts');
    renderAlerts();
  } catch (err) {
    console.error('Alerts load error:', err);
  }
}

// --- RENDER ---
function renderThreats() {
  const list = document.getElementById('threatsList');
  list.innerHTML = '';
  threats.forEach(t => {
    const div = document.createElement('div');
    div.className = `threat-item ${t.severity.toLowerCase()}`;
    div.innerHTML = `
      <div class="threat-header">
        <div class="threat-type">${t.type}</div>
        <div class="threat-status">${t.status.toUpperCase()}</div>
      </div>
      <div class="threat-desc">${t.description}</div>
      <div style="display: flex; gap: 8px;">
        <button class="analyze-btn" onclick="analyzeThreat(${t.id}, '${t.type}', '${t.severity}', '${t.description.replace(/'/g, "\\'")}')">
          🤖 Get AI Fix
        </button>
        <button class="analyze-btn" style="background: rgba(52,211,153,0.2); color: #34d399;" onclick="resolveThreat(${t.id})">
          ✓ Mark Resolved
        </button>
      </div>
    `;
    list.appendChild(div);
  });
}

function renderAlerts() {
  const list = document.getElementById('alertsList');
  list.innerHTML = '';
  const recent = alerts.slice(0, 5);
  recent.forEach(a => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div>
        <div style="font-weight:600">${a.type || 'Alert'}: ${a.message}</div>
        <div class="meta">${new Date(a.timestamp).toLocaleTimeString()}</div>
      </div>
      <div class="badge ${(a.severity || 'low').toLowerCase()}">${a.severity || 'Info'}</div>
    `;
    list.appendChild(li);
  });
}

// --- CHARTS ---
function makeCharts() {
  const ctx = document.getElementById('activityChart').getContext('2d');
  activityChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['00:00','03:00','06:00','09:00','12:00','15:00','18:00','21:00','24:00'],
      datasets: [
        {label:'High',data:[3,5,4,6,8,7,9,7,6],borderColor:'#ff6b6b',backgroundColor:'rgba(255,107,107,0.08)',tension:0.3},
        {label:'Medium',data:[2,3,2,4,4,5,3,4,3],borderColor:'#f59e0b',backgroundColor:'rgba(245,158,11,0.06)',tension:0.3},
        {label:'Low',data:[1,1,0,1,1,2,1,1,0],borderColor:'#60a5fa',backgroundColor:'rgba(96,165,250,0.04)',tension:0.3}
      ]
    },
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top'}}}
  });

  const pctx = document.getElementById('pieChart').getContext('2d');
  pieChart = new Chart(pctx, {
    type: 'doughnut',
    data:{labels:['Malware','Phishing','DDoS','Brute Force'],datasets:[{data:[40,30,20,10],backgroundColor:['#ef4444','#f97316','#6366f1','#22c55e']}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}}}
  });
}

function initMap() {
  const map = L.map('map', {attributionControl:false,zoomControl:false}).setView([20,0], 2);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',{maxZoom:6,subdomains:'abcd'}).addTo(map);
  const hotspots = [[37.77,-122.41],[51.51,-0.12],[28.61,77.20],[-33.86,151.20]];
  hotspots.forEach(h=>{
    L.circleMarker(h,{radius:9,fillColor:'#ff6b6b',color:'#ff6b6b',fillOpacity:0.9,weight:1}).addTo(map);
  });
}

// --- TAB SWITCHING ---
function setupTabSwitching(){
  const navLinks = document.querySelectorAll('.nav-link');
  const pageTitle = document.getElementById('pageTitle');
  const tabNames = {
    overview:'CYBERSECURITY<br> DASHBOARD',
    threats:'THREAT<br> INTELLIGENCE',
    alerts:'ALERT<br> CENTER',
    analytics:'ADVANCED<br> ANALYTICS',
    users:'USER<br> MANAGEMENT',
    settings:'SETTINGS &<br> CONFIG',
    logs:'SYSTEM<br> LOGS'
  };

  navLinks.forEach(link=>{
    link.addEventListener('click',(e)=>{
      e.preventDefault();
      const tabName = link.dataset.tab;
      
      document.querySelectorAll('.tab-content').forEach(tab=>tab.classList.remove('active'));
      navLinks.forEach(l=>l.classList.remove('active'));
      
      const tab = document.getElementById(tabName+'-tab');
      if(tab) tab.classList.add('active');
      link.classList.add('active');
      
      if(tabNames[tabName]) pageTitle.innerHTML = tabNames[tabName];
      
      if(tabName === 'threats') renderThreats();
      if(tabName === 'alerts') {
        const allAlerts = document.getElementById('allAlertsList');
        allAlerts.innerHTML = '';
        alerts.forEach(a=>{
          const li = document.createElement('li');
          li.innerHTML = `<div><div style="font-weight:600">${a.type || 'Alert'}: ${a.message}</div><div class="meta">${new Date(a.timestamp).toLocaleTimeString()}</div></div><div class="badge ${(a.severity || 'low').toLowerCase()}">${a.severity || 'Info'}</div>`;
          allAlerts.appendChild(li);
        });
      }
      if(tabName === 'analytics'){
        if(!window.trendsChartInstance){
          setTimeout(() => {
            const chartEl = document.getElementById('trendsChart');
            if(chartEl){
              const ctx = chartEl.getContext('2d');
              window.trendsChartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                  labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6', 'Week 7', 'Week 8'],
                  datasets: [
                    {label:'Threats Detected',data:[45,52,48,61,58,72,65,71],backgroundColor:'#ff6b6b'},
                    {label:'Threats Resolved',data:[40,48,45,55,56,68,62,69],backgroundColor:'#34d399'}
                  ]
                },
                options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top'}}}
              });
            }
          }, 50);
        }
      }
    });
  });
}

// --- AI THREAT ANALYSIS ---
async function analyzeThreat(id, type, severity, description) {
  const modal = document.getElementById('analysisModal');
  const content = document.getElementById('analysisContent');
  modal.style.display = 'flex';
  content.textContent = '🔄 Analyzing threat with AI...';

  try {
    const res = await apiCall('/analyze-threat', 'POST', { threatDescription: description, type, severity });
    content.textContent = res.analysis;
  } catch (err) {
    content.textContent = `Error: ${err.message}`;
  }
}

function closeAnalysis() {
  document.getElementById('analysisModal').style.display = 'none';
}

async function resolveThreat(id) {
  try {
    await apiCall(`/threats/${id}`, 'PATCH', { status: 'resolved', remediation: 'Addressed' });
    loadStats();
    loadThreats();
  } catch (err) {
    alert('Error resolving threat: ' + err.message);
  }
}

// --- SAMPLE DATA ---
async function generateSampleThreats() {
  const sampleThreats = [
    { type: 'Malware', severity: 'High', description: 'Suspicious executable detected in C:\\Users\\Downloads', source: '192.168.1.100' },
    { type: 'Phishing', severity: 'Medium', description: 'Phishing email detected from spoofed domain', source: 'mail.example.com' },
    { type: 'DDoS', severity: 'High', description: 'Volumetric DDoS attack targeting main server', source: '203.0.113.45' },
    { type: 'Brute Force', severity: 'Medium', description: 'Multiple failed SSH login attempts detected', source: '198.51.100.0/24' }
  ];

  for (const threat of sampleThreats) {
    try {
      await apiCall('/threats', 'POST', threat);
    } catch (err) {
      console.log('Threat may already exist');
    }
  }

  loadThreats();
}

// --- INIT ---
if (localStorage.getItem('auth_token')) {
  authToken = localStorage.getItem('auth_token');
  document.getElementById('loginScreen').style.display = 'none';
  document.querySelector('.app').classList.remove('hidden');
  initDashboard();
}
