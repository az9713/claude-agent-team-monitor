# Agent Team Surveillance Dashboard

A real-time web dashboard that monitors Claude Code agent team activity - watch your agents collaborate, communicate, and complete tasks in real-time.

<video src="docs/demo.mp4" controls width="100%"></video>

---

## Quick Start (3 Commands)

```bash
# 1. Navigate to the server directory
cd surveil/server

# 2. Install dependencies (one-time setup)
npm install

# 3. Start the dashboard
node index.js
```

Then open your browser to: **http://localhost:3847**

That's it! The dashboard will automatically detect and display your active agent teams.

---

## What It Does

The surveillance dashboard provides real-time monitoring of Claude Code agent teams:

- **Agent Roster**: See all active agents with their roles, models, and status indicators
- **Live Message Stream**: Watch inter-agent communications in real-time (task assignments, status updates, shutdown requests)
- **Task Board**: Kanban-style view of pending, in-progress, and completed tasks with dependency tracking
- **Session History**: Review past agent team sessions stored in SQLite database
- **Auto-Reconnect**: Automatically reconnects if connection is lost, with visual status indicators

### Dashboard Features

#### Header
- **Status Indicator**: Green (connected) / Red (disconnected)
- **Team Badge**: Shows team name and member count
- **Team Selector**: Dropdown to switch between multiple active teams
- **Live/History Tabs**: Toggle between real-time monitoring and historical sessions
- **Live Clock**: Current time display

#### Agent Roster (Left Sidebar)
- **Colored Avatar Circles**: Each agent has a unique color with initials
- **Agent Details**: Name, type (coordinator/builder/etc.), and model information
- **Lead Badge**: Visual indicator for team leaders

#### Messages Panel (Center)
- **Reverse Chronological**: Most recent messages at top
- **Sender → Recipient**: Color-coded dots matching agent avatars
- **Type Badges**: Visual indicators for message types
  - `TASK_ASSIGNMENT` (blue)
  - `SHUTDOWN_REQUEST` (orange)
  - `IDLE_NOTIFICATION` (yellow)
  - `SHUTDOWN_APPROVED` (green)
  - `TEXT` (gray)
- **Structured Fields**: Renders message content with proper formatting
- **Expand/Collapse**: Long messages can be expanded for full viewing
- **Unread Counter**: Badge showing number of new messages

#### Task Board (Bottom)
- **3-Column Kanban**: Pending / In Progress / Completed
- **Task Cards**: Display task ID, subject, owner badge
- **Dependency Badges**: Shows "blocks" and "blocked-by" relationships
- **Active Form Indicator**: Spinner for tasks currently being worked on
- **Smart Filtering**: Hides internal and deleted tasks

#### History Tab
- **Session List**: All past agent team sessions from database
- **Click to Load**: View full session with roster, messages, and tasks
- **Persistent Storage**: Sessions survive server restarts

#### Connection Management
- **Auto-Reconnect**: Attempts reconnection every 5 seconds
- **Visual Banner**: Warning displayed when disconnected from server

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                       Browser Dashboard                      │
│  (HTML/CSS/JavaScript - displays agents, messages, tasks)   │
└────────────────────────┬────────────────────────────────────┘
                         │ WebSocket (real-time bidirectional)
                         │ HTTP (serves dashboard.html)
┌────────────────────────┴────────────────────────────────────┐
│                      Express Server                          │
│  - HTTP endpoints (serve dashboard, REST API)                │
│  - WebSocket handler (broadcast updates to clients)          │
└─┬────────────────┬────────────────┬────────────────────────┬┘
  │                │                │                        │
  │                │                │                        │
┌─┴──────────┐ ┌──┴──────────┐ ┌──┴──────────┐  ┌──────────┴──────┐
│FileWatcher │ │DataAggregator│ │SQLiteStore │  │WebSocketHandler │
│            │ │              │ │            │  │                 │
│ chokidar   │ │ JSON parser  │ │ Session DB │  │ Connection mgmt │
│ watches    │ │ unifies state│ │ (WAL mode) │  │ + heartbeat     │
└─┬──────────┘ └──────────────┘ └────────────┘  └─────────────────┘
  │
  │ watches filesystem
  │
