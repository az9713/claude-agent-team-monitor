# Agent Team Surveillance Dashboard - User Guide

## Welcome and What This Tool Does

### What is the Surveillance Dashboard?

The **Agent Team Surveillance Dashboard** is a real-time monitoring tool for Claude Code agent teams. If you're familiar with Java or C++ development, think of it as a debugging or profiling tool - but instead of watching threads or processes, you're watching AI agents collaborating on tasks.

### What are Claude Code Agent Teams?

Claude Code is an AI-powered development assistant that can create **agent teams** - groups of AI agents working together to accomplish complex tasks. Each team has:

- A **Team Lead** (coordinator) that distributes work
- **Worker Agents** that execute specific tasks
- A shared **communication protocol** (agents send messages to each other)
- A **task queue** (like a project management board)

### What Does This Dashboard Show?

The dashboard displays three main views:

1. **Agent Roster** (Left Panel) - Shows all team members, their roles, and which AI model they're using (e.g., Claude Opus 4.6)
2. **Message Stream** (Center Panel) - Real-time feed of messages between agents (task assignments, status updates, shutdown requests)
3. **Task Board** (Bottom Panel) - Kanban-style board showing tasks in Pending, In Progress, and Completed columns

### When and Why You'd Use This Tool

**Scenarios where this dashboard is valuable:**

- **Debugging agent behavior**: See exactly what messages agents are sending and why tasks might be stuck
- **Monitoring progress**: Watch tasks move from Pending → In Progress → Completed in real-time
- **Understanding workflows**: Learn how agent teams coordinate and communicate
- **Post-mortem analysis**: Review historical sessions to understand what happened during a team run
- **Learning about AI collaboration**: Observe how multiple AI agents divide work and handle dependencies

Think of it like watching a multi-threaded application in a debugger, but the "threads" are AI agents, and the "mutex locks" are task dependencies.

---

## Prerequisites

Before you can run the dashboard, you need a few tools installed on your computer.

### 1. Node.js v18 or Higher

**What is Node.js?**
For C/C++/Java developers: Node.js is like the JVM (Java Virtual Machine) but for JavaScript. It lets you run JavaScript code outside of a web browser. The dashboard's backend server is written in JavaScript and needs Node.js to run.

**Installation:**

