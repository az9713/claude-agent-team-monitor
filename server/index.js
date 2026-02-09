const http = require('http');
const path = require('path');
const express = require('express');
const { WebSocketServer } = require('ws');

const FileWatcher = require('./lib/file-watcher');
const DataAggregator = require('./lib/data-aggregator');
const SQLiteStore = require('./lib/sqlite-store');
const WebSocketHandler = require('./lib/websocket-handler');

// Configuration
const PORT = parseInt(process.env.SURVEIL_PORT, 10) || 3847;
const TEAMS_DIR = process.env.SURVEIL_TEAMS_DIR || undefined; // defaults to ~/.claude/teams/
const TASKS_DIR = process.env.SURVEIL_TASKS_DIR || undefined; // defaults to ~/.claude/tasks/

// Initialize Express
const app = express();
const server = http.createServer(app);

// Serve dashboard
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Initialize components
const aggregator = new DataAggregator();
const store = new SQLiteStore();
const watcher = new FileWatcher({
  teamsDir: TEAMS_DIR,
  tasksDir: TASKS_DIR
});

// Initialize WebSocket
const wss = new WebSocketServer({ server });
const wsHandler = new WebSocketHandler({ wss });

// Wire up WebSocket callbacks
wsHandler.init(
  // getState
  (teamName) => {
    const state = aggregator.getState();
    if (teamName && state.teams[teamName]) {
      return {
        teams: { [teamName]: state.teams[teamName] },
        activeTeam: teamName,
        teamNames: Object.keys(state.teams)
      };
    }
    return {
      ...state,
      teamNames: Object.keys(state.teams)
    };
  },
  // getHistory
  () => store.listSessions(),
  // getSession
  (sessionId) => store.getSession(sessionId)
);

// Wire up file watcher events
watcher.on('team-config-changed', ({ teamName, filePath }) => {
  aggregator.updateTeamConfig(teamName, filePath);
  const team = aggregator.getState().teams[teamName];

  // Persist to SQLite
  if (team && team.config) {
    const sessionId = store.upsertSession(team.config);
    if (team.config.members) {
      store.upsertMembers(sessionId, team.config.members);
    }
  }

  // Broadcast to clients
  wsHandler.broadcastTeamUpdate(teamName, 'config', team);
});

watcher.on('inbox-changed', ({ teamName, agentName, filePath }) => {
  aggregator.updateInbox(teamName, agentName, filePath);
  const team = aggregator.getState().teams[teamName];
  const messages = team ? team.inboxes[agentName] : [];

  // Persist messages to SQLite (only if team has a real config)
  if (team && team.config && team.config.createdAt) {
    const sessionId = store.upsertSession(team.config);
    for (const msg of messages) {
      store.upsertMessage(sessionId, {
        inboxOwner: agentName,
        from: msg.from,
        messageType: msg.messageType,
        rawText: msg.text,
        parsedJson: msg.parsedContent,
        summary: msg.summary,
        color: msg.color,
        isRead: msg.read,
        timestamp: msg.timestamp
      });
    }
  }

  // Broadcast to clients
  wsHandler.broadcastTeamUpdate(teamName, 'inbox', {
    agentName,
    messages: aggregator.getMessages(teamName)
  });
});

watcher.on('task-changed', ({ teamName, taskId, filePath }) => {
  aggregator.updateTask(teamName, taskId, filePath);
  const team = aggregator.getState().teams[teamName];
  const task = team ? team.tasks[taskId] : null;

  // Persist task to SQLite (only if team has a real config with createdAt)
  if (team && team.config && team.config.createdAt && task) {
    const sessionId = store.upsertSession(team.config);
    store.upsertTask(sessionId, {
      taskId: task.id || taskId,
      subject: task.subject,
      description: task.description,
      activeForm: task.activeForm,
      status: task.status,
      owner: task.owner,
      blocks: task.blocks,
      blockedBy: task.blockedBy,
      isInternal: task.isInternal || false
    });
  }

  // Broadcast to clients
  wsHandler.broadcastTeamUpdate(teamName, 'task', {
    taskId,
    tasks: team ? team.tasks : {}
  });
});

// REST API for history
app.get('/api/sessions', (req, res) => {
  try {
    res.json(store.listSessions());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sessions/:id', (req, res) => {
  try {
    const session = store.getSession(parseInt(req.params.id, 10));
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Graceful shutdown
function shutdown() {
  console.log('\nShutting down...');
  wsHandler.shutdown();
  watcher.stop();
  store.close();
  server.close(() => {
    console.log('Server stopped.');
    process.exit(0);
  });
  // Force exit after 3s
  setTimeout(() => process.exit(0), 3000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start
async function main() {
  console.log('Agent Surveillance Dashboard');
  console.log(`Teams dir: ${watcher.teamsDir}`);
  console.log(`Tasks dir: ${watcher.tasksDir}`);

  await watcher.start();

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Try: SURVEIL_PORT=3848 node index.js`);
    } else {
      console.error('Server error:', err.message);
    }
    process.exit(1);
  });

  server.listen(PORT, () => {
    console.log(`Dashboard running at http://localhost:${PORT}`);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