┌─┴─────────────────────────────────────────────────────────────┐
│               ~/.claude/ directories                          │
│  - teams/ (team config JSON files)                            │
│  - tasks/ (task state JSON files)                             │
└───────────────────────────────────────────────────────────────┘
```

### How It Works

1. **FileWatcher** uses `chokidar` to monitor `~/.claude/teams/` and `~/.claude/tasks/` directories
2. When files change, **FileWatcher** emits typed events (`team-config-changed`, `inbox-changed`, `task-changed`)
3. **DataAggregator** parses JSON files and builds unified in-memory state
4. **SQLiteStore** persists session history for later review
5. **WebSocketHandler** broadcasts state updates to all connected browser clients
6. **Express** serves the dashboard HTML and provides REST API endpoints
7. **Browser** connects via WebSocket, receives updates, and renders the dashboard in real-time

---

## Technology Stack (Explained for C/C++/Java Developers)

If you're coming from C, C++, or Java, here's how the technologies map to concepts you already know:

| Technology | What It Is | Analogy |
|------------|-----------|---------|
| **Node.js** | JavaScript runtime for server-side code | Like the JVM for Java, or a C++ executable - runs your application |
| **npm** | Package manager for Node.js | Like Maven for Java, or pip for Python - downloads and manages dependencies |
| **Express** | HTTP server framework | Like Spring Boot (Java) or Flask (Python) - handles HTTP requests/responses |
| **WebSocket (ws)** | Full-duplex communication protocol | Like TCP sockets in C/C++, but designed for browsers - bidirectional, persistent connection |
| **chokidar** | File system watcher | Like inotify on Linux or FileSystemWatcher in .NET - detects file changes |
| **better-sqlite3** | SQLite database driver | Like JDBC for Java, or sqlite3 library for C - provides database connectivity |
| **SQLite** | Embedded SQL database | Like H2 for Java or Berkeley DB for C++ - no server needed, just a file |

### Node.js Concepts

#### What is Node.js?
Node.js is a runtime that lets you run JavaScript outside the browser. Just like you compile C++ code into an executable, or run Java bytecode in the JVM, Node.js executes JavaScript code.

```javascript
// JavaScript (similar to Java/C++)
const message = "Hello World";  // const = final in Java
console.log(message);           // System.out.println() in Java
```

#### What is npm?
`npm` (Node Package Manager) is like Maven or Gradle for Java. It:
- Downloads third-party libraries (dependencies)
- Manages version compatibility
- Runs build scripts

The `package.json` file is like `pom.xml` (Maven) or `build.gradle` - it lists dependencies and project metadata.

#### What are Node.js modules?
Node.js uses a module system similar to Java packages or C++ header files:

```javascript
// Importing (like #include or import)
const express = require('express');  // CommonJS style (older)
import express from 'express';       // ES6 style (newer)

// Exporting (like public class or header declarations)
module.exports = { myFunction };     // CommonJS
export { myFunction };               // ES6
```

---

## Configuration

The dashboard can be configured using environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `SURVEIL_PORT` | `3847` | HTTP server port |
| `SURVEIL_TEAMS_DIR` | `~/.claude/teams/` | Directory containing team config JSON files |
| `SURVEIL_TASKS_DIR` | `~/.claude/tasks/` | Directory containing task state JSON files |

### Setting Environment Variables

**Windows (Command Prompt):**
```cmd
set SURVEIL_PORT=8080
node index.js
```

**Windows (PowerShell):**
```powershell
$env:SURVEIL_PORT=8080
node index.js
```

**macOS/Linux (Bash):**
```bash
export SURVEIL_PORT=8080
node index.js