- **Windows**: Download the installer from [https://nodejs.org/](https://nodejs.org/)
  Choose the "LTS" (Long-Term Support) version. Run the `.msi` installer and follow the wizard.

- **macOS**: Download from [https://nodejs.org/](https://nodejs.org/) or use Homebrew:
  ```bash
  brew install node
  ```

- **Linux**: Use your package manager:
  ```bash
  # Ubuntu/Debian
  sudo apt update
  sudo apt install nodejs npm

  # Fedora/RHEL
  sudo dnf install nodejs npm
  ```

**Verify installation:**
Open a terminal (Command Prompt, PowerShell, or Git Bash on Windows) and type:

```bash
node --version
```

You should see something like `v18.17.0` or higher.

### 2. npm (Node Package Manager)

**What is npm?**
npm is like Maven (Java) or pip (Python) - it downloads and manages software dependencies. It comes bundled with Node.js, so if you installed Node.js, you already have npm.

**Verify installation:**

```bash
npm --version
```

You should see something like `9.6.7` or higher.

### 3. A Web Browser

Any modern browser works:
- Google Chrome (recommended)
- Mozilla Firefox
- Microsoft Edge
- Safari (macOS)

### 4. Claude Code (Optional but Recommended)

To generate real agent team data, you need Claude Code installed. This creates the `~/.claude/teams/` and `~/.claude/tasks/` directories that the dashboard monitors.

**Installation**: Follow the instructions at [https://claude.ai/claude-code](https://claude.ai/claude-code)

### 5. Windows Build Tools (Windows Users Only)

**Why do you need this?**
One of the dashboard's dependencies (`better-sqlite3`) is a native module - it includes C++ code that must be compiled for your operating system. On Windows, this requires a C++ compiler.

**Option 1: Visual Studio Build Tools (Recommended)**

1. Download from [https://visualstudio.microsoft.com/downloads/](https://visualstudio.microsoft.com/downloads/)
2. Scroll to "Tools for Visual Studio"
3. Download "Build Tools for Visual Studio 2022"
4. Run the installer
5. Select "Desktop development with C++"
6. Install (this takes 5-10 minutes)

**Option 2: windows-build-tools (Deprecated but faster)**

Open PowerShell **as Administrator** and run:

```powershell
npm install --global windows-build-tools
```

**Note**: This option is deprecated but still works for many users.

**Option 3: Skip native compilation (Fallback)**

If you can't install build tools, the dashboard will still work, but SQLite features might be limited. You'll see warnings during `npm install` but the server will start.

---

## Installation - Step by Step

Now that prerequisites are installed, let's install the dashboard.

### Step 1: Open a Terminal

**Windows:**
- Press `Win + R`, type `cmd`, press Enter (Command Prompt)
- OR: Press `Win + R`, type `powershell`, press Enter (PowerShell)
- OR: Open Git Bash if you have Git installed

**macOS:**
- Press `Cmd + Space`, type `terminal`, press Enter

**Linux:**
- Press `Ctrl + Alt + T`

### Step 2: Navigate to the Server Directory

In your terminal, change directory to the `surveil/server` folder. Replace the path below with your actual path:

```bash
cd C:\Users\simon\Downloads\claude_code_agent_team_mark_kashef\surveil\server
```

**Tip for Windows users**: You can type `cd ` (with a space), then drag-and-drop the `server` folder from File Explorer into the terminal window. The path will auto-fill.

**Verify you're in the right place:**

```bash
# Windows (Command Prompt)
dir

# Windows (PowerShell/Git Bash) or macOS/Linux
ls
```

You should see files like `index.js`, `package.json`, and a folder called `lib`.

### Step 3: Install Dependencies

Run this command to download all required dependencies:

```bash
npm install
```

**What's happening?**
npm reads `package.json` (which lists the required libraries) and downloads them into a new folder called `node_modules`. This is similar to Maven downloading JARs into `~/.m2/repository`.

**Expected output:**

```
added 85 packages, and audited 86 packages in 12s

14 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
```

**If you see errors about `better-sqlite3`:**
- On Windows: Install Visual Studio Build Tools (see Prerequisites section)
- On macOS: Run `xcode-select --install`
- On Linux: Run `sudo apt-get install build-essential python3`

Then run `npm install` again.

### Step 4: Verify Installation

Check that the `node_modules` folder was created:

```bash
# Windows (Command Prompt)
dir node_modules

# Windows (PowerShell/Git Bash) or macOS/Linux
ls node_modules
```

You should see folders like `express`, `ws`, `better-sqlite3`, and `chokidar`.

**Installation complete!** You're ready to start the dashboard.

---

## Starting the Dashboard

### Step 1: Start the Server

From the `surveil/server` directory, run:

```bash
node index.js
```

**Expected output:**

```
Agent Surveillance Dashboard
Teams dir: C:\Users\simon\.claude\teams
Tasks dir: C:\Users\simon\.claude\tasks
Dashboard running at http://localhost:3847
```

**What's happening?**
- The server starts watching your `~/.claude/teams/` and `~/.claude/tasks/` directories
- It opens a web server on port 3847 (like how Tomcat runs on port 8080)
- It's waiting for browser connections

**Keep this terminal window open!** The server needs to stay running.

### Step 2: Open the Dashboard in Your Browser

1. Open your web browser
2. In the address bar, type: `http://localhost:3847`
3. Press Enter

**What does "localhost:3847" mean?**
- `localhost` = your own computer (IP address 127.0.0.1)
- `3847` = the port number the server is listening on
- Together, it means "connect to the web server running on my computer on port 3847"

### Step 3: You Should See the Dashboard

If everything worked, you'll see:

- A dark-themed interface
- A green dot in the top-left corner (means connected)
- The header says "Agent Dashboard"
- Empty panels if no agents are running yet

**If you see a connection error:**
- Check that `node index.js` is still running
- Make sure no other program is using port 3847
- Try refreshing the page

### Stopping the Server

To stop the server, go back to the terminal and press:

```
Ctrl + C
```

You'll see:

```
^CShutting down...
Server stopped.
```

---

## Quick Start with Test Data

If you want to see the dashboard in action **without running real agents**, you can use bundled test data.

### Why Use Test Data?

- See what the dashboard looks like with real data
- Test that everything is working
- Learn the interface before running real agents
- No need to wait for agents to generate data

### Step-by-Step: Run with Test Data

#### On Linux or macOS

1. Open a terminal
2. Navigate to the server directory:
   ```bash
   cd C:\Users\simon\Downloads\claude_code_agent_team_mark_kashef\surveil\server
   ```

3. Run with environment variables pointing to test data:
   ```bash
   SURVEIL_TEAMS_DIR=../../docs/teams SURVEIL_TASKS_DIR=../../docs/tasks node index.js
   ```

**What's happening?**
The `SURVEIL_TEAMS_DIR` and `SURVEIL_TASKS_DIR` environment variables override the default directories. Instead of watching `~/.claude/teams/`, the server watches `../../docs/teams/` (which contains sample JSON files).

#### On Windows PowerShell

1. Open PowerShell
2. Navigate to the server directory:
   ```powershell
   cd C:\Users\simon\Downloads\claude_code_agent_team_mark_kashef\surveil\server
   ```

3. Set environment variables and run:
   ```powershell
   $env:SURVEIL_TEAMS_DIR="../../docs/teams"; $env:SURVEIL_TASKS_DIR="../../docs/tasks"; node index.js
   ```

**Note**: The semicolon (`;`) separates multiple commands in PowerShell.

#### On Windows Command Prompt

1. Open Command Prompt
2. Navigate to the server directory:
   ```cmd
   cd C:\Users\simon\Downloads\claude_code_agent_team_mark_kashef\surveil\server
   ```

3. Set environment variables and run:
   ```cmd
   set SURVEIL_TEAMS_DIR=../../docs/teams && set SURVEIL_TASKS_DIR=../../docs/tasks && node index.js
   ```

**Note**: The `&&` operator chains commands. No spaces around the `=` sign.

### What You'll See

Open `http://localhost:3847` in your browser. You should see:

- **Team Name**: "snappy-seeking-candy" or "ta-research"
- **Agents**: Multiple agents in the left sidebar
- **Messages**: Communication logs in the center
- **Tasks**: Tasks on the Kanban board at the bottom

You can explore the interface risk-free - this test data doesn't affect your real agent files.

---

## Dashboard Interface Tour

Let's walk through each section of the dashboard in detail.

### Header Bar

Located at the very top of the page.

#### Connection Indicator (Top-Left)

- **Green Dot**: Connected to the server. Real-time updates are flowing.
- **Red Dot**: Disconnected. The dashboard will show a yellow banner saying "Reconnecting..." and automatically retry every 5 seconds.

#### Team Name Badge

Shows the current team name and member count, e.g., "snappy-seeking-candy (2 members)".

#### Team Selector Dropdown

Appears when multiple teams exist. Click to switch between teams.

**Example**: If you have teams "frontend-team" and "backend-team" running, you can switch views without restarting the server.

#### Live / History Tabs

- **Live Tab**: Shows real-time agent activity (default view)
- **History Tab**: Shows past sessions saved in the SQLite database

#### Live Clock

Displays the current time (updates every second). Helps correlate dashboard events with your local time.

---

### Agent Roster (Left Sidebar)

Shows all team members.

#### Agent Card

Each agent is displayed as a card with:

1. **Colored Circle with Initial**: The first letter of the agent's name with a unique color
2. **Agent Name**: e.g., "team-lead", "worker-1"
3. **LEAD Badge**: Yellow badge if the agent is the team lead
4. **Type**: Role of the agent (e.g., "team-lead", "worker")
5. **Model**: Which AI model powers this agent (e.g., "claude-opus-4-6")

**Example Agent Card:**

```
[R] research-agent           ← Colored circle with "R"
LEAD                          ← Yellow badge (if lead)
Type: team-lead               ← Role
Model: claude-opus-4-6        ← AI model
```

#### What Do These Roles Mean?

- **team-lead**: The coordinator agent. Assigns tasks to workers and approves shutdowns.
- **worker**: An agent that executes specific tasks assigned by the lead.
- **specialist**: An agent with specific expertise (e.g., "database-specialist").

**For C++ developers**: Think of the team lead as the main thread that spawns worker threads.

---

### Messages Panel (Center)

Displays real-time communication between agents.

#### Message Layout

Messages are shown **newest first** (most recent at the top). Each message shows:

1. **Colored Sender Dot**: Matches the sender's color in the roster
2. **Sender → Recipient**: e.g., "team-lead → worker-1"
3. **Timestamp**: Relative time, e.g., "2 minutes ago"
4. **Message Type Badge**: Color-coded badge explaining the message type

#### Message Type Badges

Messages are automatically classified:

| Badge | Color | Meaning |
|-------|-------|---------|
| **TASK_ASSIGNMENT** | Blue | Team lead is assigning a task to a worker |
| **SHUTDOWN_REQUEST** | Orange | Worker is asking permission to shut down |
| **IDLE_NOTIFICATION** | Yellow | Worker is reporting it's idle or interrupted |
| **SHUTDOWN_APPROVED** | Green | Team lead is approving a shutdown request |
| **TEXT** | Gray | Plain text message (no structured data) |

#### Structured Messages

Some messages contain structured data (parsed JSON). These show additional fields:

**TASK_ASSIGNMENT Example:**
```
[TASK_ASSIGNMENT]
Subject: Implement user authentication
Task ID: task-42
Priority: high
```

**SHUTDOWN_REQUEST Example:**
```
[SHUTDOWN_REQUEST]
Reason: All assigned tasks completed
Task ID: task-15
```

#### Long Messages

Messages longer than ~300 characters are truncated. Click the **"Show more"** button to expand, or **"Collapse"** to hide again.

#### Unread Messages

Messages you haven't scrolled past have a **blue left border**. This helps you track new messages in a busy stream.

**For Java developers**: Think of this as a log aggregator (like Logback or SLF4J) showing logs from multiple threads, but each "thread" is an AI agent.

---

### Task Board (Bottom Panel)

A Kanban-style board showing task progress.

#### Three Columns

1. **Pending**: Tasks not yet started
2. **In Progress**: Tasks currently being worked on
3. **Completed**: Finished tasks

#### Task Card

Each task is displayed as a card:

```
┌─────────────────────────────────┐
│ #42  Implement authentication   │  ← Task ID and subject
│ [W] worker-1                    │  ← Owner badge (colored)
│ blocks: #43, #44                │  ← Orange badges (blocking)
│ blocked by: #40                 │  ← Red badge (blocked)
└─────────────────────────────────┘
```

#### Task ID and Subject

- **Task ID**: Unique identifier, e.g., `#42`
- **Subject**: Brief description of the task

#### Owner Badge

Shows which agent is responsible for this task. The badge color matches the agent's color in the roster.

**Example**: `[W] worker-1` means worker-1 (with color assigned to "W") owns this task.

#### Dependency Badges

Tasks can have dependencies:

- **blocks: #N** (Orange Badge): This task must complete before task N can start
- **blocked by: #N** (Red Badge): This task is waiting for task N to complete

**Example**:
Task #42 has "blocks: #43". This means task #43 cannot start until #42 finishes.

**For C++ developers**: This is like thread synchronization - task #43 is "waiting" on a condition variable signaled by task #42 completing.

#### In-Progress Task Animation

Tasks in the "In Progress" column show a **spinner animation** with the current activity:

```
[Spinner] Reading file documentation.md
```

This shows what the agent is doing right now (e.g., "Reading file", "Writing code", "Running tests").

#### Hidden Tasks

- **Internal Tasks**: Tasks marked as internal are automatically hidden (e.g., system maintenance tasks)
- **Deleted Tasks**: Tasks deleted by agents don't appear

---

### History Tab

Switch to the History tab to review past sessions.

#### Left Panel: Session List

Shows all saved sessions:

```
┌─────────────────────────────────────┐
│ snappy-seeking-candy                │  ← Team name
│ Building authentication module      │  ← Description
│ 2026-02-07 14:30 - 15:45           │  ← Start/end times
│ 3 members                           │  ← Member count
└─────────────────────────────────────┘
```

#### Right Panel: Session Detail

Click a session in the left panel to load it in the right panel. You'll see:

- **Agent Roster**: Same as live view, but frozen in time
- **Messages**: All messages from that session
- **Task Board**: Final state of all tasks

**Use Case**: Debug what went wrong in a past run by reviewing the message flow and task dependencies.

---

## Configuration Options

You can customize the dashboard using environment variables.

### SURVEIL_PORT

**Purpose**: Change the HTTP server port (default: 3847)

**Use Case**: Port 3847 is already in use by another program

**Example**:

```bash
# Linux/macOS
SURVEIL_PORT=3848 node index.js

# Windows PowerShell
$env:SURVEIL_PORT="3848"; node index.js

# Windows Command Prompt
set SURVEIL_PORT=3848 && node index.js
```

Then open `http://localhost:3848` in your browser.

### SURVEIL_TEAMS_DIR

**Purpose**: Change where the server looks for team configuration files

**Default**: `~/.claude/teams/`

**Use Case**: Monitor agents running on a different machine (if directories are shared via network)

**Example**:

```bash
# Linux/macOS
SURVEIL_TEAMS_DIR=/mnt/shared/teams node index.js

# Windows PowerShell
$env:SURVEIL_TEAMS_DIR="D:\shared\teams"; node index.js

# Windows Command Prompt
set SURVEIL_TEAMS_DIR=D:\shared\teams && node index.js
```

### SURVEIL_TASKS_DIR

**Purpose**: Change where the server looks for task files

**Default**: `~/.claude/tasks/`

**Use Case**: Same as SURVEIL_TEAMS_DIR

**Example**:

```bash
# Linux/macOS
SURVEIL_TASKS_DIR=/mnt/shared/tasks node index.js

# Windows PowerShell
$env:SURVEIL_TASKS_DIR="D:\shared\tasks"; node index.js

# Windows Command Prompt
set SURVEIL_TASKS_DIR=D:\shared\tasks && node index.js
```

### Combining Multiple Options

You can set multiple environment variables at once:

```bash
# Linux/macOS
SURVEIL_PORT=3848 SURVEIL_TEAMS_DIR=/mnt/teams node index.js

# Windows PowerShell
$env:SURVEIL_PORT="3848"; $env:SURVEIL_TEAMS_DIR="D:\teams"; node index.js

# Windows Command Prompt
set SURVEIL_PORT=3848 && set SURVEIL_TEAMS_DIR=D:\teams && node index.js
```

---

## Using as a Claude Code Skill

The dashboard can be launched directly from Claude Code using voice-like commands.

### What is a Claude Code Skill?

A skill is a pre-defined capability that Claude Code understands. When you type certain trigger phrases, Claude Code automatically runs the associated commands.

### Installation

The skill file (`SKILL.md`) is located at:

```
surveil/SKILL.md
```

Claude Code automatically detects skills in your project. If it's not working, you can manually install it:

1. Copy `SKILL.md` to `~/.claude/skills/surveil/SKILL.md`
2. Restart Claude Code

### Trigger Phrases

Say any of these to Claude Code:

- "surveil my agents"
- "agent dashboard"
- "monitor agents"
- "agent surveillance"
- "launch dashboard"

### What Happens

1. Claude Code checks if dependencies are installed (`node_modules` exists)
2. If not, it runs `npm install` automatically
3. It starts the server with `node index.js`
4. It tells you to open `http://localhost:3847` in your browser

### Example Interaction

**You**: "surveil my agents"

**Claude Code**:
```
I'll launch the agent surveillance dashboard.

Running: cd surveil/server && npm install
✓ Dependencies installed

Running: node index.js
✓ Server started on http://localhost:3847

Please open http://localhost:3847 in your browser to view the dashboard.
```

---

## Ten+ Educational Use Cases

Here are detailed scenarios showing how to use the dashboard effectively.

---

### Use Case 1: Monitor a Live Agent Team

**Scenario**: You've started a Claude Code agent team to build a user authentication feature. You want to monitor their progress in real-time.

**Steps**:

1. Start the dashboard:
   ```bash
   cd surveil/server
   node index.js
   ```

2. Open `http://localhost:3847` in your browser

3. In Claude Code, start your agent team:
   ```
   "Create a team of 3 agents to implement user authentication"
   ```

4. **Watch the Roster**: As agents join, they appear in the left sidebar. You'll see:
   - A team lead (coordinator)
   - Multiple workers

5. **Watch Messages**: The center panel fills with messages:
   - Team lead sends TASK_ASSIGNMENT messages to workers
   - Workers send back status updates

6. **Watch Task Board**: Tasks move from Pending → In Progress → Completed

**What You Learn**: How agent teams organize themselves and distribute work.

**For Java developers**: This is like watching a ThreadPoolExecutor spawn threads and assign them Runnable tasks.

---

### Use Case 2: Track Task Progress with the Kanban Board

**Scenario**: Your team has 10 tasks. You want to see which are pending, which are in progress, and which are completed.

**Steps**:

1. Start the dashboard and open it in your browser

2. Look at the **Task Board** (bottom panel)

3. **Pending Column**: Tasks waiting to start
   - Check for tasks with "blocked by: #N" badges
   - These can't start until their dependencies complete

4. **In Progress Column**: Active tasks
   - Look for the spinner animation showing current activity
   - Check the owner badge to see which agent is working on it

5. **Completed Column**: Finished tasks

**Example Scenario**:
- Task #1: "Set up database schema" (Completed)
- Task #2: "Create user model" (Completed)
- Task #3: "Implement login endpoint" (In Progress, blocked by: #2)
- Task #4: "Write tests" (Pending, blocked by: #3)

You can see the dependency chain: Database → Model → Endpoint → Tests

**What You Learn**: How to identify bottlenecks and track overall progress.

---

### Use Case 3: Read Inter-Agent Messages

**Scenario**: You want to understand how your team lead coordinates with workers.

**Steps**:

1. Open the dashboard

2. Focus on the **Messages Panel** (center)

3. Look for **TASK_ASSIGNMENT** messages (blue badges):
   ```
   team-lead → worker-1
   [TASK_ASSIGNMENT]
   Subject: Implement user registration
   Task ID: task-5
   Priority: high
   ```

4. Scroll down to see worker responses:
   ```
   worker-1 → team-lead
   [TEXT]
   Started working on task-5
   ```

5. Later, you might see:
   ```
   worker-1 → team-lead
   [SHUTDOWN_REQUEST]
   Reason: Task task-5 completed
   ```

6. And the lead's response:
   ```
   team-lead → worker-1
   [SHUTDOWN_APPROVED]
   Approved shutdown for worker-1
   ```

**What You Learn**: The complete communication protocol between agents.

**For C++ developers**: This is like reading logs from a distributed system where processes communicate via message queues.

---

### Use Case 4: Identify Blocked Tasks

**Scenario**: You notice a task has been stuck in "Pending" for a long time. You need to find out why.

**Steps**:

1. Open the dashboard

2. Look at the **Pending** column in the Task Board

3. Find the stuck task, e.g., Task #8: "Write API documentation"

4. Check for **"blocked by: #N"** badges (red):
   ```
   #8  Write API documentation
   [D] docs-agent
   blocked by: #7
   ```

5. Find task #7 in the board:
   ```
   #7  Implement API endpoints
   [W] worker-2
   In Progress
   ```

6. Now you know: Task #8 can't start because task #7 is still in progress

7. **Check task #7's progress**: Look at the spinner animation:
   ```
   [Spinner] Writing file api-handler.js
   ```

8. **Check messages**: Search the message panel for task #7 to see if there are any issues

**What You Learn**: How to trace dependency chains and identify root causes of delays.

**For Java developers**: This is like analyzing a thread dump to find threads waiting on locks.

---

### Use Case 5: Monitor Agent Shutdown Flow

**Scenario**: Your team is wrapping up. You want to watch the graceful shutdown protocol.

**Steps**:

1. Keep the dashboard open as agents finish their tasks

2. **Watch for SHUTDOWN_REQUEST messages** (orange badges):
   ```
   worker-1 → team-lead
   [SHUTDOWN_REQUEST]
   Reason: All assigned tasks completed
   Task ID: task-10
   ```

3. **Watch for SHUTDOWN_APPROVED messages** (green badges):
   ```
   team-lead → worker-1
   [SHUTDOWN_APPROVED]
   Approved shutdown for worker-1
   ```

4. **Watch the Roster**: As workers shut down, they may disappear from the roster (depending on implementation)

5. **Finally, the team lead shuts down**: Once all workers are done, the lead will shut down last

**What You Learn**: How agents coordinate shutdown to ensure all work is completed.

**For Java developers**: This is like watching ExecutorService.shutdown() followed by awaitTermination().

---

### Use Case 6: Review Past Sessions

**Scenario**: You ran an agent team yesterday to implement a feature. Something went wrong, and you want to review what happened.

**Steps**:

1. Start the dashboard:
   ```bash
   node index.js
   ```

2. Open `http://localhost:3847` in your browser

3. Click the **"History"** tab in the header

4. **Left Panel**: You see a list of past sessions:
   ```
   auth-implementation-team
   Implement user authentication
   2026-02-07 09:00 - 2026-02-07 11:30
   4 members
   ```

5. Click on the session

6. **Right Panel**: The session loads, showing:
   - The roster of agents at that time
   - All messages exchanged
   - Final state of the task board

7. **Review messages**: Scroll through to find errors or unexpected behavior

8. **Check task dependencies**: Look at the task board to see if any tasks were blocked

**What You Learn**: How to perform post-mortem debugging on agent teams.

**For Java developers**: This is like reviewing application logs after a production incident.

---

### Use Case 7: Watch Real-Time Updates

**Scenario**: You want to verify that the dashboard updates live as agents work.

**Steps**:

1. Start the dashboard in your browser

2. Start an agent team in Claude Code

3. **Keep both windows visible** (side-by-side if possible)

4. **Watch the message panel**: As agents send messages, they instantly appear at the top

5. **Watch the task board**: As agents start tasks, cards move from Pending → In Progress

6. **Watch task animations**: In Progress tasks show a spinner with the current activity

7. **No refresh needed**: Everything updates automatically via WebSocket

**What You Learn**: The dashboard provides true real-time monitoring without polling.

**For Java developers**: This is like watching a profiler update in real-time as your application runs.

---

### Use Case 8: Compare Multiple Teams

**Scenario**: You have two teams running simultaneously - one for frontend, one for backend. You want to switch between them.

**Steps**:

1. Start two agent teams in Claude Code:
   - Team 1: "frontend-team" (building React components)
   - Team 2: "backend-team" (building REST API)

2. Open the dashboard: `http://localhost:3847`

3. Look at the **Team Selector Dropdown** in the header (appears when multiple teams exist)

4. Click the dropdown - you'll see:
   ```
   frontend-team (3 members)
   backend-team (2 members)
   ```

5. Select "frontend-team" - the dashboard shows frontend agents, messages, and tasks

6. Select "backend-team" - the dashboard switches to backend data

7. **No restart needed**: The server monitors both teams simultaneously

**What You Learn**: How to manage multiple concurrent agent teams.

---

### Use Case 9: Check Agent Status and Model

**Scenario**: You want to verify which AI model each agent is using (e.g., Claude Opus 4.6 vs. Sonnet).

**Steps**:

1. Open the dashboard

2. Look at the **Agent Roster** (left sidebar)

3. Each agent card shows model information:
   ```
   [T] team-lead
   LEAD
   Type: team-lead
   Model: claude-opus-4-6    ← AI model
   ```

   ```
   [W] worker-1
   Type: worker
   Model: claude-sonnet-4-5   ← Different model
   ```

4. **Why this matters**: Different models have different capabilities and costs. You might assign complex tasks to Opus agents and simple tasks to Sonnet agents.

**What You Learn**: How to audit which models are being used in your team.

---

### Use Case 10: Understand Message Types

**Scenario**: You're new to agent teams and want to learn what the different colored badges mean.

**Steps**:

1. Open the dashboard

2. Look at the **Messages Panel**

3. **Find each message type**:

   **TASK_ASSIGNMENT (Blue)**:
   ```
   team-lead → worker-1
   [TASK_ASSIGNMENT]
   Subject: Implement login endpoint
   Task ID: task-3
   ```
   **Meaning**: The team lead is assigning task-3 to worker-1.

   **SHUTDOWN_REQUEST (Orange)**:
   ```
   worker-1 → team-lead
   [SHUTDOWN_REQUEST]
   Reason: Task task-3 completed
   ```
   **Meaning**: Worker-1 has finished its work and is asking permission to shut down.

   **IDLE_NOTIFICATION (Yellow)**:
   ```
   worker-2 → team-lead
   [IDLE_NOTIFICATION]
   Reason: No tasks available
   ```
   **Meaning**: Worker-2 has no work and is waiting for assignment.

   **SHUTDOWN_APPROVED (Green)**:
   ```
   team-lead → worker-1
   [SHUTDOWN_APPROVED]
   Approved shutdown for worker-1
   ```
   **Meaning**: The team lead has granted permission for worker-1 to shut down.

   **TEXT (Gray)**:
   ```
   worker-1 → team-lead
   [TEXT]
   Starting work on authentication module
   ```
   **Meaning**: A plain text message with no structured data.

**What You Learn**: How to interpret message types and understand agent communication.

---

### Use Case 11: Debug with Test Data

**Scenario**: You want to test the dashboard before using it with real agents. You don't want to start a full agent team just to see what the dashboard looks like.

**Steps**:

1. Stop any running dashboard server (Ctrl+C)

2. Start the server with test data:

   **Linux/macOS**:
   ```bash
   SURVEIL_TEAMS_DIR=../../docs/teams SURVEIL_TASKS_DIR=../../docs/tasks node index.js
   ```

   **Windows PowerShell**:
   ```powershell
   $env:SURVEIL_TEAMS_DIR="../../docs/teams"; $env:SURVEIL_TASKS_DIR="../../docs/tasks"; node index.js
   ```

   **Windows Command Prompt**:
   ```cmd
   set SURVEIL_TEAMS_DIR=../../docs/teams && set SURVEIL_TASKS_DIR=../../docs/tasks && node index.js
   ```

3. Open `http://localhost:3847`

4. **Explore safely**: The test data is static - you can't break anything

5. **Practice using the interface**:
   - Click on messages to expand them
   - Switch teams using the dropdown
   - Switch to the History tab
   - Look at task dependencies

**What You Learn**: How to use test data for safe experimentation.

---

### Use Case 12: Troubleshoot Connection Issues

**Scenario**: The dashboard shows a red dot and a yellow banner saying "Reconnecting...". Real-time updates have stopped.

**Steps**:

1. **Check if the server is still running**: Go to your terminal where you ran `node index.js`. If you see no output, the server may have crashed.

2. **Check for error messages**: Look for red error text in the terminal:
   ```
   Error: EADDRINUSE: Port 3847 is already in use
   ```

3. **Fix: Kill the existing process**:

   **Windows**:
   ```cmd
   netstat -ano | findstr :3847
   taskkill /PID <process_id> /F
   ```

   **Linux/macOS**:
   ```bash
   lsof -ti:3847 | xargs kill -9
   ```

4. **Or use a different port**:
   ```bash
   SURVEIL_PORT=3848 node index.js
   ```
   Then open `http://localhost:3848`

5. **Restart the server**: Run `node index.js` again

6. **Refresh the browser**: The dashboard should reconnect automatically (green dot)

**What You Learn**: How to diagnose and fix connection issues.

---

## Troubleshooting

Common issues and their solutions.

### Issue: "Port 3847 is already in use"

**Symptoms**:
```
Error: EADDRINUSE: Port 3847 is already in use.
```

**Cause**: Another program is using port 3847, or you have a previous instance of the dashboard still running.

**Solution 1 - Kill the existing process**:

**Windows**:
1. Find the process using the port:
   ```cmd
   netstat -ano | findstr :3847
   ```
   You'll see output like: `TCP 0.0.0.0:3847 0.0.0.0:0 LISTENING 12345`

2. Kill the process (replace 12345 with the actual PID):
   ```cmd
   taskkill /PID 12345 /F
   ```

**Linux/macOS**:
```bash
# Find and kill in one command
lsof -ti:3847 | xargs kill -9
```

**Solution 2 - Use a different port**:
```bash
SURVEIL_PORT=3848 node index.js
```
Then open `http://localhost:3848` in your browser.

---

### Issue: "npm install" Failed

**Symptoms**:
```
npm ERR! code 1
npm ERR! Failed to compile better-sqlite3
```

**Cause**: The `better-sqlite3` package requires native compilation (C++ code). Your system is missing build tools.

**Solution - Install build tools**:

**Windows**:
1. Download Visual Studio Build Tools: [https://visualstudio.microsoft.com/downloads/](https://visualstudio.microsoft.com/downloads/)
2. Install "Desktop development with C++"
3. Run `npm install` again

**macOS**:
```bash
xcode-select --install
```

**Linux (Ubuntu/Debian)**:
```bash
sudo apt-get install build-essential python3
```

**Linux (Fedora/RHEL)**:
```bash
sudo dnf install gcc-c++ make python3
```

After installing build tools, try again:
```bash
npm install
```

---

### Issue: Dashboard Shows No Data

**Symptoms**:
- Dashboard loads successfully
- Green dot (connected)
- But roster, messages, and task board are all empty

**Cause**: No agent teams are running, or the server is watching the wrong directories.

**Solution 1 - Verify directories exist**:

**Windows (PowerShell)**:
```powershell
Test-Path $HOME\.claude\teams
Test-Path $HOME\.claude\tasks
```
Both should return `True`.

**Linux/macOS**:
```bash
ls ~/.claude/teams
ls ~/.claude/tasks
```
Both should list JSON files.

**Solution 2 - Run test data**:
```bash
# See "Quick Start with Test Data" section
SURVEIL_TEAMS_DIR=../../docs/teams SURVEIL_TASKS_DIR=../../docs/tasks node index.js
```

**Solution 3 - Start an agent team**:

In Claude Code, say:
```
"Create a team of 2 agents to build a simple REST API"
```

The dashboard should populate within seconds.

---

### Issue: Red Dot / "Reconnecting..." Banner

**Symptoms**:
- Dashboard was working
- Now shows red dot and yellow "Reconnecting..." banner
- No updates are coming through

**Cause**: The server crashed or you closed the terminal running `node index.js`.

**Solution**:

1. **Check the server terminal**: Look for errors or if the process exited

2. **Restart the server**:
   ```bash
   node index.js
   ```

3. **Refresh the browser**: The dashboard will auto-reconnect (should turn green)

4. **If the server keeps crashing**: Look for error messages in the terminal. Common issues:
   - Out of memory (restart with more memory: `node --max-old-space-size=4096 index.js`)
   - File permission errors (check that you can read files in `~/.claude/`)

---

### Issue: "better-sqlite3" Build Error on Windows

**Symptoms**:
```
gyp ERR! find VS
gyp ERR! find VS msvs_version not set from command line or npm config
```

**Cause**: Windows doesn't have the Visual C++ compiler needed to build native Node.js modules.

**Solution**:

**Option 1 - Visual Studio Build Tools (Recommended)**:

1. Download: [https://visualstudio.microsoft.com/downloads/](https://visualstudio.microsoft.com/downloads/)
2. Find "Tools for Visual Studio"
3. Download "Build Tools for Visual Studio 2022"
4. Run installer
5. Check "Desktop development with C++"
6. Install (takes 5-10 minutes)
7. Restart your terminal
8. Run `npm install` again

**Option 2 - windows-build-tools (Deprecated)**:

Open PowerShell **as Administrator**:
```powershell
npm install --global windows-build-tools
```

**Option 3 - Workaround (Limited functionality)**:

If you can't install build tools, the dashboard will work but without SQLite history features:

1. Remove better-sqlite3 from dependencies:
   ```bash
   npm uninstall better-sqlite3
   ```

2. Comment out SQLite code in `index.js` (lines 8, 29, 69-73, 84-100, 114-128, 138-156, 163)

3. The dashboard will work but History tab will be disabled

---

### Issue: "Permission Denied" Error

**Symptoms** (Linux/macOS):
```
Error: EACCES: permission denied, mkdir '/home/user/.claude/teams'
```

**Cause**: The user running the dashboard doesn't have permission to read `~/.claude/` directories.

**Solution**:

1. **Check directory permissions**:
   ```bash
   ls -ld ~/.claude/teams
   ls -ld ~/.claude/tasks
   ```

2. **Fix permissions**:
   ```bash
   chmod 755 ~/.claude/teams
   chmod 755 ~/.claude/tasks
   ```

3. **Fix file permissions** (if needed):
   ```bash
   chmod 644 ~/.claude/teams/*.json
   chmod 644 ~/.claude/tasks/*.json
   ```

---

### Issue: WebSocket Connection Failed

**Symptoms**:
- Browser console shows: `WebSocket connection to 'ws://localhost:3847/' failed`
- Red dot in dashboard

**Cause**: Firewall or antivirus blocking WebSocket connections.

**Solution**:

1. **Check if server is running**:
   ```bash
   # Windows
   netstat -an | findstr :3847

   # Linux/macOS
   lsof -i :3847
   ```
   You should see a LISTENING entry.

2. **Try a different browser**: Some corporate firewalls block WebSockets in certain browsers.

3. **Disable antivirus temporarily**: Test if it's blocking connections.

4. **Add firewall exception**:

   **Windows Firewall**:
   1. Open "Windows Defender Firewall"
   2. "Allow an app through firewall"
   3. Add Node.js

   **macOS Firewall**:
   1. System Preferences → Security & Privacy → Firewall
   2. Firewall Options
   3. Add Node.js

---

### Issue: Dashboard Shows Old Data

**Symptoms**:
- Agents have finished
- But dashboard still shows old messages and tasks

**Cause**: Browser cached old data.

**Solution**:

1. **Hard refresh**:
   - Windows/Linux: `Ctrl + Shift + R`
   - macOS: `Cmd + Shift + R`

2. **Clear cache**:
   - Open browser DevTools (F12)
   - Right-click the refresh button
   - Select "Empty Cache and Hard Reload"

3. **Restart the server**: The dashboard will get fresh data on reconnect.

---

## FAQ

### Q: Does this dashboard modify any agent files?

**A**: No. The dashboard is **read-only**. It only reads JSON files from `~/.claude/teams/` and `~/.claude/tasks/`. The only writes are to the SQLite database (`server/data/surveillance.db`) for session history.

---

### Q: Can I run multiple dashboards at the same time?

**A**: Yes, on different ports.

**Example**:

Terminal 1:
```bash
SURVEIL_PORT=3847 node index.js
```

Terminal 2:
```bash
SURVEIL_PORT=3848 node index.js
```

Then open:
- `http://localhost:3847` (monitors real data)
- `http://localhost:3848` (monitors test data with custom dirs)

---

### Q: What happens if agents finish before I start the dashboard?

**A**: The dashboard performs an **initial scan** of existing files when it starts. You'll see all agents, messages, and tasks that already exist in the directories.

**Example**: Your agent team ran yesterday and created JSON files. Today, you start the dashboard - it will load that historical data immediately.

---

### Q: Does this work on Windows?

**A**: Yes. The server handles Windows paths correctly (backslashes are normalized to forward slashes internally).

**Gotchas**:
- Use PowerShell or Command Prompt syntax for environment variables (not Bash syntax)
- May need Visual Studio Build Tools for `better-sqlite3` (see Prerequisites)

---

### Q: Can I monitor agents on a remote machine?

**A**: Yes, if the `~/.claude/` directories are shared via network.

**Example** (Linux/macOS with NFS):
```bash
SURVEIL_TEAMS_DIR=/mnt/remote-machine/claude/teams \
SURVEIL_TASKS_DIR=/mnt/remote-machine/claude/tasks \
node index.js
```

**Example** (Windows with network drive):
```powershell
$env:SURVEIL_TEAMS_DIR="Z:\claude\teams"
$env:SURVEIL_TASKS_DIR="Z:\claude\tasks"
node index.js
```

---

### Q: How much disk space does the SQLite database use?

**A**: Very little. Each session is ~10-50 KB depending on message count. Even after hundreds of sessions, the database typically stays under 10 MB.

**Location**: `server/data/surveillance.db`

**To delete history**: Stop the server, delete the file, restart.

---

### Q: Can I export session data?

**A**: Yes, the database is SQLite format. You can open it with any SQLite browser:

- **DB Browser for SQLite**: [https://sqlitebrowser.org/](https://sqlitebrowser.org/)
- **DBeaver**: [https://dbeaver.io/](https://dbeaver.io/)
- **Command line**: `sqlite3 server/data/surveillance.db`

**Export to JSON**:
```bash
# In server/ directory
node -e "
const store = require('./lib/sqlite-store');
const s = new store();
console.log(JSON.stringify(s.listSessions(), null, 2));
s.close();
"
```

---

### Q: How do I update the dashboard?

**A**: Pull the latest code and reinstall dependencies:

```bash
cd surveil/server
git pull  # If using git
npm install
```

---

### Q: The dashboard is too dark. Can I change the theme?

**A**: Currently, the dashboard uses a fixed dark theme. To customize:

1. Open `server/public/dashboard.html` in a text editor
2. Find the `:root` CSS variables (around line 10):
   ```css
   :root {
     --bg-body: #0f1419;      /* Main background */
     --bg-card: #1a1f2e;      /* Card background */
     --text-primary: #e6edf3; /* Main text */
     /* ... more variables ... */
   }
   ```
3. Change colors to your preference
4. Save and refresh the browser (no server restart needed)

**Light theme example**:
```css
:root {
  --bg-body: #ffffff;
  --bg-card: #f9fafb;
  --text-primary: #1f2937;
}
```

---

### Q: Can I run this in production?

**A**: The dashboard is designed for local development. For production:

- Add authentication (the server has no auth)
- Use HTTPS for WebSockets (WSS)
- Run behind a reverse proxy (Nginx/Apache)
- Set up monitoring for the server itself

---

### Q: What's the performance impact of running the dashboard?

**A**: Minimal. The server uses ~50 MB of RAM and negligible CPU when idle. File watching is event-based (no polling). WebSocket connections are lightweight.

**Typical resource usage**:
- RAM: 50-100 MB
- CPU: <1% when idle, ~5% during active file changes
- Network: ~1 KB/s per connected browser (only sends updates)

---

## Next Steps

Congratulations! You now know how to:

- Install and start the surveillance dashboard
- Monitor live agent teams
- Review historical sessions
- Troubleshoot common issues

### Recommended Learning Path

1. **Start with test data** (Use Case 11) to learn the interface safely
2. **Run a simple agent team** and watch it in real-time (Use Case 1)
3. **Practice reading messages** to understand agent communication (Use Case 3)
4. **Analyze task dependencies** to understand blocking (Use Case 4)
5. **Review past sessions** to practice debugging (Use Case 6)

### Advanced Topics

- **Customize the dashboard UI**: Edit `dashboard.html` to change colors, layout, or add features
- **Query the SQLite database**: Use SQL to analyze session patterns
- **Integrate with CI/CD**: Run agents in your build pipeline and archive session data
- **Monitor multiple machines**: Share `~/.claude/` directories via NFS/SMB

### Getting Help

- **Check CLAUDE.md**: Technical architecture documentation for developers
- **Read SKILL.md**: Claude Code skill configuration
- **Search GitHub issues**: [Project repository URL]
- **Ask Claude Code**: "How do I use the agent surveillance dashboard?"

---

## Appendix A: Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + R` (Windows/Linux) | Refresh dashboard |
| `Cmd + R` (macOS) | Refresh dashboard |
| `Ctrl + Shift + R` | Hard refresh (clear cache) |
| `F12` | Open browser DevTools |
| `Ctrl + C` (in terminal) | Stop server |

---

## Appendix B: File Locations

| Item | Default Location |
|------|------------------|
| Server code | `surveil/server/index.js` |
| Dashboard HTML | `surveil/server/public/dashboard.html` |
| SQLite database | `surveil/server/data/surveillance.db` |
| Dependencies | `surveil/server/node_modules/` |
| Team data | `~/.claude/teams/` (Windows: `%USERPROFILE%\.claude\teams\`) |
| Task data | `~/.claude/tasks/` (Windows: `%USERPROFILE%\.claude\tasks\`) |
| Skill definition | `surveil/SKILL.md` |

---

## Appendix C: Environment Variable Reference

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `SURVEIL_PORT` | Number | 3847 | HTTP server port |
| `SURVEIL_TEAMS_DIR` | String | `~/.claude/teams/` | Teams directory |
| `SURVEIL_TASKS_DIR` | String | `~/.claude/tasks/` | Tasks directory |
| `NODE_ENV` | String | development | Node.js environment (development/production) |

---

## Appendix D: Message Type Reference

| Type | Badge Color | From → To | Meaning |
|------|-------------|-----------|---------|
| TASK_ASSIGNMENT | Blue | Lead → Worker | Assigning a task |
| SHUTDOWN_REQUEST | Orange | Worker → Lead | Requesting permission to shut down |
| IDLE_NOTIFICATION | Yellow | Worker → Lead | Reporting idle/interrupted state |
| SHUTDOWN_APPROVED | Green | Lead → Worker | Approving shutdown |
| TEXT | Gray | Any → Any | Plain text message |

---

## Appendix E: Task Status Reference

| Status | Column | Meaning |
|--------|--------|---------|
| pending | Pending | Not yet started |
| in_progress | In Progress | Currently being worked on |
| completed | Completed | Finished |
| (internal) | (hidden) | Internal system task (not shown) |
| (deleted) | (hidden) | Deleted task (not shown) |

---

## Appendix F: Quick Reference Commands

### Install dependencies
```bash
cd surveil/server
npm install
```

### Start dashboard (production)
```bash
node index.js
```

### Start with test data (Linux/macOS)
```bash
SURVEIL_TEAMS_DIR=../../docs/teams SURVEIL_TASKS_DIR=../../docs/tasks node index.js
```

### Start with test data (Windows PowerShell)
```powershell
$env:SURVEIL_TEAMS_DIR="../../docs/teams"; $env:SURVEIL_TASKS_DIR="../../docs/tasks"; node index.js
```

### Start on different port
```bash
SURVEIL_PORT=3848 node index.js
```

### Kill process using port (Linux/macOS)
```bash
lsof -ti:3847 | xargs kill -9
```

### Kill process using port (Windows)
```cmd
netstat -ano | findstr :3847
taskkill /PID <PID> /F
```

---

**End of User Guide**

Last updated: 2026-02-08
Version: 1.0.0
