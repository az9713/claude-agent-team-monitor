# Developer Guide: Agent Team Surveillance Dashboard

**Target Audience**: Developers with C/C++/Java experience who are new to Node.js web development.

**Goal**: Provide a complete ground-up understanding of this codebase so you can maintain and extend it without external help.

---

## Table of Contents

1. [Architecture Deep Dive](#1-architecture-deep-dive)
2. [Module-by-Module Walkthrough](#2-module-by-module-walkthrough)
3. [JSON Data Schemas](#3-json-data-schemas)
4. [SQLite Schema](#4-sqlite-schema)
5. [WebSocket Protocol](#5-websocket-protocol)
6. [How to Add a New Feature](#6-how-to-add-a-new-feature)
7. [How to Debug](#7-how-to-debug)
8. [Common Pitfalls and Gotchas](#8-common-pitfalls-and-gotchas)
9. [Testing with Test Data](#9-testing-with-test-data)
10. [Dependency Reference](#10-dependency-reference)

---

## 1. Architecture Deep Dive

### Big Picture: Data Flow

```
Disk: JSON files in ~/.claude/teams/ and ~/.claude/tasks/
    |
    | (chokidar watches these directories)
    v
FileWatcher (EventEmitter)
    |
    | emits typed events:
    |   - 'team-config-changed'
    |   - 'inbox-changed'
    |   - 'task-changed'
    v
DataAggregator (in-memory JavaScript state)
    |
    +---> SQLiteStore (persistence to surveillance.db)
    |
    | (broadcasts via WebSocket)
    v
WebSocketHandler ----> Browser Clients
    ^
    | (HTTP requests)
Express Server (static files + REST API)
```

**Analogy**: Think of this like a C++ application with:
- **FileWatcher** = File I/O thread with observer pattern callbacks
- **DataAggregator** = In-memory data structure (like a `std::map`)
- **SQLiteStore** = JDBC-style database persistence (synchronous, like prepared statements)
- **WebSocketHandler** = Network socket server broadcasting to connected clients
- **Express** = HTTP servlet container serving static files and REST endpoints

### Design Decisions

#### 1. Single HTML File (No Build Step)
**File**: `server/public/dashboard.html` (1838 lines)

All CSS and JavaScript is **inline** in the HTML file. This means:
- No webpack, no babel, no npm build step
- Edit `dashboard.html` directly and refresh browser
- Approximately 900 lines of CSS in `<style>` tag
- Approximately 770 lines of JavaScript in `<script>` tag

**Java analogy**: Like a single JSP file with embedded scriptlet code (but much better organized).

#### 2. CommonJS Module System
**Example**: `const FileWatcher = require('./lib/file-watcher');`

This project uses **`require()`**, NOT **`import`**. This is the traditional Node.js module system.

**Exports**:
```javascript
// At end of file:
module.exports = FileWatcher;
```

**Imports**:
```javascript
// At start of file:
const FileWatcher = require('./lib/file-watcher');
```

**Java analogy**: Similar to Java's `import` statements, but loaded at runtime instead of compile-time.

#### 3. Synchronous SQLite (No Promises/Async)
**Library**: better-sqlite3

The database operations are **synchronous**, like JDBC:

```javascript
// This is synchronous - blocks until complete
const session = this.stmts.getSession.get(sessionId);
```

**NOT async**:
```javascript
// DON'T do this - better-sqlite3 doesn't return promises
const session = await this.stmts.getSession.get(sessionId); // WRONG
```

**Java analogy**: Exactly like `PreparedStatement.executeQuery()` - blocks the thread until complete.

#### 4. EventEmitter Pattern (Observer Pattern)
**Base class**: Node.js built-in `EventEmitter`

FileWatcher extends EventEmitter (lines 1, 15 in `file-watcher.js`):

```javascript
const EventEmitter = require('events');

class FileWatcher extends EventEmitter {
  // ...
  this.emit('team-config-changed', { teamName, filePath });
}
```

Listeners subscribe in `index.js` (line 63):

```javascript
watcher.on('team-config-changed', ({ teamName, filePath }) => {
  // Handle event
});
```

**Java analogy**: Like implementing `java.util.Observable` / `Observer` pattern, or using Spring's `ApplicationEventPublisher`.

#### 5. No Frontend Framework (Vanilla JavaScript)
The dashboard uses plain JavaScript DOM manipulation:

```javascript
function renderRoster(members) {
  return members.map(member => `
    <div class="agent-card">
      <div class="agent-avatar" style="background: ${member.color}">
        ${member.name[0]}
      </div>
      <div class="agent-info">
        <div class="agent-name">${member.name}</div>
      </div>
    </div>
  `).join('');
}

document.getElementById('roster-list').innerHTML = renderRoster(members);
```

**No React, no Vue, no Angular**. Just functions that return HTML strings.

**Java analogy**: Like JSP scriptlets or servlet string concatenation (but with template literals).

---

## 2. Module-by-Module Walkthrough

### index.js (200 lines) - Application Entry Point

**Location**: `server/index.js`

**Role**: The `main()` function of the application. Creates all components and wires them together.

**Key sections**:

1. **Configuration** (lines 11-14):
```javascript
const PORT = parseInt(process.env.SURVEIL_PORT, 10) || 3847;
const TEAMS_DIR = process.env.SURVEIL_TEAMS_DIR || undefined;
const TASKS_DIR = process.env.SURVEIL_TASKS_DIR || undefined;
```
Environment variables with defaults. `undefined` means "use default in FileWatcher".

2. **Express Setup** (lines 16-25):
```javascript
const app = express();
const server = http.createServer(app);
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});
```
Creates HTTP server and serves static files from `public/` directory.

**Java analogy**: Like configuring Tomcat to serve static files from a `webapp/` directory.

3. **Component Instantiation** (lines 27-37):
```javascript
const aggregator = new DataAggregator();
const store = new SQLiteStore();
const watcher = new FileWatcher({ teamsDir: TEAMS_DIR, tasksDir: TASKS_DIR });
const wss = new WebSocketServer({ server });
const wsHandler = new WebSocketHandler({ wss });
```
Creates instances of all components.

**Java analogy**: Spring dependency injection, but manual.

4. **Wire WebSocket Callbacks** (lines 40-60):
```javascript
wsHandler.init(
  (teamName) => aggregator.getState(),  // getState function
  () => store.listSessions(),            // getHistory function
  (sessionId) => store.getSession(sessionId) // getSession function
);
```
Passes functions to WebSocketHandler so it can retrieve data on demand.

**Java analogy**: Dependency injection via setter methods (strategy pattern).

5. **Event Listeners** (lines 63-135):
```javascript
watcher.on('team-config-changed', ({ teamName, filePath }) => {
  aggregator.updateTeamConfig(teamName, filePath);
  const team = aggregator.getState().teams[teamName];

  if (team && team.config) {
    const sessionId = store.upsertSession(team.config);
    store.upsertMembers(sessionId, team.config.members);
  }

  wsHandler.broadcastTeamUpdate(teamName, 'config', team);
});
```

**Event flow**:
- FileWatcher detects file change → emits event
- Aggregator updates in-memory state
- SQLiteStore persists to database
- WebSocketHandler broadcasts to browser clients

**Java analogy**: Event listener chain like Spring's `@EventListener`.

6. **REST API** (lines 138-156):
```javascript
app.get('/api/sessions', (req, res) => {
  res.json(store.listSessions());
});

app.get('/api/sessions/:id', (req, res) => {
  const session = store.getSession(parseInt(req.params.id, 10));
  res.json(session);
});
```
Simple REST endpoints for history access.

**Java analogy**: JAX-RS `@Path` methods or Spring `@GetMapping`.

7. **Graceful Shutdown** (lines 159-173):
```javascript
function shutdown() {
  wsHandler.shutdown();
  watcher.stop();
  store.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000); // Force exit after 3s
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
```
Handles Ctrl+C and kills gracefully.

**Java analogy**: `Runtime.addShutdownHook()`.

8. **Main Function** (lines 176-200):
```javascript
async function main() {
  await watcher.start();
  server.listen(PORT, () => {
    console.log(`Dashboard running at http://localhost:${PORT}`);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
```

**C++ analogy**: This is literally `int main()`.

---

### file-watcher.js (430 lines) - File System Monitor

**Location**: `server/lib/file-watcher.js`

**Role**: Watches JSON files on disk and emits events when they change.

**Key concept**: Extends `EventEmitter` to enable the observer pattern.

#### Constructor (lines 16-30)

```javascript
constructor(options = {}) {
  super(); // Call EventEmitter constructor

  const homeDir = os.homedir();
  this.teamsDir = options.teamsDir || path.join(homeDir, '.claude', 'teams');
  this.tasksDir = options.tasksDir || path.join(homeDir, '.claude', 'tasks');

  this.watcher = null;
  this.debounceTimers = new Map();
  this.debounceDelay = 100; // milliseconds
}
```

**Default directories**: `~/.claude/teams/` and `~/.claude/tasks/`

**Debouncing**: Windows fires double events for file changes, so we wait 100ms before processing.

**Java analogy**: Constructor similar to setting up a `FileSystemWatcher` or `WatchService`.

#### start() Method (lines 35-70)

**Steps**:
1. Perform initial scan of existing files (lines 42-43)
2. Start chokidar watcher (lines 45-53)
3. Set up event handlers (lines 56-62)

```javascript
async start() {
  await this._performInitialScan();

  this.watcher = chokidar.watch([this.teamsDir, this.tasksDir], {
    persistent: true,
    ignoreInitial: true  // We handled initial scan ourselves
  });

  this.watcher
    .on('add', (filePath) => this._handleFileChange(filePath))
    .on('change', (filePath) => this._handleFileChange(filePath))
    .on('unlink', (filePath) => this._handleFileChange(filePath));
}
```

**CRITICAL**: chokidar v4 watches **DIRECTORIES**, not glob patterns. See [Common Pitfalls](#8-common-pitfalls-and-gotchas).

#### Initial Scan (lines 99-219)

Scans existing files on startup:
- `_performInitialScan()` (lines 99-113) - orchestrator
- `_scanTeamConfigs()` (lines 118-135) - finds all `config.json` files
- `_scanInboxes()` (lines 140-163) - finds all inbox JSON files
- `_scanTasks()` (lines 168-191) - finds all task JSON files

**Why?** Chokidar with `ignoreInitial: true` won't fire events for existing files, so we must load them manually.

#### File Change Processing (lines 224-261)

**Flow**:
1. `_handleFileChange(filePath)` (line 224) - debounces by 100ms
2. `_processFileChange(filePath)` (line 248) - determines file type and emits event

```javascript
_processFileChange(filePath) {
  if (this._isTeamConfig(filePath)) {
    this._emitTeamConfigChanged(filePath);
  } else if (this._isInboxFile(filePath)) {
    this._emitInboxChanged(filePath);
  } else if (this._isTaskFile(filePath)) {
    this._emitTaskChanged(filePath);
  }
}
```

#### Path Classification (lines 266-298)

Three methods determine file type based on path:

```javascript
_isTeamConfig(filePath) {
  const normalized = this._normalizePath(filePath);
  return normalized.endsWith('config.json')
      && !normalized.includes('inboxes');
}

_isInboxFile(filePath) {
  return normalized.includes('inboxes') && normalized.endsWith('.json');
}

_isTaskFile(filePath) {
  return normalized.startsWith(this.tasksDir) && normalized.endsWith('.json');
}
```

**Path normalization** (line 424): Converts Windows backslashes to forward slashes for consistent string matching.

```javascript
_normalizePath(filePath) {
  return filePath.split(path.sep).join('/');
}
```

#### Path Extraction (lines 303-419)

Three methods extract metadata from file paths:

**Example 1**: Team config
```javascript
// Input: C:\Users\...\.claude\teams\my-team\config.json
// Output: "my-team"
_extractTeamNameFromConfig(filePath) {
  const normalized = this._normalizePath(filePath);
  const relativePath = normalized.substring(this.teamsDir.length + 1);
  const parts = relativePath.split('/');
  return parts[0]; // "my-team"
}
```

**Example 2**: Inbox file
```javascript
// Input: C:\Users\...\.claude\teams\my-team\inboxes\agent-1.json
// Output: { teamName: "my-team", agentName: "agent-1" }
_extractInboxInfo(filePath) {
  // parts = ['my-team', 'inboxes', 'agent-1.json']
  const teamName = parts[0];
  const agentName = parts[2].replace('.json', '');
  return { teamName, agentName };
}
```

**Example 3**: Task file
```javascript
// Input: C:\Users\...\.claude\tasks\my-team\5.json
// Output: { teamName: "my-team", taskId: "5" }
_extractTaskInfo(filePath) {
  // parts = ['my-team', '5.json']
  const teamName = parts[0];
  const taskId = parts[1].replace('.json', '');
  return { teamName, taskId };
}
```

---

### data-aggregator.js (170 lines) - In-Memory State Manager

**Location**: `server/lib/data-aggregator.js`

**Role**: Parses JSON files and maintains current state in memory.

**Java analogy**: Like a `Map<String, Team>` with helper methods.

#### State Structure (lines 8-13)

```javascript
constructor() {
  this.state = {
    teams: {},        // { 'team-name': { config: {}, inboxes: {}, tasks: {} } }
    activeTeam: null  // Currently active team name
  };
}
```

**Shape**:
```javascript
{
  teams: {
    'snappy-seeking-candy': {
      config: { name: 'snappy-seeking-candy', members: [...], ... },
      inboxes: {
        'team-lead': [ {from: '...', text: '...', timestamp: '...'}, ... ],
        'agent-1': [ ... ]
      },
      tasks: {
        '1': { id: '1', subject: '...', status: 'completed', ... },
        '2': { id: '2', subject: '...', status: 'in_progress', ... }
      }
    }
  },
  activeTeam: 'snappy-seeking-candy'
}
```

**IMPORTANT**: Tasks are stored as **object maps** (`{id: task}`), NOT arrays. Dashboard must convert with `Object.values()`.

#### updateTeamConfig() (lines 20-39)

```javascript
updateTeamConfig(teamName, filePath) {
  const content = fs.readFileSync(filePath, 'utf8'); // Synchronous read
  const config = JSON.parse(content);

  if (!this.state.teams[teamName]) {
    this.state.teams[teamName] = { config: {}, inboxes: {}, tasks: {} };
  }

  this.state.teams[teamName].config = config;
  this.state.activeTeam = teamName;
}
```

**Steps**:
1. Read file synchronously (blocks until complete)
2. Parse JSON
3. Initialize team if doesn't exist
4. Store config
5. Update activeTeam

**Java analogy**: Like `readFileToString()` + `new ObjectMapper().readValue()` in Spring.

#### updateInbox() (lines 47-91)

**Key feature**: Message enrichment (lines 62-84).

```javascript
updateInbox(teamName, agentName, filePath) {
  const messages = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  const parsedMessages = messages.map(msg => {
    const enrichedMsg = {
      ...msg,
      to: agentName,            // Add recipient (inbox owner)
      messageType: 'text',      // Default type
      parsedContent: null       // Will be populated if JSON
    };

    // Try to parse msg.text as JSON
    if (msg.text) {
      try {
        const parsed = JSON.parse(msg.text);
        if (parsed && typeof parsed === 'object' && parsed.type) {
          enrichedMsg.parsedContent = parsed;
          enrichedMsg.messageType = parsed.type; // task_assignment, shutdown_request, etc.
        }
      } catch (parseError) {
        // Not JSON, keep as plain text
      }
    }

    return enrichedMsg;
  });

  this.state.teams[teamName].inboxes[agentName] = parsedMessages;
}
```

**Structured message detection**:
- If `msg.text` is valid JSON with a `type` field, it's a structured message
- Types: `task_assignment`, `shutdown_request`, `idle_notification`, `shutdown_approved`
- Otherwise, it's plain text

**Example**:
```javascript
// Plain text message
{ from: 'agent-1', text: 'Hello world', timestamp: '...' }
// → messageType: 'text', parsedContent: null

// Structured message
{ from: 'agent-1', text: '{"type":"task_assignment","taskId":"5"}', timestamp: '...' }
// → messageType: 'task_assignment', parsedContent: {type: 'task_assignment', taskId: '5'}
```

#### updateTask() (lines 99-123)

```javascript
updateTask(teamName, taskId, filePath) {
  const task = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  if (!this.state.teams[teamName]) {
    this.state.teams[teamName] = { config: {}, inboxes: {}, tasks: {} };
  }

  // Flag internal tasks
  if (task.metadata && task.metadata._internal === true) {
    task.isInternal = true;
  }

  this.state.teams[teamName].tasks[taskId] = task; // Store as object map
}
```

**Internal task detection**: If `task.metadata._internal === true`, add `task.isInternal = true` flag.

#### getMessages() (lines 146-166)

**Purpose**: Merge all inboxes for a team into a single chronological list.

```javascript
getMessages(teamName) {
  const team = this.state.teams[teamName];
  const allMessages = [];

  // Collect from all inboxes
  for (const [agentName, messages] of Object.entries(team.inboxes)) {
    allMessages.push(...messages);
  }

  // Sort by timestamp (oldest first)
  allMessages.sort((a, b) => {
    const timeA = new Date(a.timestamp || 0).getTime();
    const timeB = new Date(b.timestamp || 0).getTime();
    return timeA - timeB;
  });

  return allMessages;
}
```

**Why?** Dashboard displays messages chronologically across all agents.

---

### sqlite-store.js (350 lines) - Database Persistence

**Location**: `server/lib/sqlite-store.js`

**Role**: Persists team sessions, members, messages, and tasks to SQLite database.

**Library**: better-sqlite3 (synchronous, like JDBC)

#### Constructor (lines 10-29)

```javascript
constructor(options = {}) {
  const defaultPath = path.join(__dirname, '..', 'data', 'surveillance.db');
  this.dbPath = options.dbPath || defaultPath;

  // Create data directory if doesn't exist
  const dataDir = path.dirname(this.dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Open database connection
  this.db = new Database(this.dbPath);
  this.db.pragma('journal_mode = WAL'); // Write-Ahead Logging

  this._initSchema();
  this._prepareStatements();
}
```

**WAL Mode**: Write-Ahead Logging allows concurrent reads while writing. Better performance than default rollback journal.

**Java analogy**: Like `DriverManager.getConnection()` and `connection.setAutoCommit()`.

#### Schema Initialization (lines 34-88)

Four tables:

**1. sessions** (lines 36-45):
```sql
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_name TEXT NOT NULL,
  description TEXT,
  lead_agent_id TEXT,
  created_at INTEGER NOT NULL,
  ended_at INTEGER,
  config_snapshot TEXT NOT NULL,
  UNIQUE(team_name, created_at)  -- Prevents duplicate sessions
);
```

**Unique constraint**: Combination of team name and creation timestamp must be unique.

**2. session_members** (lines 47-56):
```sql
CREATE TABLE IF NOT EXISTS session_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER REFERENCES sessions(id),
  agent_id TEXT,
  name TEXT,
  agent_type TEXT,
  model TEXT,
  color TEXT,
  joined_at INTEGER
);
```

**No unique constraint**: Allows re-inserting members (idempotent with `INSERT OR IGNORE`).

**3. session_messages** (lines 58-71):
```sql
CREATE TABLE IF NOT EXISTS session_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER REFERENCES sessions(id),
  inbox_owner TEXT,        -- Recipient (inbox filename)
  from_agent TEXT,         -- Sender
  message_type TEXT,       -- 'text', 'task_assignment', etc.
  raw_text TEXT,
  parsed_json TEXT,        -- Structured message content (if any)
  summary TEXT,
  color TEXT,
  is_read INTEGER DEFAULT 0,
  timestamp TEXT,
  UNIQUE(session_id, inbox_owner, from_agent, timestamp)
);
```

**Unique constraint**: Prevents duplicate messages based on (session, recipient, sender, timestamp).

**4. session_tasks** (lines 73-86):
```sql
CREATE TABLE IF NOT EXISTS session_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER REFERENCES sessions(id),
  task_id TEXT,
  subject TEXT,
  description TEXT,
  active_form TEXT,
  status TEXT,
  owner TEXT,
  blocks TEXT,             -- JSON array: ["2", "3"]
  blocked_by TEXT,         -- JSON array: ["1"]
  is_internal INTEGER DEFAULT 0,
  UNIQUE(session_id, task_id)
);
```

**Unique constraint**: One task per session (allows updates via `INSERT OR REPLACE`).

#### Prepared Statements (lines 93-150)

**Why prepared statements?** Performance. Prepared once, executed many times.

**Java analogy**: `PreparedStatement` in JDBC.

```javascript
_prepareStatements() {
  this.stmts = {
    findSession: this.db.prepare(`
      SELECT * FROM sessions WHERE team_name = ? AND created_at = ?
    `),

    insertSession: this.db.prepare(`
      INSERT OR IGNORE INTO sessions
      (team_name, description, lead_agent_id, created_at, config_snapshot)
      VALUES (?, ?, ?, ?, ?)
    `),

    // ... more statements
  };
}
```

**Usage**:
```javascript
// Find session
const session = this.stmts.findSession.get(teamName, createdAt);

// Insert session
const result = this.stmts.insertSession.run(teamName, desc, leadId, createdAt, config);
```

**Methods**:
- `.get()` - Returns single row (like `executeQuery()` + `next()`)
- `.all()` - Returns all rows as array
- `.run()` - Executes without returning rows (returns `{changes, lastInsertRowid}`)

#### upsertSession() (lines 157-186)

**Purpose**: Create session if doesn't exist, return existing session ID if already exists.

```javascript
upsertSession(teamConfig) {
  const createdAt = teamConfig.createdAt || Date.now();
  const teamName = teamConfig.name || teamConfig.teamName || 'Unnamed Team';
  const configSnapshot = JSON.stringify(teamConfig);

  // Try to find existing
  const existing = this.stmts.findSession.get(teamName, createdAt);
  if (existing) {
    return existing.id;
  }

  // Insert new
  const result = this.stmts.insertSession.run(
    teamName,
    teamConfig.description,
    teamConfig.leadAgentId,
    createdAt,
    configSnapshot
  );

  // Handle race condition (INSERT OR IGNORE didn't insert)
  if (result.changes === 0) {
    const session = this.stmts.findSession.get(teamName, createdAt);
    return session.id;
  }

  return result.lastInsertRowid;
}
```

**CRITICAL**: Team name comes from `teamConfig.name`, NOT `teamConfig.teamName`.

**Java analogy**: Like Spring's `@Transactional` with `findOrCreate()` pattern.

#### upsertMembers() (lines 193-213)

**Uses transaction** for batch insert:

```javascript
upsertMembers(sessionId, members) {
  const insertMany = this.db.transaction((members) => {
    for (const member of members) {
      this.stmts.insertMember.run(
        sessionId,
        member.agentId,
        member.name,
        member.agentType,
        member.model,
        member.color,
        member.joinedAt || Date.now()
      );
    }
  });

  insertMany(members); // Execute transaction
}
```

**Why transaction?** Ensures all members are inserted atomically (all or nothing).

**Java analogy**: `connection.setAutoCommit(false)` + `connection.commit()`.

#### upsertMessage() (lines 220-237)

```javascript
upsertMessage(sessionId, message) {
  this.stmts.insertMessage.run(
    sessionId,
    message.inboxOwner,
    message.from,
    message.messageType,
    message.rawText,
    message.parsedJson ? JSON.stringify(message.parsedJson) : null,
    message.summary,
    message.color,
    message.isRead ? 1 : 0,
    message.timestamp || new Date().toISOString()
  );
}
```

**INSERT OR IGNORE**: If message already exists (based on UNIQUE constraint), silently skip.

**Boolean to integer**: SQLite stores booleans as 0/1.

#### upsertTask() (lines 244-261)

```javascript
upsertTask(sessionId, task) {
  this.stmts.upsertTask.run(
    sessionId,
    task.taskId,
    task.subject,
    task.description,
    task.activeForm,
    task.status,
    task.owner,
    task.blocks ? JSON.stringify(task.blocks) : null,
    task.blockedBy ? JSON.stringify(task.blockedBy) : null,
    task.isInternal ? 1 : 0
  );
}
```

**INSERT OR REPLACE**: If task exists, replace it (allows status updates).

**Array to JSON**: `blocks` and `blockedBy` are arrays, stored as JSON strings.

#### getSession() (lines 285-339)

**Purpose**: Fetch complete session with all related data.

```javascript
getSession(sessionId) {
  const session = this.stmts.getSession.get(sessionId);
  if (!session) return null;

  // Parse config_snapshot
  session.config = JSON.parse(session.config_snapshot);

  // Fetch members
  session.members = this.stmts.getMembers.all(sessionId);

  // Fetch messages and parse JSON fields
  session.messages = this.stmts.getMessages.all(sessionId).map(msg => {
    if (msg.parsed_json) {
      msg.parsedJson = JSON.parse(msg.parsed_json);
    }
    msg.isRead = Boolean(msg.is_read); // Convert 0/1 to false/true
    return msg;
  });

  // Fetch tasks and parse JSON arrays
  session.tasks = this.stmts.getTasks.all(sessionId).map(task => {
    if (task.blocks) {
      task.blocks = JSON.parse(task.blocks);
    }
    if (task.blocked_by) {
      task.blockedBy = JSON.parse(task.blocked_by);
    }
    task.isInternal = Boolean(task.is_internal);
    return task;
  });

  return session;
}
```

**Field transformation**:
- Snake_case database columns → camelCase JavaScript properties
- JSON strings → parsed objects/arrays
- Integer booleans (0/1) → JavaScript booleans (false/true)

---

### websocket-handler.js (325 lines) - Real-Time Communication

**Location**: `server/lib/websocket-handler.js`

**Role**: Manages WebSocket connections, handles client messages, broadcasts updates.

**Library**: ws (WebSocket server for Node.js)

#### Constructor (lines 8-22)

```javascript
constructor({ wss }) {
  this.wss = wss;                    // WebSocket server instance
  this.clients = new Set();          // Connected clients
  this.getStateFn = null;            // Callback to get state
  this.getHistoryFn = null;          // Callback to get history
  this.getSessionFn = null;          // Callback to get session
  this.heartbeatInterval = null;     // Timer for heartbeat

  this._setupConnectionHandler();
  this._startHeartbeat();
}
```

**Client tracking**: Uses `Set` to track active WebSocket connections.

**Java analogy**: Like `ConcurrentHashMap<String, WebSocket>` for connection pool.

#### init() Dependency Injection (lines 30-34)

```javascript
init(getStateFn, getHistoryFn, getSessionFn) {
  this.getStateFn = getStateFn;
  this.getHistoryFn = getHistoryFn;
  this.getSessionFn = getSessionFn;
}
```

**Called from index.js** (line 40):
```javascript
wsHandler.init(
  (teamName) => aggregator.getState(),
  () => store.listSessions(),
  (sessionId) => store.getSession(sessionId)
);
```

**Why?** Avoids circular dependencies. WebSocketHandler doesn't need to know about DataAggregator or SQLiteStore.

**Java analogy**: Constructor injection or `@Autowired` setter methods.

#### Connection Handler (lines 40-65)

```javascript
_setupConnectionHandler() {
  this.wss.on('connection', (ws) => {
    console.log('New WebSocket client connected');
    this.clients.add(ws);

    // Send full state immediately
    this._sendFullState(ws);

    // Handle incoming messages
    ws.on('message', (message) => {
      this._handleClientMessage(ws, message);
    });

    // Cleanup on disconnect
    ws.on('close', () => {
      this.clients.delete(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket client error:', error.message);
      this.clients.delete(ws);
    });
  });
}
```

**Event handlers**:
- `connection` - New client connects
- `message` - Client sends message
- `close` - Client disconnects
- `error` - Connection error

#### Sending Full State (lines 72-84)

```javascript
_sendFullState(ws, teamName = null) {
  const state = this.getStateFn(teamName);
  this._sendToClient(ws, 'full_state', state);
}

_sendToClient(ws, type, data) {
  if (ws.readyState !== WebSocket.OPEN) return;

  const message = JSON.stringify({
    type,
    data,
    timestamp: Date.now()
  });
  ws.send(message);
}
```

**Message format**:
```json
{
  "type": "full_state",
  "data": { "teams": {...}, "activeTeam": "..." },
  "timestamp": 1770410444201
}
```

#### Handling Client Messages (lines 92-125)

```javascript
_handleClientMessage(ws, message) {
  const parsed = JSON.parse(message.toString());
  const { type } = parsed;

  switch (type) {
    case 'switch_team':
      this._handleSwitchTeam(ws, parsed.teamName);
      break;

    case 'get_history':
      this._handleGetHistory(ws);
      break;

    case 'get_session':
      this._handleGetSession(ws, parsed.sessionId);
      break;

    default:
      console.warn('Unknown message type:', type);
  }
}
```

**Client message types**:
- `switch_team` - Change active team
- `get_history` - Request session history list
- `get_session` - Request specific session details

#### Broadcasting (lines 221-264)

```javascript
broadcast(type, data) {
  const message = JSON.stringify({ type, data, timestamp: Date.now() });

  this.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    } else {
      // Clean up dead connections
      this.clients.delete(client);
    }
  });
}

broadcastTeamUpdate(teamName, changeType, changeData) {
  this.broadcast('team_update', {
    teamName,
    changeType,
    changeData
  });
}
```

**Broadcast to all clients**: Sends message to every connected WebSocket client.

**Called from index.js** (line 76):
```javascript
wsHandler.broadcastTeamUpdate(teamName, 'config', team);
```

#### Heartbeat (lines 285-296)

```javascript
_startHeartbeat() {
  this.heartbeatInterval = setInterval(() => {
    const clientCount = this.getClientCount();
    this.broadcast('heartbeat', { clients: clientCount });
  }, 5000); // Every 5 seconds
}
```

**Purpose**: Keeps WebSocket connections alive and detects disconnected clients.

**Browser behavior**: If heartbeat stops arriving, dashboard shows "disconnected" status dot.

---

### dashboard.html (1838 lines) - Browser UI

**Location**: `server/public/dashboard.html`

**Structure**:
- Lines 1-6: HTML boilerplate
- Lines 7-916: CSS (inline `<style>` tag)
- Lines 918-1064: HTML structure
- Lines 1066-1838: JavaScript (inline `<script>` tag)

#### CSS Architecture (lines 7-916)

**CSS Custom Properties** (lines 9-33):
```css
:root {
  --bg-body: #0f1419;
  --bg-card: #1a1f2e;
  --text-primary: #e6edf3;
  --blue: #3b82f6;
  --green: #10b981;
  /* ... more variables */
}
```

**Why?** Single source of truth for colors/spacing. Change once, applies everywhere.

**Java analogy**: Like constants in a Java class (`public static final String BG_BODY = "#0f1419"`).

**Dark theme**: All colors are dark mode by default.

#### HTML Structure (lines 918-1064)

```html
<div id="app">
  <header>
    <!-- Status dot, team badge, tabs, clock -->
  </header>

  <div id="live-view">
    <aside id="roster">
      <!-- Agent sidebar -->
      <div id="roster-list"></div>
    </aside>

    <main>
      <section id="messages">
        <!-- Messages section -->
        <div class="message-list"></div>
      </section>

      <section id="tasks">
        <!-- Task board (Kanban columns) -->
      </section>
    </main>
  </div>

  <div id="history-view" style="display:none">
    <!-- History tab content -->
  </div>
</div>
```

**Layout**: Two main views (live-view, history-view), toggled with JavaScript.

#### JavaScript Application State (lines 1066-1088)

```javascript
const APP_STATE = {
  ws: null,
  currentTeam: null,
  teams: {},
  reconnectTimer: null,
  selectedSessionId: null
};
```

**Global state object**: Holds WebSocket connection, current team, and all team data.

**Java analogy**: Like a singleton `ApplicationContext` bean.

#### WebSocket Connection (lines 1090-1140)

```javascript
function connectWebSocket() {
  const ws = new WebSocket('ws://localhost:3847');

  ws.onopen = () => {
    console.log('Connected to server');
    updateConnectionStatus(true);
  };

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    handleServerMessage(message);
  };

  ws.onclose = () => {
    console.log('Disconnected');
    updateConnectionStatus(false);
    // Auto-reconnect after 5 seconds
    APP_STATE.reconnectTimer = setTimeout(connectWebSocket, 5000);
  };

  APP_STATE.ws = ws;
}
```

**Auto-reconnect**: If connection drops, retry every 5 seconds.

#### Message Handler (lines 1142-1170)

```javascript
function handleServerMessage(message) {
  const { type, data } = message;

  switch (type) {
    case 'full_state':
      handleFullState(data);
      break;

    case 'team_update':
      handleTeamUpdate(data);
      break;

    case 'heartbeat':
      // Keep-alive, no action needed
      break;

    case 'history':
      handleHistory(data);
      break;

    case 'session':
      handleSession(data);
      break;

    case 'error':
      console.error('Server error:', data.message);
      break;
  }
}
```

#### Rendering Functions (lines 1172-1838)

**Key rendering functions**:

**1. renderRoster()** - Agent sidebar (lines 1200-1250):
```javascript
function renderRoster(team) {
  const members = team.config.members || [];
  const leadAgentId = team.config.leadAgentId;

  const html = members.map(member => {
    const isLead = member.agentId === leadAgentId;
    const initial = (member.name || '?')[0].toUpperCase();

    return `
      <div class="agent-card">
        <div class="agent-avatar" style="background: ${member.color}">
          ${initial}
        </div>
        <div class="agent-info">
          <div class="agent-name-row">
            <div class="agent-name">${member.name}</div>
            ${isLead ? '<span class="lead-badge">LEAD</span>' : ''}
          </div>
          <div class="agent-meta">${member.agentType || 'agent'}</div>
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('roster-list').innerHTML = html;
}
```

**Template literals**: Backticks (`` ` ``) allow multi-line strings with `${variable}` interpolation.

**Java analogy**: Like Thymeleaf or JSP expression language, but in JavaScript.

**2. renderMessages()** - Message cards (lines 1252-1400):
```javascript
function renderMessages(messages) {
  const html = messages.map(msg => {
    const typeClass = msg.messageType || 'text';

    let contentHtml = '';
    if (msg.parsedContent) {
      // Render structured message fields
      contentHtml = renderStructuredMessage(msg.parsedContent);
    } else {
      // Render plain text
      contentHtml = `<div class="msg-text-preview">${msg.text}</div>`;
    }

    return `
      <div class="message-card ${msg.read ? '' : 'unread'}">
        <div class="msg-header">
          <span class="msg-sender-dot" style="background: ${msg.color}"></span>
          <span class="msg-sender">${msg.from}</span>
          <span class="msg-arrow">→</span>
          <span class="msg-recipient">${msg.to}</span>
          <span class="msg-time">${formatTime(msg.timestamp)}</span>
        </div>
        <span class="msg-type-badge ${typeClass}">${typeClass}</span>
        ${contentHtml}
      </div>
    `;
  }).join('');

  document.querySelector('.message-list').innerHTML = html;
}
```

**Structured vs plain text**: If `msg.parsedContent` exists, render specific fields; otherwise show plain text.

**3. renderTaskBoard()** - Kanban columns (lines 1402-1550):
```javascript
function renderTaskBoard(tasks) {
  const taskArray = Object.values(tasks); // Convert object map to array

  const pending = taskArray.filter(t => t.status === 'pending');
  const inProgress = taskArray.filter(t => t.status === 'in_progress');
  const completed = taskArray.filter(t => t.status === 'completed');

  document.getElementById('col-pending').innerHTML = renderTaskColumn(pending);
  document.getElementById('col-in-progress').innerHTML = renderTaskColumn(inProgress);
  document.getElementById('col-completed').innerHTML = renderTaskColumn(completed);
}
```

**CRITICAL**: `Object.values(tasks)` converts from object map to array.

**Why?** DataAggregator stores tasks as `{id: task}`, but rendering needs arrays.

**4. renderHistoryList()** - Session list (lines 1552-1620):
```javascript
function renderHistoryList(sessions) {
  const html = sessions.map(session => {
    const config = JSON.parse(session.config_snapshot);
    const date = new Date(session.created_at);

    return `
      <div class="history-session-card" onclick="loadSessionDetail(${session.id})">
        <div class="session-header">
          <div class="session-team-name">${session.team_name}</div>
          <div class="session-date">${date.toLocaleString()}</div>
        </div>
        <div class="session-description">${config.description || 'No description'}</div>
        <div class="session-meta">
          ${config.members?.length || 0} members
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('history-list').innerHTML = html;
}
```

**5. renderSessionDetail()** - Single session view (lines 1622-1838):
```javascript
function renderSessionDetail(session) {
  // Normalize SQLite column names
  const normalizedMessages = session.messages.map(msg => ({
    from: msg.from_agent,       // Snake_case → camelCase
    to: msg.inbox_owner,
    text: msg.raw_text,
    messageType: msg.message_type,
    parsedContent: msg.parsedJson,
    timestamp: msg.timestamp,
    read: msg.isRead,
    color: msg.color
  }));

  renderMessages(normalizedMessages);
  renderTaskBoard(session.tasks);
}
```

**Column name normalization**: SQLite uses `snake_case`, JavaScript uses `camelCase`.

---

## 3. JSON Data Schemas

### Team Config (`~/.claude/teams/{name}/config.json`)

```json
{
  "name": "team-name",
  "description": "Team description",
  "createdAt": 1770408904514,
  "leadAgentId": "team-lead@team-name",
  "members": [
    {
      "agentId": "team-lead@team-name",
      "name": "team-lead",
      "agentType": "team-lead",
      "model": "claude-opus-4-6",
      "color": "purple",
      "joinedAt": 1770410444201
    },
    {
      "agentId": "agent-1@team-name",
      "name": "agent-1",
      "agentType": "doc-fetcher",
      "model": "claude-opus-4-6",
      "color": "blue",
      "joinedAt": 1770410888935
    }
  ]
}
```

**Key fields**:
- `name` (NOT `teamName`) - Team identifier
- `createdAt` - Unix timestamp in milliseconds
- `leadAgentId` - Full agent ID of team lead
- `members` - Array of agent objects

### Inbox Messages (`~/.claude/teams/{name}/inboxes/{agent}.json`)

**Structure**: Array of message objects.

**Plain text message**:
```json
{
  "from": "sender-agent",
  "text": "Hello world",
  "timestamp": "2026-02-06T20:45:06.115Z",
  "color": "blue",
  "read": true
}
```

**Structured message** (JSON in `text` field):
```json
{
  "from": "team-lead",
  "text": "{\"type\":\"task_assignment\",\"taskId\":\"5\",\"subject\":\"Research frameworks\"}",
  "timestamp": "2026-02-06T20:45:06.115Z",
  "color": "purple",
  "read": false
}
```

**Structured message types**:

1. **task_assignment**:
```json
{
  "type": "task_assignment",
  "taskId": "5",
  "subject": "Research frameworks",
  "description": "Detailed task description"
}
```

2. **shutdown_request**:
```json
{
  "type": "shutdown_request",
  "from": "agent-name",
  "timestamp": "2026-02-06T20:46:32.280Z"
}
```

3. **idle_notification**:
```json
{
  "type": "idle_notification",
  "from": "agent-name",
  "timestamp": "2026-02-06T20:47:03.727Z",
  "idleReason": "available"
}
```

4. **shutdown_approved**:
```json
{
  "type": "shutdown_approved",
  "requestId": "shutdown-1770410864816@agent-name",
  "from": "team-lead",
  "timestamp": "2026-02-06T20:47:47.808Z"
}
```

### Task Files (`~/.claude/tasks/{name}/{id}.json`)

```json
{
  "id": "1",
  "subject": "Research best TA frameworks",
  "description": "Detailed task description...",
  "activeForm": "Researching TA frameworks",
  "status": "completed",
  "owner": "doc-fetcher",
  "blocks": ["2", "3"],
  "blockedBy": ["1"],
  "metadata": {
    "_internal": true
  }
}
```

**Key fields**:
- `id` - Task identifier (matches filename)
- `subject` - Short title
- `status` - One of: `pending`, `in_progress`, `completed`, `deleted`
- `blocks` - Array of task IDs this task blocks
- `blockedBy` - Array of task IDs blocking this task
- `metadata._internal` - If true, flags task as internal (dashboard hides these optionally)

---

## 4. SQLite Schema

### sessions Table

```sql
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_name TEXT NOT NULL,
  description TEXT,
  lead_agent_id TEXT,
  created_at INTEGER NOT NULL,       -- Unix timestamp (milliseconds)
  ended_at INTEGER,                   -- Unix timestamp (when session ended)
  config_snapshot TEXT NOT NULL,      -- Full JSON config
  UNIQUE(team_name, created_at)      -- Prevent duplicate sessions
);
```

**Primary key**: Auto-incrementing integer ID.

**Unique constraint**: `(team_name, created_at)` combination must be unique. This prevents creating duplicate sessions for the same team at the same time.

**Why unique constraint?** Multiple file change events can trigger same session creation. The `INSERT OR IGNORE` + unique constraint makes it idempotent.

**config_snapshot**: Full JSON config stored as TEXT. Parsed when retrieving session.

### session_members Table

```sql
CREATE TABLE session_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER REFERENCES sessions(id),
  agent_id TEXT,
  name TEXT,
  agent_type TEXT,
  model TEXT,
  color TEXT,
  joined_at INTEGER                   -- Unix timestamp
);
```

**Foreign key**: `session_id` references `sessions(id)`.

**No unique constraint**: Allows re-inserting members (uses `INSERT OR IGNORE` based on database behavior).

### session_messages Table

```sql
CREATE TABLE session_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER REFERENCES sessions(id),
  inbox_owner TEXT,                   -- Recipient (inbox filename)
  from_agent TEXT,                    -- Sender
  message_type TEXT,                  -- 'text', 'task_assignment', etc.
  raw_text TEXT,                      -- Original message text
  parsed_json TEXT,                   -- Parsed structured content (if any)
  summary TEXT,
  color TEXT,
  is_read INTEGER DEFAULT 0,          -- Boolean: 0=false, 1=true
  timestamp TEXT,                     -- ISO 8601 string
  UNIQUE(session_id, inbox_owner, from_agent, timestamp)
);
```

**Unique constraint**: `(session_id, inbox_owner, from_agent, timestamp)` prevents duplicate messages.

**Why these 4 columns?** Together they uniquely identify a message:
- Same session
- Same recipient
- Same sender
- Same timestamp

**is_read**: SQLite doesn't have boolean type, uses INTEGER (0/1).

**parsed_json**: If message is structured (has `type` field), stores full parsed JSON.

### session_tasks Table

```sql
CREATE TABLE session_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER REFERENCES sessions(id),
  task_id TEXT,
  subject TEXT,
  description TEXT,
  active_form TEXT,
  status TEXT,                        -- 'pending', 'in_progress', 'completed'
  owner TEXT,
  blocks TEXT,                        -- JSON array: ["2", "3"]
  blocked_by TEXT,                    -- JSON array: ["1"]
  is_internal INTEGER DEFAULT 0,
  UNIQUE(session_id, task_id)        -- One task per session
);
```

**Unique constraint**: `(session_id, task_id)` allows `INSERT OR REPLACE` for task updates.

**JSON arrays**: `blocks` and `blocked_by` stored as JSON TEXT, parsed on retrieval.

---

## 5. WebSocket Protocol

### Server → Client Messages

All messages have this structure:
```json
{
  "type": "message_type",
  "data": { /* payload */ },
  "timestamp": 1770410444201
}
```

#### 1. full_state (sent on connect)

**When**: Client connects or sends `switch_team` message.

**Payload**:
```json
{
  "type": "full_state",
  "data": {
    "teams": {
      "team-name": {
        "config": { /* team config */ },
        "inboxes": {
          "agent-1": [ /* messages */ ],
          "agent-2": [ /* messages */ ]
        },
        "tasks": {
          "1": { /* task object */ },
          "2": { /* task object */ }
        }
      }
    },
    "activeTeam": "team-name",
    "teamNames": ["team-name", "other-team"]
  },
  "timestamp": 1770410444201
}
```

#### 2. team_update (incremental update)

**When**: File changes detected (config, inbox, or task).

**Payload**:
```json
{
  "type": "team_update",
  "data": {
    "teamName": "team-name",
    "changeType": "config",          // or "inbox" or "task"
    "changeData": {
      /* Updated data specific to change type */
    }
  },
  "timestamp": 1770410444201
}
```

**changeType values**:
- `"config"` - Team configuration changed
- `"inbox"` - Inbox file changed
- `"task"` - Task file changed

**changeData for "config"**:
```json
{
  "config": { /* full config */ },
  "inboxes": { /* all inboxes */ },
  "tasks": { /* all tasks */ }
}
```

**changeData for "inbox"**:
```json
{
  "agentName": "agent-1",
  "messages": [ /* all messages chronologically */ ]
}
```

**changeData for "task"**:
```json
{
  "taskId": "5",
  "tasks": { /* all tasks */ }
}
```

#### 3. heartbeat (keep-alive)

**When**: Every 5 seconds.

**Payload**:
```json
{
  "type": "heartbeat",
  "data": {
    "clients": 2                     // Number of connected clients
  },
  "timestamp": 1770410444201
}
```

#### 4. history (session list)

**When**: Client sends `get_history` message.

**Payload**:
```json
{
  "type": "history",
  "data": [
    {
      "id": 1,
      "team_name": "team-name",
      "description": "Team description",
      "created_at": 1770410444201,
      "config_snapshot": "{ /* JSON string */ }"
    }
  ],
  "timestamp": 1770410444201
}
```

#### 5. session (single session detail)

**When**: Client sends `get_session` message.

**Payload**:
```json
{
  "type": "session",
  "data": {
    "id": 1,
    "team_name": "team-name",
    "created_at": 1770410444201,
    "config": { /* parsed config */ },
    "members": [ /* member objects */ ],
    "messages": [ /* message objects */ ],
    "tasks": [ /* task objects */ ]
  },
  "timestamp": 1770410444201
}
```

#### 6. error (error message)

**When**: Server encounters an error processing client request.

**Payload**:
```json
{
  "type": "error",
  "data": {
    "message": "Failed to retrieve session",
    "error": "Session not found"
  },
  "timestamp": 1770410444201
}
```

### Client → Server Messages

#### 1. switch_team

**Purpose**: Change active team.

**Format**:
```json
{
  "type": "switch_team",
  "teamName": "team-name"
}
```

**Response**: Server sends `full_state` with filtered data for that team.

#### 2. get_history

**Purpose**: Request list of all sessions.

**Format**:
```json
{
  "type": "get_history"
}
```

**Response**: Server sends `history` message with session list.

#### 3. get_session

**Purpose**: Request specific session details.

**Format**:
```json
{
  "type": "get_session",
  "sessionId": 5
}
```

**Response**: Server sends `session` message with full session data.

---

## 6. How to Add a New Feature

### Example 1: Adding a New Message Type

Let's add support for a new message type: `agent_error`.

**Step 1**: No changes needed in `data-aggregator.js`

The type is auto-detected from `JSON.parse(msg.text).type`. No code changes required.

**Step 2**: Add CSS badge color in `dashboard.html`

Find the message type badges (around line 466):

```css
.msg-type-badge.task_assignment { background: rgba(59,130,246,0.15); color: var(--blue); }
.msg-type-badge.shutdown_request { background: rgba(249,115,22,0.15); color: var(--orange); }
/* ADD THIS: */
.msg-type-badge.agent_error { background: rgba(239,68,68,0.15); color: var(--red); }
```

**Step 3**: Add rendering logic in `dashboard.html`

Find `renderStructuredMessage()` function (around line 1320):

```javascript
function renderStructuredMessage(parsed) {
  switch (parsed.type) {
    case 'task_assignment':
      return `<div class="msg-fields">
        <div class="msg-field">
          <span class="msg-field-label">Task ID:</span>
          <span class="msg-field-value">${parsed.taskId}</span>
        </div>
      </div>`;

    // ADD THIS:
    case 'agent_error':
      return `<div class="msg-fields">
        <div class="msg-field">
          <span class="msg-field-label">Error:</span>
          <span class="msg-field-value">${parsed.errorMessage}</span>
        </div>
        <div class="msg-field">
          <span class="msg-field-label">Stack:</span>
          <span class="msg-field-value"><pre>${parsed.stack}</pre></span>
        </div>
      </div>`;

    default:
      return `<pre>${JSON.stringify(parsed, null, 2)}</pre>`;
  }
}
```

**Step 4**: Test it

Create a test inbox message:
```json
{
  "from": "agent-1",
  "text": "{\"type\":\"agent_error\",\"errorMessage\":\"Failed to read file\",\"stack\":\"Error: ENOENT\\n  at...\"}",
  "timestamp": "2026-02-06T20:45:06.115Z",
  "color": "red",
  "read": false
}
```

**That's it!** No changes to SQLite schema or WebSocketHandler needed.

### Example 2: Adding a New Dashboard Panel

Let's add a "Statistics" panel showing message counts by type.

**Step 1**: Add HTML in `dashboard.html`

Find the messages section (around line 930) and add:

```html
<section id="statistics">
  <div class="section-header">
    <div class="section-title">STATISTICS</div>
  </div>
  <div id="stats-content" class="stats-grid">
    <!-- Will be filled by JavaScript -->
  </div>
</section>
```

**Step 2**: Add CSS styles

Find the styles section (around line 500) and add:

```css
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  padding: 16px;
}

.stat-card {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  padding: 16px;
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
  color: var(--blue);
}

.stat-label {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}
```

**Step 3**: Add rendering function

In the JavaScript section (around line 1400):

```javascript
function renderStatistics(messages) {
  // Count messages by type
  const counts = {};
  messages.forEach(msg => {
    const type = msg.messageType || 'text';
    counts[type] = (counts[type] || 0) + 1;
  });

  // Generate HTML
  const html = Object.entries(counts).map(([type, count]) => `
    <div class="stat-card">
      <div class="stat-value">${count}</div>
      <div class="stat-label">${type.replace('_', ' ')}</div>
    </div>
  `).join('');

  document.getElementById('stats-content').innerHTML = html;
}
```

**Step 4**: Call rendering function

Find `handleFullState()` and `handleTeamUpdate()` functions (around line 1200) and add:

```javascript
function handleFullState(data) {
  // ... existing code ...
  renderMessages(messages);
  renderStatistics(messages); // ADD THIS LINE
  renderTaskBoard(team.tasks);
}

function handleTeamUpdate(data) {
  // ... existing code ...
  if (data.changeType === 'inbox') {
    renderMessages(data.changeData.messages);
    renderStatistics(data.changeData.messages); // ADD THIS LINE
  }
}
```

**Step 5**: Test it

Refresh browser. Statistics panel should appear showing message counts.

### Example 3: Adding a New REST API Endpoint

Let's add an endpoint to get tasks for a specific team.

**Step 1**: Add route in `index.js`

Find the REST API section (around line 138) and add:

```javascript
app.get('/api/teams/:teamName/tasks', (req, res) => {
  try {
    const { teamName } = req.params;
    const state = aggregator.getState();
    const team = state.teams[teamName];

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    res.json(team.tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

**Step 2**: Test it

```bash
curl http://localhost:3847/api/teams/snappy-seeking-candy/tasks
```

**Response**:
```json
{
  "1": { "id": "1", "subject": "Research frameworks", "status": "completed" },
  "2": { "id": "2", "subject": "Write documentation", "status": "in_progress" }
}
```

---

## 7. How to Debug

### Server-Side Debugging

#### Console Output

All important events are logged to console:

```
Agent Surveillance Dashboard
Teams dir: C:\Users\simon\.claude\teams
Tasks dir: C:\Users\simon\.claude\tasks
Watching directories: [ ... ]
FileWatcher started successfully
Dashboard running at http://localhost:3847
New WebSocket client connected
```

**Add your own logs**:
```javascript
console.log('Processing file:', filePath);
console.log('Team state:', JSON.stringify(team, null, 2));
```

#### SQLite Database Inspection

**Location**: `server/data/surveillance.db`

**Tools**:
- DB Browser for SQLite (https://sqlitebrowser.org/)
- SQLite CLI: `sqlite3 server/data/surveillance.db`

**Useful queries**:
```sql
-- List all sessions
SELECT id, team_name, created_at FROM sessions;

-- Count messages per session
SELECT session_id, COUNT(*) FROM session_messages GROUP BY session_id;

-- View recent messages
SELECT from_agent, inbox_owner, message_type, timestamp
FROM session_messages
ORDER BY timestamp DESC
LIMIT 10;
```

#### Node.js Debugging

**Enable HTTP debugging**:
```bash
NODE_DEBUG=http node index.js
```

**Use Chrome DevTools**:
```bash
node --inspect index.js
```

Then open `chrome://inspect` in Chrome.

**Breakpoints in VS Code**:

Create `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Launch Server",
      "program": "${workspaceFolder}/server/index.js",
      "env": {
        "SURVEIL_TEAMS_DIR": "docs/teams",
        "SURVEIL_TASKS_DIR": "docs/tasks"
      }
    }
  ]
}
```

Press F5 to start debugging with breakpoints.

### Client-Side Debugging

#### Browser DevTools

Press **F12** to open DevTools.

**Console tab**:
```javascript
// View current state
console.log(APP_STATE);

// View team data
console.log(APP_STATE.teams);

// Send test message
APP_STATE.ws.send(JSON.stringify({ type: 'get_history' }));
```

**Network tab**:
- Click "WS" filter to see WebSocket frames
- Click connection to see all messages sent/received

**Elements tab**:
- Inspect DOM structure
- Check applied CSS styles
- Modify styles in real-time

#### WebSocket Message Logging

Add logging to `handleServerMessage()` in dashboard.html:

```javascript
function handleServerMessage(message) {
  console.log('Received:', message.type, message.data); // ADD THIS

  const { type, data } = message;
  // ... rest of function
}
```

#### Simulating WebSocket Disconnect

In browser console:
```javascript
APP_STATE.ws.close();
```

Watch auto-reconnect behavior (should reconnect after 5 seconds).

---

## 8. Common Pitfalls and Gotchas

### 1. Chokidar v4 Glob Patterns

**PROBLEM**: Glob patterns don't trigger change events in chokidar v4.

**WRONG**:
```javascript
chokidar.watch(`${teamsDir}/**/*.json`, { /* ... */ });
```

**This will watch the files initially, but WILL NOT fire `change` events.**

**CORRECT**:
```javascript
chokidar.watch(teamsDir, { /* ... */ });
```

**Why?** Chokidar v4 has breaking changes from v3. Glob patterns only work for initial scan, not ongoing watching. You must watch DIRECTORIES, then filter by file extension in your event handler.

### 2. config.name vs config.teamName

**PROBLEM**: Team name field is `name`, not `teamName`.

**WRONG**:
```javascript
const teamName = teamConfig.teamName; // undefined!
```

**CORRECT**:
```javascript
const teamName = teamConfig.name;
```

**Check the JSON**:
```json
{
  "name": "snappy-seeking-candy",  // ← Use this
  "teamName": undefined             // ← This doesn't exist
}
```

### 3. Tasks as Objects vs Arrays

**PROBLEM**: DataAggregator stores tasks as object maps, but dashboard rendering expects arrays.

**DataAggregator storage**:
```javascript
this.state.teams[teamName].tasks = {
  '1': { id: '1', subject: '...' },
  '2': { id: '2', subject: '...' }
};
```

**Dashboard usage**:
```javascript
// WRONG
tasks.forEach(task => { ... }); // Error: tasks.forEach is not a function

// CORRECT
Object.values(tasks).forEach(task => { ... });
```

**Why?** Object maps allow O(1) lookups by task ID (`tasks[taskId]`), but arrays are easier for rendering.

### 4. SQLite Column Names (snake_case vs camelCase)

**PROBLEM**: SQLite uses snake_case, JavaScript uses camelCase.

**SQLite columns**:
```
inbox_owner, from_agent, message_type, is_read
```

**JavaScript properties**:
```
inboxOwner, from, messageType, isRead
```

**When querying SQLite**, column names are snake_case:
```javascript
const msg = db.prepare('SELECT * FROM session_messages').get();
console.log(msg.inbox_owner);  // ← snake_case
console.log(msg.from_agent);   // ← snake_case
```

**Must normalize** before passing to dashboard:
```javascript
const normalized = {
  to: msg.inbox_owner,
  from: msg.from_agent,
  messageType: msg.message_type,
  isRead: Boolean(msg.is_read)
};
```

### 5. Windows Path Separators

**PROBLEM**: Windows uses backslashes (`\`), Unix uses forward slashes (`/`).

**File path on Windows**:
```
C:\Users\simon\.claude\teams\my-team\config.json
```

**After normalization**:
```
C:/Users/simon/.claude/teams/my-team/config.json
```

**ALWAYS normalize** before string operations:
```javascript
_normalizePath(filePath) {
  return filePath.split(path.sep).join('/');
}
```

**Why?** String matching like `filePath.includes('inboxes')` works consistently.

### 6. better-sqlite3 is Synchronous

**PROBLEM**: better-sqlite3 doesn't return promises.

**WRONG**:
```javascript
const session = await this.stmts.getSession.get(sessionId); // DON'T
```

**CORRECT**:
```javascript
const session = this.stmts.getSession.get(sessionId); // Synchronous
```

**Why?** better-sqlite3 uses synchronous C bindings for maximum performance. It blocks the thread until complete, like JDBC.

**If you need async**, use the standard `sqlite3` library (different package), but it's slower.

### 7. WebSocket Port Must Match HTTP Port

**PROBLEM**: WebSocket and HTTP server share the same port.

**WRONG**:
```javascript
const server = http.createServer(app);
server.listen(3847);

const wss = new WebSocketServer({ port: 3848 }); // Different port!
```

**CORRECT**:
```javascript
const server = http.createServer(app);
const wss = new WebSocketServer({ server }); // Share server

server.listen(3847);
```

**Why?** WebSocket connections upgrade from HTTP. If you specify a different port, clients connecting to `ws://localhost:3847` will fail.

### 8. File Change Debouncing

**PROBLEM**: Windows fires multiple events for single file change.

**Example**: Saving a file can trigger:
1. `change` event (file opened for writing)
2. `change` event (content written)
3. `change` event (file closed)

**Solution**: Debounce by 100ms (lines 224-243 in file-watcher.js):

```javascript
_handleFileChange(filePath) {
  // Clear existing timer
  if (this.debounceTimers.has(filePath)) {
    clearTimeout(this.debounceTimers.get(filePath));
  }

  // Set new timer
  const timer = setTimeout(() => {
    this.debounceTimers.delete(filePath);
    this._processFileChange(filePath);
  }, 100);

  this.debounceTimers.set(filePath, timer);
}
```

**Result**: Only processes file after 100ms of inactivity.

---

## 9. Testing with Test Data

### Test Data Location

**Root directory**: `docs/` (NOT `surveil/docs/`)

**Structure**:
```
docs/
  teams/
    snappy-seeking-candy/     - Full test team (2 members, 6 tasks)
      config.json
      inboxes/
        team-lead.json
        arch-researcher-v2.json
    ta-research/              - Research team
    auth-implementation/      - Auth team
    ta-docs/                  - Documentation team
  tasks/
    snappy-seeking-candy/
      1.json
      2.json
      3.json
      ...
    ta-research/
    auth-implementation/
    ta-docs/
```

### Running with Test Data

**Windows PowerShell**:
```powershell
cd C:\Users\simon\Downloads\claude_code_agent_team_mark_kashef
$env:SURVEIL_TEAMS_DIR="docs/teams"
$env:SURVEIL_TASKS_DIR="docs/tasks"
node surveil/server/index.js
```

**Windows CMD**:
```cmd
cd C:\Users\simon\Downloads\claude_code_agent_team_mark_kashef
set SURVEIL_TEAMS_DIR=docs/teams
set SURVEIL_TASKS_DIR=docs/tasks
node surveil/server/index.js
```

**Unix/Mac/Linux**:
```bash
cd /path/to/claude_code_agent_team_mark_kashef
SURVEIL_TEAMS_DIR=docs/teams SURVEIL_TASKS_DIR=docs/tasks node surveil/server/index.js
```

### Test Data Contents

#### snappy-seeking-candy (Primary Test Team)

**Members**: 2 agents
- `team-lead` (purple, team-lead type)
- `arch-researcher-v2` (purple, doc-fetcher type)

**Messages**: 25+ messages across 2 inboxes
- Plain text messages
- Structured messages (task_assignment, idle_notification, shutdown_approved)
- Message from deleted agents (framework-researcher, components-researcher, architecture-researcher)

**Tasks**: 6 tasks (1.json through 6.json)
- Task 1: "Research best TA frameworks" (completed)
- Task 2: "Research world-class TA components" (completed)
- Task 3: "Research architecture patterns" (completed)
- Task 4: Planning task (pending)
- Task 5: Implementation task (in_progress)
- Task 6: Testing task (pending)

#### Other Test Teams

**ta-research**: Research team with 1 member, 4 tasks

**auth-implementation**: Auth team data

**ta-docs**: Documentation team data

### Adding Your Own Test Data

**Step 1**: Create team directory
```bash
mkdir docs/teams/my-test-team
mkdir docs/teams/my-test-team/inboxes
mkdir docs/tasks/my-test-team
```

**Step 2**: Create config.json
```json
{
  "name": "my-test-team",
  "description": "My test team",
  "createdAt": 1770410444201,
  "leadAgentId": "lead@my-test-team",
  "members": [
    {
      "agentId": "lead@my-test-team",
      "name": "lead",
      "agentType": "team-lead",
      "model": "claude-opus-4-6",
      "color": "purple",
      "joinedAt": 1770410444201
    }
  ]
}
```

**Step 3**: Create inbox file
```bash
echo '[]' > docs/teams/my-test-team/inboxes/lead.json
```

**Step 4**: Create task file
```json
{
  "id": "1",
  "subject": "Test task",
  "status": "pending",
  "owner": "lead",
  "blocks": [],
  "blockedBy": []
}
```

**Step 5**: Run server and verify

Open `http://localhost:3847` - your team should appear in the selector.

---

## 10. Dependency Reference

### express (v4.21.0)

**What it does**: HTTP web server framework.

**Why we chose it**: Industry standard for Node.js web servers. Simple API, massive ecosystem, battle-tested.

**C/C++ analogy**: Like embedding an HTTP server (libmicrohttpd, Mongoose) in your C++ application.

**Java analogy**: Like Spring Boot's embedded Tomcat, but much lighter weight.

**Key APIs used**:

```javascript
const app = express();

// Serve static files from directory
app.use(express.static(path.join(__dirname, 'public')));

// Define route
app.get('/api/sessions', (req, res) => {
  res.json({ data: 'hello' });
});

// Start server
const server = http.createServer(app);
server.listen(3847);
```

**Routes in this project**:
- `GET /` - Serves dashboard.html
- `GET /api/sessions` - List all sessions
- `GET /api/sessions/:id` - Get specific session

**Middleware**: None used (vanilla Express).

**Version constraints**: Requires v4.x. v5 is in beta, don't upgrade yet.

**Upgrade considerations**: Express 5 has breaking changes. Stay on v4 until v5 is stable (2026+).

### ws (v8.18.0)

**What it does**: WebSocket server for Node.js.

**Why we chose it**: Fastest and most popular WebSocket library. No dependencies, battle-tested.

**C/C++ analogy**: Like using libwebsockets for WebSocket server in C++.

**Java analogy**: Like Java WebSocket API (`javax.websocket.server.ServerEndpoint`).

**Key APIs used**:

```javascript
const { WebSocketServer } = require('ws');

// Create server (shares HTTP server)
const wss = new WebSocketServer({ server });

// Handle connections
wss.on('connection', (ws) => {
  console.log('Client connected');

  // Send message to client
  ws.send(JSON.stringify({ type: 'hello', data: 'world' }));

  // Receive message from client
  ws.on('message', (message) => {
    const parsed = JSON.parse(message.toString());
    console.log('Received:', parsed);
  });

  // Handle disconnect
  ws.on('close', () => {
    console.log('Client disconnected');
  });
});
```

**Broadcast to all clients**:
```javascript
wss.clients.forEach((client) => {
  if (client.readyState === WebSocket.OPEN) {
    client.send(message);
  }
});
```

**Connection state**: `WebSocket.OPEN`, `WebSocket.CLOSED`, `WebSocket.CONNECTING`, `WebSocket.CLOSING`.

**Version constraints**: Requires v8.x. v9 requires Node.js 18+.

**Upgrade considerations**: ws v9 drops support for Node.js 16. Check Node.js version before upgrading.

**Alternative libraries**: socket.io (more features but heavier), uWebSockets.js (fastest but C++ bindings).

### better-sqlite3 (v11.7.0)

**What it does**: Synchronous SQLite database binding for Node.js.

**Why we chose it**:
- **Synchronous API** (simpler code, no async/await)
- **Fast** (C++ bindings, faster than async `sqlite3` package)
- **Prepared statements** (like JDBC)
- **Transactions** (ACID guarantees)

**C/C++ analogy**: Direct SQLite C API bindings (`sqlite3_prepare_v2`, `sqlite3_step`, `sqlite3_column_text`).

**Java analogy**: JDBC with PreparedStatements. Almost identical API patterns.

**Key APIs used**:

```javascript
const Database = require('better-sqlite3');

// Open database
const db = new Database('surveillance.db');

// Set WAL mode for concurrency
db.pragma('journal_mode = WAL');

// Create table
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    name TEXT
  )
`);

// Prepare statement
const insert = db.prepare('INSERT INTO users (name) VALUES (?)');

// Execute statement (synchronous!)
const result = insert.run('Alice');
console.log(result.lastInsertRowid); // 1

// Query single row
const select = db.prepare('SELECT * FROM users WHERE id = ?');
const user = select.get(1);
console.log(user.name); // Alice

// Query multiple rows
const all = db.prepare('SELECT * FROM users').all();
console.log(all.length); // 1

// Transaction
const insertMany = db.transaction((users) => {
  for (const user of users) {
    insert.run(user.name);
  }
});

insertMany([{ name: 'Bob' }, { name: 'Carol' }]);

// Close connection
db.close();
```

**Methods**:
- `.prepare(sql)` - Prepare statement (returns statement object)
- `stmt.run(...params)` - Execute without returning rows (returns `{changes, lastInsertRowid}`)
- `stmt.get(...params)` - Return single row (returns object or undefined)
- `stmt.all(...params)` - Return all rows (returns array)
- `.exec(sql)` - Execute multiple statements (no params, no return)
- `.transaction(fn)` - Create transaction function

**Pragmas** (SQLite settings):
```javascript
db.pragma('journal_mode = WAL');    // Write-Ahead Logging
db.pragma('synchronous = NORMAL');  // Faster writes (less durable)
db.pragma('cache_size = 10000');    // More memory cache
```

**Version constraints**: Requires native build tools.

**Installation requirements**:
- **Windows**: windows-build-tools (`npm install -g windows-build-tools`)
- **Mac**: Xcode Command Line Tools (`xcode-select --install`)
- **Linux**: build-essential + python3 (`apt-get install build-essential python3`)

**Upgrade considerations**:
- v12 will drop Node.js 16 support
- Always rebuild after Node.js version upgrade: `npm rebuild better-sqlite3`

**Alternative libraries**:
- `sqlite3` (async, slower but works everywhere)
- `node-sqlite3-wasm` (WebAssembly, no native build needed)

### chokidar (v4.0.0)

**What it does**: File system watcher (cross-platform).

**Why we chose it**:
- Works consistently on Windows, Mac, Linux
- Handles edge cases (rapid changes, renames, symlinks)
- Used by webpack, vite, parcel (battle-tested)

**C/C++ analogy**: Wraps platform-specific APIs (`inotify` on Linux, `FSEvents` on Mac, `ReadDirectoryChangesW` on Windows).

**Java analogy**: Java 7 `WatchService` API, but cross-platform and more reliable.

**Key APIs used**:

```javascript
const chokidar = require('chokidar');

// Watch directory
const watcher = chokidar.watch('/path/to/dir', {
  persistent: true,        // Keep process running
  ignoreInitial: false,    // Fire events for existing files
  depth: 10                // Max recursion depth
});

// File added
watcher.on('add', (filePath) => {
  console.log('Added:', filePath);
});

// File changed
watcher.on('change', (filePath) => {
  console.log('Changed:', filePath);
});

// File removed
watcher.on('unlink', (filePath) => {
  console.log('Removed:', filePath);
});

// Directory added
watcher.on('addDir', (dirPath) => {
  console.log('Directory added:', dirPath);
});

// Ready (initial scan complete)
watcher.on('ready', () => {
  console.log('Ready');
});

// Error
watcher.on('error', (error) => {
  console.error('Error:', error);
});

// Stop watching
await watcher.close();
```

**Options**:
- `persistent` - Keep process running (default: true)
- `ignoreInitial` - Don't fire events for existing files (default: false)
- `depth` - Max recursion depth (default: unlimited)
- `awaitWriteFinish` - Wait for file writes to complete (removed in v4!)
- `usePolling` - Use polling instead of native events (removed in v4!)

**Chokidar v4 Breaking Changes**:

1. **Glob patterns don't work for change events**:
```javascript
// DON'T DO THIS:
chokidar.watch('**/*.json'); // Won't fire change events!

// DO THIS INSTEAD:
chokidar.watch('.'); // Watch directory, filter in code
```

2. **`usePolling` removed**: Now auto-detected based on filesystem.

3. **`awaitWriteFinish` removed**: Replaced with `stabilityThreshold` (default 100ms).

**Version constraints**: v4.x is current. v3.x is legacy (different API).

**Upgrade considerations**: If upgrading from v3 to v4:
- Remove `usePolling` option
- Change glob patterns to directory paths
- Replace `awaitWriteFinish` with `stabilityThreshold`

**Alternative libraries**:
- `fs.watch()` (Node.js built-in, unreliable)
- `node-watch` (simpler, less features)
- `gaze` (legacy, unmaintained)

---

## Summary

You now have a complete understanding of the Agent Team Surveillance Dashboard codebase:

**Architecture**:
- FileWatcher → DataAggregator → SQLiteStore + WebSocketHandler → Browser
- EventEmitter pattern for component communication
- Synchronous SQLite, asynchronous file I/O
- Single HTML file with inline CSS/JS (no build step)

**Key Files**:
- `index.js` (200 lines) - Application entry point
- `file-watcher.js` (430 lines) - File system monitor
- `data-aggregator.js` (170 lines) - In-memory state manager
- `sqlite-store.js` (350 lines) - Database persistence
- `websocket-handler.js` (325 lines) - Real-time communication
- `dashboard.html` (1838 lines) - Browser UI

**Data Flow**:
1. JSON files change on disk
2. chokidar detects change
3. FileWatcher emits event
4. DataAggregator updates state
5. SQLiteStore persists to database
6. WebSocketHandler broadcasts to browsers
7. Dashboard renders new data

**Common Pitfalls**:
- Chokidar v4 glob patterns don't work
- `config.name` not `config.teamName`
- Tasks are objects not arrays
- better-sqlite3 is synchronous
- Path normalization for Windows
- WebSocket shares HTTP port

**Next Steps**:
1. Run with test data: `SURVEIL_TEAMS_DIR=docs/teams node index.js`
2. Open `http://localhost:3847`
3. Make changes to test JSON files and watch dashboard update
4. Try adding a new message type (see section 6)
5. Experiment with SQLite queries (section 7)

**Questions?** Re-read relevant sections. Everything is explained from first principles.