# Or inline:
SURVEIL_PORT=8080 node index.js
```

---

## Directory Structure

```
surveil/
├── README.md              # This file
├── SKILL.md              # Claude Code skill definition
├── server/               # Node.js backend server
│   ├── package.json      # Dependencies and npm scripts
│   ├── index.js          # Main entry point (200 lines)
│   ├── lib/              # Core server modules
│   │   ├── file-watcher.js      # chokidar directory watcher (430 lines)
│   │   ├── data-aggregator.js   # JSON parser + state builder (170 lines)
│   │   ├── sqlite-store.js      # Session history persistence (350 lines)
│   │   └── websocket-handler.js # WebSocket connection manager (325 lines)
│   ├── public/           # Frontend assets
│   │   └── dashboard.html       # Complete single-file dashboard (1838 lines)
│   └── data/             # Runtime data (created automatically)
│       └── surveillance.db      # SQLite database (created at runtime)
└── docs/                 # Documentation assets
    └── agent_surveillance.jpg   # Screenshot
```

### Key Files Explained

#### `index.js` (Main Entry Point)
The application's "main method" - wires together all components:
- Creates Express HTTP server
- Initializes FileWatcher to monitor directories
- Sets up DataAggregator to parse JSON files
- Creates SQLiteStore for persistence
- Configures WebSocketHandler for real-time updates
- Defines HTTP routes and starts the server

#### `lib/file-watcher.js` (File System Monitor)
Uses `chokidar` to watch `~/.claude/` directories and emit events when files change:
- `team-config-changed` - Team roster or configuration updated
- `inbox-changed` - New inter-agent message
- `task-changed` - Task created, updated, or completed

#### `lib/data-aggregator.js` (State Builder)
Parses JSON files from watched directories and builds unified in-memory state:
- Reads team JSON files to build agent roster
- Reads inbox JSON files to extract messages
- Reads task JSON files to build task board
- Provides snapshot of current state for new WebSocket connections

#### `lib/sqlite-store.js` (Database Persistence)
Manages SQLite database for session history:
- WAL (Write-Ahead Logging) mode for better concurrency
- Stores complete session snapshots (roster, messages, tasks)
- Provides query methods for history tab

#### `lib/websocket-handler.js` (Real-Time Communication)
Manages WebSocket connections to browser clients:
- Handles connection lifecycle (connect, disconnect, error)
- Implements heartbeat/ping-pong to detect dead connections
- Broadcasts state updates to all connected clients
- Provides individual message sending

#### `public/dashboard.html` (Frontend Dashboard)
Complete single-file web application with inline CSS and JavaScript:
- Dark theme UI with responsive layout
- WebSocket client for real-time updates
- Agent roster rendering with color-coded avatars
- Message panel with type badges and expand/collapse
- Kanban task board with dependency visualization
- History browser for past sessions
- Auto-reconnect logic with status indicators

---

## Claude Code Skill Integration

This dashboard is designed to work seamlessly with Claude Code's agent team system.

### Skill Definition (`SKILL.md`)

The skill can be triggered with any of these phrases:
- "surveil my agents"
- "agent dashboard"
- "monitor agents"
- "agent surveillance"
- "launch dashboard"

When triggered, Claude Code will:
1. Check if dependencies are installed (`npm install` if needed)
2. Start the server with `node index.js`
3. Provide the URL to open in your browser

### Manual Launch

You can also run it manually without the skill:

```bash
cd surveil/server
node index.js
```

Or use the npm script defined in `package.json`:

```bash
cd surveil/server
npm start
```

---

## Development

Want to customize or extend the dashboard? Here's how to get started.

### Prerequisites

- **Node.js**: Version 18 or higher ([download here](https://nodejs.org/))
- **Text Editor**: VS Code, Sublime Text, or any editor you prefer

To check if Node.js is installed:
```bash
node --version  # Should print v18.x.x or higher
npm --version   # Should print 9.x.x or higher
```

### Installing Dependencies

The first time you work with the project (or after pulling updates), install dependencies:

```bash
cd surveil/server
npm install
```

This reads `package.json` and downloads all required libraries to `node_modules/` directory.

**Note**: The `node_modules/` directory contains ~50MB of code and is NOT committed to version control (listed in `.gitignore`). Every developer must run `npm install` to get dependencies.

### Running in Development Mode

```bash
cd surveil/server
node index.js
```

The server will print:
```
Agent Surveillance Dashboard started
HTTP server: http://localhost:3847
Watching: /home/user/.claude/teams
Watching: /home/user/.claude/tasks
```

Press `Ctrl+C` to stop the server.

### Project Structure for Development

```
server/
├── index.js                 # START HERE - main entry point
├── lib/
│   ├── file-watcher.js     # Modify to watch additional directories
│   ├── data-aggregator.js  # Modify to parse additional JSON fields
│   ├── sqlite-store.js     # Modify to add database tables/queries
│   └── websocket-handler.js # Modify to add WebSocket message types
└── public/
    └── dashboard.html      # Modify to change UI layout/styling
