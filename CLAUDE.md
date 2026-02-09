# Agent Team Surveillance Dashboard

## Project Overview

Real-time web dashboard that monitors Claude Code agent team activity by watching JSON files in `~/.claude/teams/` and `~/.claude/tasks/`. Displays team members, message flows, and task assignments in a live browser interface.

**Tech Stack**: Node.js backend with Express 4.x, ws 8.x, better-sqlite3 11.x, chokidar 4.x. Single-file HTML dashboard with inline CSS+JS (no build tools, no frontend framework).

## Architecture

**Pattern**: EventEmitter pipeline for real-time file monitoring and state propagation.

```
FileWatcher (chokidar)
    ↓ emits 'fileChange'
DataAggregator (JSON parser + state manager)
    ↓ emits 'teamUpdate'
SQLiteStore (persistence) + WebSocketHandler (broadcast)
    ↓
Browser Clients (dashboard.html)
```

**Flow**:
1. FileWatcher detects JSON file changes in teams/tasks directories
2. DataAggregator parses JSON into unified in-memory state
3. SQLiteStore persists session history to database
4. WebSocketHandler broadcasts updates to connected browser clients
5. Express serves static HTML and REST API

## File Structure

```
surveil/
  SKILL.md              - Claude Code skill definition
  CLAUDE.md             - This file (project context for Claude Code)
  server/
    package.json        - 4 dependencies: express, ws, better-sqlite3, chokidar
    index.js            - Main entry point, wires all components (~200 lines)
    lib/
      file-watcher.js   - chokidar watcher, EventEmitter (~430 lines)
      data-aggregator.js - JSON parser, state manager (~170 lines)
      sqlite-store.js   - SQLite persistence with WAL mode (~350 lines)
      websocket-handler.js - WebSocket broadcast + heartbeat (~325 lines)
    public/
      dashboard.html    - Complete self-contained UI (~1838 lines)
    data/
      surveillance.db   - Runtime SQLite database (generated)
```

## Running the Project

**Install dependencies**:
```bash
cd surveil/server
npm install
```

**Production mode** (monitors real ~/.claude/ directories):
```bash
node index.js
```

**Development mode** (uses test data in docs/):
```bash
# Unix/Mac/Linux
SURVEIL_TEAMS_DIR=docs/teams SURVEIL_TASKS_DIR=docs/tasks node surveil/server/index.js

# Windows PowerShell
$env:SURVEIL_TEAMS_DIR="docs/teams"; $env:SURVEIL_TASKS_DIR="docs/tasks"; node surveil/server/index.js

# Windows CMD
set SURVEIL_TEAMS_DIR=docs/teams && set SURVEIL_TASKS_DIR=docs/tasks && node surveil/server/index.js
```

**Access dashboard**: Open `http://localhost:3847` in browser

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SURVEIL_PORT` | 3847 | HTTP server port |
| `SURVEIL_TEAMS_DIR` | ~/.claude/teams/ | Teams directory to monitor |
| `SURVEIL_TASKS_DIR` | ~/.claude/tasks/ | Tasks directory to monitor |

## Key Technical Details

### Chokidar v4 Breaking Changes

**CRITICAL**: Chokidar v4 has breaking changes from v3:
- **Glob patterns do NOT trigger change events** - must watch DIRECTORIES, not glob patterns
- `usePolling` option removed (now auto-detected)
- `awaitWriteFinish` option removed (replaced with `stabilityThreshold`)

**Correct usage**:
```javascript
// ✓ CORRECT - watch directory
chokidar.watch(teamsDir, { ignoreInitial: false })

// ✗ WRONG - glob patterns don't work
chokidar.watch(`${teamsDir}/**/*.json`) // Will not fire events!
```

### Team Configuration

Team name is in `config.name` NOT `config.teamName`:
```javascript
// ✓ CORRECT
const teamName = teamConfig.config.name;

// ✗ WRONG
const teamName = teamConfig.config.teamName; // Undefined!
```

### Data Structure Gotchas

**Tasks from DataAggregator**: Stored as object map `{taskId: taskObject}`, not array. Dashboard converts with `Object.values()`:
```javascript
// DataAggregator storage
this.currentState.tasks = { 'task-123': {...}, 'task-456': {...} };

