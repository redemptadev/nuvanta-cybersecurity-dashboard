Cybersecurity Dashboard (Real Backend + AI Analysis)

Quick Start

Prerequisites: Node.js installed

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. Open http://localhost:3000 in your browser

Login Credentials (Default)
- **Username:** admin
- **Password:** Admin@123

Features

✅ Admin Login (JWT Authentication)
✅ Real Threat Detection & Management
✅ AI-Powered Threat Analysis (Claude API)
✅ Threat Intelligence Dashboard
✅ Remediation Recommendations
✅ Real-time Alert Monitoring
✅ SQLite Database Storage

How to Use

1. Login with admin credentials
2. Go to "Threats" tab to see detected threats
3. Click "Get AI Fix" on any threat to get AI-powered remediation steps
4. Mark threats as "Resolved" when fixed
5. Monitor real-time alerts in "Alerts" tab

AI Threat Analysis (Optional)

To enable AI threat analysis with Claude:

1. Get an API key from https://console.anthropic.com/
2. Set it in `.env` file:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
3. Restart the server
4. Now "Get AI Fix" button will use Claude for analysis

Without API key: Shows fallback remediation recommendations

Files

- `server.js` — Node.js/Express backend with SQLite
- `index.html` — Login page + dashboard
- `assets/css/styles.css` — Dark theme styling
- `assets/js/main.js` — Frontend logic + API calls
- `dashboard.db` — SQLite database (auto-created)

API Endpoints

- `POST /api/login` — Authenticate admin
- `GET /api/threats` — Get all threats
- `POST /api/threats` — Create threat
- `PATCH /api/threats/:id` — Update threat status/remediation
- `POST /api/analyze-threat` — AI threat analysis
- `GET /api/alerts` — Get recent alerts
- `GET /api/stats` — Get dashboard stats

Database Schema

**users:** id, username, password, role
**threats:** id, type, severity, description, source, timestamp, status, remediation
**alerts:** id, threat_id, message, timestamp, resolved

Customization

- Change `SECRET_KEY` in `.env` for production
- Modify threat types in sample data (main.js)
- Adjust alert thresholds as needed
- Add more threat sources in server.js

Troubleshooting

Q: Port 3000 already in use?
A: Kill existing process or change PORT in `.env`

Q: AI analysis not working?
A: Fallback recommendations will still appear. Set ANTHROPIC_API_KEY to use Claude.

Q: Database reset needed?
A: Delete `dashboard.db` file and restart server.