```

### Making Changes

#### 1. Changing the UI (dashboard.html)

The dashboard is a single HTML file with embedded CSS and JavaScript. To modify:

1. Open `server/public/dashboard.html` in your editor
2. Find the section you want to change:
   - **CSS styles**: Inside `<style>` tag (lines 10-400 approx.)
   - **HTML structure**: Inside `<body>` tag (lines 400-600 approx.)
   - **JavaScript logic**: Inside `<script>` tag (lines 600-1838 approx.)
3. Make your changes
4. Restart the server (`Ctrl+C`, then `node index.js`)
5. Refresh your browser (`Ctrl+R` or `F5`)

**Example**: Change the theme color from purple to blue:

```css
/* Find this in the <style> section: */
:root {
  --accent: #9333ea;  /* Purple */
}

/* Change to: */
:root {
  --accent: #2563eb;  /* Blue */
}
```

#### 2. Adding a New File Watcher Event

Want to watch additional files? Modify `lib/file-watcher.js`:

```javascript
// In the _handleChange method, add a new case:
if (filePath.includes('new-directory')) {
  this.emit('new-event-type', { filePath, data: jsonData });
}
```

Then handle the event in `index.js`:

```javascript
fileWatcher.on('new-event-type', (payload) => {
  console.log('New event detected:', payload);
  // Process and broadcast to clients
});
```

#### 3. Adding a New Database Table

Want to store additional data? Modify `lib/sqlite-store.js`:

```javascript
// In the _initDatabase method:
this.db.exec(`
  CREATE TABLE IF NOT EXISTS my_new_table (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    timestamp INTEGER NOT NULL
  )
`);
```

Then add query methods:

```javascript
insertRecord(name) {
  const stmt = this.db.prepare(`
    INSERT INTO my_new_table (name, timestamp) VALUES (?, ?)
  `);
  stmt.run(name, Date.now());
}

getAllRecords() {
  return this.db.prepare('SELECT * FROM my_new_table').all();
}
```

#### 4. Adding a New WebSocket Message Type

Want to send custom data to the dashboard? Modify `lib/websocket-handler.js`:

```javascript
// Add a new broadcast method:
broadcastCustomData(data) {
  this.broadcast({
    type: 'custom-data',
    payload: data
  });
}
```

Then handle it in `dashboard.html`:

```javascript
// In the WebSocket message handler:
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  if (message.type === 'custom-data') {
    console.log('Custom data received:', message.payload);
    // Update UI accordingly
  }
};
```

### Testing Changes

After making changes:

1. **Restart the server**: `Ctrl+C`, then `node index.js`
2. **Refresh the browser**: `Ctrl+R` or `F5`
3. **Check browser console**: Press `F12`, go to "Console" tab for errors
4. **Check server logs**: Look at terminal output for error messages

### Common Development Tasks

#### Add a new HTTP endpoint:
```javascript
// In index.js, add:
app.get('/api/my-endpoint', (req, res) => {
  res.json({ message: 'Hello from new endpoint' });
});
```

#### Add a new configuration option:
```javascript
// In index.js, add:
const myOption = process.env.SURVEIL_MY_OPTION || 'default-value';
console.log('My option:', myOption);
```

#### Log debugging information:
```javascript
// Add anywhere in your code:
console.log('Debug info:', variableName);
console.error('Error occurred:', error);
console.warn('Warning:', message);
```

---

## Troubleshooting

### Problem: "node: command not found"

**Cause**: Node.js is not installed or not in your system PATH.

**Solution**:
1. Download Node.js from https://nodejs.org/ (LTS version recommended)
2. Run the installer with default options
3. **Close and reopen your terminal** (important!)
4. Verify: `node --version` should print the version number

**Windows Note**: The installer should add Node.js to PATH automatically. If not, add `C:\Program Files\nodejs\` to your PATH environment variable.

---

### Problem: "npm: command not found"

**Cause**: npm is not installed (usually comes with Node.js).

**Solution**:
1. Reinstall Node.js (npm is bundled with it)
2. Verify: `npm --version`

---

### Problem: Port 3847 is already in use

**Error Message**:
```
Error: listen EADDRINUSE: address already in use :::3847
```

**Cause**: Another process is using port 3847, or you have a zombie server process running.

**Solution 1 - Kill the existing process**:

**Windows:**
```cmd
netstat -ano | findstr :3847
taskkill /PID <PID> /F
```

**macOS/Linux:**
```bash
lsof -i :3847
kill -9 <PID>
```

**Solution 2 - Use a different port**:
```bash
SURVEIL_PORT=8080 node index.js
```

---

### Problem: "npm install" fails

**Error Message**: Various errors during `npm install`

**Common Causes**:
1. **Network issues**: npm cannot reach package registry
2. **Permission issues**: Cannot write to node_modules directory
3. **Corrupted cache**: npm cache is corrupted

**Solution**:

**Step 1 - Clear npm cache**:
```bash
npm cache clean --force
```

**Step 2 - Delete existing node_modules and try again**:
```bash
rm -rf node_modules package-lock.json  # macOS/Linux
# OR
rmdir /s node_modules & del package-lock.json  # Windows