// Dashboard usage
const taskArray = Object.values(data.tasks);
```

**Message types**: Detected by parsing `message.text` as JSON:
- `task_assignment` - Task assignment messages
- `shutdown_request` - Agent requesting shutdown
- `idle_notification` - Agent reporting idle state
- `shutdown_approved` - Coordinator approving shutdown

### File Watching Details

- Debounce: 100ms to handle Windows double-fire events
- Initial scan: Loads all existing files on startup
- Path normalization: All paths converted to forward slashes for cross-platform compatibility
- Filters: Only processes `.json` files, ignores non-JSON

### SQLite Configuration

- **Mode**: WAL (Write-Ahead Logging) for concurrent read access
- **Synchronous**: Uses better-sqlite3 synchronous API (no async/await)
- **Schema**:
  - `sessions` - UNIQUE constraint on (team_name, created_at)
  - `session_members` - Links sessions to agent names
  - `session_messages` - UNIQUE constraint on (session_id, inbox_owner, from_agent, timestamp)
  - `session_tasks` - UNIQUE constraint on (session_id, task_id)

### WebSocket Protocol

**Server → Client messages**:
- `full_state` - Complete current state (on connect)
- `team_update` - Incremental team state update
- `heartbeat` - Keep-alive ping
- `history` - Session history list
- `session` - Single session detail
- `error` - Error message

**Client → Server messages**:
- `switch_team` - Change active team (payload: `{team}`)
- `get_history` - Request session history
- `get_session` - Request session detail (payload: `{sessionId}`)

**Browser behavior**: Auto-reconnect every 5 seconds on disconnect

### REST API Endpoints

- `GET /api/sessions` - List all sessions with basic info
- `GET /api/sessions/:id` - Get full session with members, messages, tasks
- `GET /` - Serves dashboard.html

## Test Data

Located in `docs/teams/` and `docs/tasks/`:
- **snappy-seeking-candy** - Full test team (2 members, 6 inboxes, 6 tasks)
- **ta-research** - Research team test data
- **auth-implementation** - Auth team test data
- **ta-docs** - Documentation team test data

## Common Issues

### Port Already in Use
```bash
# Change port
SURVEIL_PORT=3848 node index.js
```

### better-sqlite3 Installation Fails
Requires native build tools:
- **Windows**: Install windows-build-tools (`npm install -g windows-build-tools`)
- **Mac**: Install Xcode Command Line Tools (`xcode-select --install`)
- **Linux**: Install build-essential and Python (`apt-get install build-essential python3`)

### Chokidar Not Detecting Changes
- **Problem**: Using glob patterns instead of directory paths
- **Solution**: Watch directories only, filter by extension in code

### Team Name Showing as "Unknown"
- **Problem**: Using `config.teamName` instead of `config.name`
- **Solution**: Access team name via `teamConfig.config.name`

### Windows Environment Variables Not Working
- **PowerShell**: Use `$env:VAR="value"` syntax
- **CMD**: Use `set VAR=value &&` syntax (no spaces around =)

## Code Style Conventions

- **Module system**: CommonJS (`require()`, `module.exports`) - NO ES modules
- **No TypeScript**: Pure JavaScript
- **Documentation**: JSDoc comments for all public methods
- **Database**: Synchronous better-sqlite3 API (no async/await for DB calls)
- **Event handling**: EventEmitter pattern for internal communication
- **Error handling**: Try-catch blocks with error logging
- **Path handling**: Always normalize to forward slashes for cross-platform

## Frontend Notes

**dashboard.html is completely self-contained**:
- All CSS inlined in `<style>` tag
- All JavaScript inlined in `<script>` tag
- No build step required for changes
- No npm dependencies for frontend
- Just edit and refresh browser

**Making changes**:
1. Edit `public/dashboard.html`
2. Refresh browser (no server restart needed for HTML changes)
3. For server changes, restart Node.js process

## Development Workflow

**Adding new features**:
1. Backend logic in appropriate lib/ file
2. Emit events via EventEmitter
3. Update WebSocketHandler to broadcast if needed
4. Update dashboard.html to handle new data

**Debugging**:
- Server logs in console (stdout)
- Browser console shows WebSocket messages
- SQLite data in `server/data/surveillance.db` (use SQLite browser)

## Dependencies

```json
{
  "express": "^4.21.2",      // HTTP server + static files
  "ws": "^8.18.0",           // WebSocket server
  "better-sqlite3": "^11.9.1", // SQLite database (requires native build)
  "chokidar": "^4.0.3"       // File system watcher (v4 has breaking changes)
}
```

All dependencies use CommonJS (no ESM complications).
