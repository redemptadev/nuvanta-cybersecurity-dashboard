const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

const db = new sqlite3.Database('./dashboard.db');
const SECRET_KEY = process.env.SECRET_KEY || 'your-secret-key-change-me';
const AI_API_KEY = process.env.ANTHROPIC_API_KEY || '';

// Initialize database
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'admin'
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS threats (
    id INTEGER PRIMARY KEY,
    type TEXT,
    severity TEXT,
    description TEXT,
    source TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'active',
    remediation TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY,
    threat_id INTEGER,
    message TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved BOOLEAN DEFAULT 0,
    FOREIGN KEY(threat_id) REFERENCES threats(id)
  )`);

  // Create default admin user
  const defaultAdmin = { username: 'admin', password: 'Admin@123' };
  const hashedPassword = bcrypt.hashSync(defaultAdmin.password, 10);
  db.run(
    `INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, 'admin')`,
    [defaultAdmin.username, hashedPassword]
  );
});

// Middleware: Verify JWT
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, SECRET_KEY);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Auth endpoints
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err || !user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  });
});

// Create new user
app.post('/api/users', verifyToken, (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  const hashedPassword = bcrypt.hashSync(password, 10);
  db.run(
    `INSERT INTO users (username, password, role) VALUES (?, ?, ?)`,
    [username, hashedPassword, role || 'Analyst'],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message.includes('UNIQUE') ? 'Username already exists' : err.message });
      }
      res.json({ id: this.lastID, username, role: role || 'Analyst' });
    }
  );
});

// Threats endpoints
app.get('/api/threats', verifyToken, (req, res) => {
  db.all('SELECT * FROM threats ORDER BY timestamp DESC', (err, rows) => {
    res.json(rows || []);
  });
});

app.post('/api/threats', verifyToken, (req, res) => {
  const { type, severity, description, source } = req.body;
  db.run(
    `INSERT INTO threats (type, severity, description, source) VALUES (?, ?, ?, ?)`,
    [type, severity, description, source],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, type, severity, description, source, status: 'active' });
    }
  );
});

// AI Threat Analysis endpoint
app.post('/api/analyze-threat', verifyToken, async (req, res) => {
  const { threatDescription, type, severity } = req.body;
  
  try {
    if (!AI_API_KEY) throw new Error('API key not configured');
    
    // Call Claude API directly via fetch
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': AI_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `You are a cybersecurity expert. Analyze this security threat and provide remediation steps.
          
Threat Type: ${type}
Severity Level: ${severity}
Description: ${threatDescription}

Provide:
1. Root cause analysis (2-3 sentences)
2. Immediate action steps (numbered list, 3-5 items)
3. Long-term prevention strategies (2-3 items)
4. Tools/Services recommended for remediation

Keep response concise and actionable.`
        }]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'API call failed');
    }

    const data = await response.json();
    const analysis = data.content[0]?.text || '';
    res.json({ analysis, threat: { type, severity, description: threatDescription } });
  } catch (err) {
    // Fallback if API not available
    const fallbackAnalysis = `Root Cause: ${type} detected in your network infrastructure requiring immediate attention.

Immediate Actions:
1. Isolate affected systems from network to prevent spread
2. Enable enhanced logging and monitoring on all systems
3. Review access logs for suspicious activity and lateral movement
4. Alert security team and incident response for investigation
5. Backup critical data to secure offline storage

Long-term Prevention:
- Implement zero-trust security architecture
- Deploy advanced threat detection with EDR/XDR solutions
- Schedule regular security audits and penetration tests

Recommended Tools: ${getRecommendedTools(type)}

Note: Connect an API key for AI-powered analysis. Get one at https://console.anthropic.com/`;
    res.json({ analysis: fallbackAnalysis, threat: { type, severity, description: threatDescription } });
  }
});

function getRecommendedTools(threatType) {
  const tools = {
    'Malware': 'ClamAV, Windows Defender, Kaspersky',
    'DDoS': 'Cloudflare, AWS Shield, Akamai',
    'Phishing': 'Proofpoint, Mimecast, KnowBe4',
    'Brute Force': 'Fail2Ban, Crowdsec, Wazuh',
    'Data Exfiltration': 'Splunk, Suricata, Zeek',
    'SQL Injection': 'ModSecurity, OWASP ZAP, Burp Suite'
  };
  return tools[threatType] || 'SIEM Solution, IDS/IPS, EDR Platform';
}

// Update threat status and remediation
app.patch('/api/threats/:id', verifyToken, (req, res) => {
  const { status, remediation } = req.body;
  const { id } = req.params;
  db.run(
    `UPDATE threats SET status = ?, remediation = ? WHERE id = ?`,
    [status, remediation, id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id, status, remediation });
    }
  );
});

// Get alerts
app.get('/api/alerts', verifyToken, (req, res) => {
  db.all(
    `SELECT a.*, t.type, t.severity FROM alerts a 
     LEFT JOIN threats t ON a.threat_id = t.id 
     ORDER BY a.timestamp DESC LIMIT 10`,
    (err, rows) => {
      res.json(rows || []);
    }
  );
});

// Dashboard stats
app.get('/api/stats', verifyToken, (req, res) => {
  Promise.all([
    new Promise((resolve) => {
      db.get('SELECT COUNT(*) as count FROM threats', (err, row) => resolve(row?.count || 0));
    }),
    new Promise((resolve) => {
      db.get("SELECT COUNT(*) as count FROM threats WHERE status = 'resolved'", (err, row) => resolve(row?.count || 0));
    }),
    new Promise((resolve) => {
      db.get("SELECT COUNT(*) as count FROM threats WHERE status = 'active' AND severity = 'High'", (err, row) => resolve(row?.count || 0));
    })
  ]).then(([total, resolved, critical]) => {
    res.json({ total, resolved, critical, active: total - resolved });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n✅ Server running at http://localhost:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`\n🔐 Default Login:`);
  console.log(`   Username: admin`);
  console.log(`   Password: Admin@123`);
  console.log(`\n💡 Set ANTHROPIC_API_KEY env var for AI threat analysis\n`);
});