npm install
```

**Step 3 - Check permissions** (macOS/Linux):
```bash
sudo chown -R $USER ~/.npm
```

**Step 4 - Try alternate registry** (if network issues):
```bash
npm install --registry=https://registry.npmmirror.com
```

---

### Problem: Native module build errors (better-sqlite3)

**Error Message**:
```
gyp ERR! build error
Error: `C:\Program Files\...` failed with exit code: 1
```

**Cause**: `better-sqlite3` is a native module that needs to be compiled. Build tools are missing.

**Solution**:

**Windows**:
```powershell
# Install Windows Build Tools (run PowerShell as Administrator)
npm install --global windows-build-tools

# Alternatively, install Visual Studio Build Tools manually:
# https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022
```

**macOS**:
```bash
# Install Xcode Command Line Tools
xcode-select --install
```

**Linux (Debian/Ubuntu)**:
```bash
sudo apt-get install build-essential python3
```

**Linux (Fedora/RHEL)**:
```bash
sudo yum install gcc gcc-c++ make python3
```

After installing build tools:
```bash
npm rebuild better-sqlite3
```

---

### Problem: Dashboard shows "Disconnected" banner

**Cause**: WebSocket connection to server failed or was lost.

**Solution**:

**Step 1 - Check server is running**:
- Look at the terminal where you ran `node index.js`
- Should say "HTTP server: http://localhost:3847"
- If not running, start it: `node index.js`

**Step 2 - Check browser console**:
- Press `F12` in browser
- Go to "Console" tab
- Look for WebSocket errors (red text)

**Step 3 - Verify URL**:
- Make sure you're using `http://localhost:3847` (not HTTPS)
- Try `http://127.0.0.1:3847` instead

**Step 4 - Check firewall**:
- Windows Firewall or antivirus may block WebSocket connections
- Temporarily disable to test

The dashboard will **auto-reconnect every 5 seconds** once the server is reachable.

---

### Problem: Dashboard is blank or shows no data

**Cause**: No agent teams are currently active, or directories are empty.

**Solution**:

**Step 1 - Check directories**:
```bash
# macOS/Linux
ls -la ~/.claude/teams/
ls -la ~/.claude/tasks/

# Windows
dir %USERPROFILE%\.claude\teams
dir %USERPROFILE%\.claude\tasks
```

If directories don't exist or are empty, there are no agent teams to display.

**Step 2 - Start an agent team**:
Use Claude Code to start an agent team. The dashboard will automatically detect it.

**Step 3 - Check server logs**:
The terminal running `node index.js` should show:
```
Watching: /home/user/.claude/teams
Watching: /home/user/.claude/tasks
```

If not, the directories may not exist yet.

---

### Problem: Changes to dashboard.html not appearing

