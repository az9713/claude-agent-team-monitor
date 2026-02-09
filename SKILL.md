---
name: surveil
description: Launch a real-time surveillance dashboard for Claude Code agent teams
triggers:
  - surveil my agents
  - agent dashboard
  - monitor agents
  - agent surveillance
  - launch dashboard
allowed-tools:
  - Bash
---

# Agent Team Surveillance Dashboard

Launch a real-time web dashboard that monitors Claude Code agent team activity.

## What it does

- Watches `~/.claude/teams/` and `~/.claude/tasks/` for live changes
- Shows agent roster with roles, models, and status
- Streams inter-agent messages with type badges (task_assignment, shutdown, idle, etc.)
- Displays a kanban task board (Pending / In Progress / Completed)
- Persists session history in SQLite for review

## How to launch

1. Check if dependencies are installed:
```bash
cd surveil/server && [ -d node_modules ] || npm install
```

2. Start the server:
```bash
node surveil/server/index.js
```

3. Tell the user to open http://localhost:3847

## Configuration

The server watches these directories by default:
- Teams: `~/.claude/teams/`
- Tasks: `~/.claude/tasks/`

Set environment variables to override:
- `SURVEIL_TEAMS_DIR` - path to teams directory
- `SURVEIL_TASKS_DIR` - path to tasks directory
- `SURVEIL_PORT` - server port (default 3847)