**Cause**: Browser cache or server not restarted.

**Solution**:

**Step 1 - Hard refresh browser**:
- **Windows/Linux**: `Ctrl + Shift + R`
- **macOS**: `Cmd + Shift + R`

**Step 2 - Restart server**:
```bash
# Press Ctrl+C to stop
node index.js
```

**Step 3 - Clear browser cache**:
- Chrome: `F12` → Network tab → Check "Disable cache"
- Firefox: `F12` → Settings (gear icon) → Check "Disable HTTP cache"

---

### Problem: SQLite database is locked

**Error Message**:
```
SqliteError: database is locked
```

**Cause**: Multiple server instances running, or database file corruption.

**Solution**:

**Step 1 - Stop all server instances**:
```bash
# Find all node processes
ps aux | grep node          # macOS/Linux
tasklist | findstr node     # Windows

# Kill them all
killall node                # macOS/Linux
taskkill /IM node.exe /F    # Windows
```

**Step 2 - Delete database and restart** (will lose history):
```bash
rm server/data/surveillance.db
node index.js
```

**Step 3 - Check file permissions**:
```bash
ls -l server/data/surveillance.db  # macOS/Linux
```

Make sure the file is writable by your user.

---

### Problem: "Cannot find module 'express'"

**Error Message**:
```
Error: Cannot find module 'express'
```

**Cause**: Dependencies not installed, or `node_modules` directory deleted.

**Solution**:
```bash
cd surveil/server
npm install
```

Make sure you're in the `server/` directory when running `npm install`.

---

### Problem: WebSocket connection fails with 403 or 404

**Cause**: WebSocket path mismatch or proxy/reverse proxy interference.

**Solution**:

**Step 1 - Check WebSocket URL in dashboard.html**:
```javascript
// Should be:
const ws = new WebSocket('ws://localhost:3847');
```

**Step 2 - If behind a proxy**:
Configure proxy to allow WebSocket upgrade:
```
# nginx example
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

**Step 3 - Try direct connection**:
Access dashboard directly without any proxies: `http://localhost:3847`

---

## Performance Tips

### Large Agent Teams

If you have many agents (>20) or high message volume:

1. **Increase heartbeat interval** in `lib/websocket-handler.js`:
```javascript
// Change from 30s to 60s
this.heartbeatInterval = 60000;
```

2. **Limit message history** in `dashboard.html`:
```javascript
// Keep only last 100 messages in memory
if (messages.length > 100) {
  messages = messages.slice(-100);
}
```

3. **Optimize SQLite** in `lib/sqlite-store.js`:
```javascript
// Add VACUUM periodically to reclaim space
this.db.exec('VACUUM');
```

### Memory Usage

The server keeps all state in memory. For long-running deployments:

1. **Restart periodically**: Add to cron job or Windows Task Scheduler
2. **Monitor memory**: `node --max-old-space-size=512 index.js` (limit to 512MB)

---

## License

MIT License

Copyright (c) 2026 Agent Team Surveillance Dashboard

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

## Contributing

Contributions are welcome! To contribute:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Test thoroughly
5. Submit a pull request with clear description

### Code Style

- Use **2 spaces** for indentation (not tabs)
- Use **camelCase** for variables and functions
- Use **PascalCase** for classes
- Add **comments** for complex logic
- Keep functions **small and focused** (under 50 lines)

---

## Support

For issues, questions, or feature requests:

1. Check the **Troubleshooting** section above
2. Review **existing issues** in the repository
3. Open a new issue with:
   - Your operating system and Node.js version
   - Complete error message
   - Steps to reproduce

---

## Acknowledgments

This project was inspired by the YouTube video ["Claude Code Agent Teams Explained (Complete Guide)"](https://www.youtube.com/watch?v=1jlKUxqRQAw).

All code and documentation were generated by [Claude Code](https://claude.ai/claude-code) powered by Opus 4.6.

Built for the Claude Code agent team system. Uses open-source technologies:
- Express.js for HTTP server
- ws for WebSocket communication
- chokidar for file system watching
- better-sqlite3 for database persistence

---

**Happy Surveilling!** Watch your agents collaborate in real-time.
