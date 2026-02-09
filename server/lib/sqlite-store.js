const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

/**
 * SQLite-based session history store for surveillance system.
 * Persists team sessions, members, messages, and tasks.
 */
class SQLiteStore {
  constructor(options = {}) {
    const defaultPath = path.join(__dirname, '..', 'data', 'surveillance.db');
    this.dbPath = options.dbPath || defaultPath;

    // Ensure data directory exists
    const dataDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Initialize database connection
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL'); // Better concurrent access

    // Initialize schema
    this._initSchema();

    // Prepare statements for performance
    this._prepareStatements();
  }

  /**
   * Create database tables if they don't exist
   */
  _initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        team_name TEXT NOT NULL,
        description TEXT,
        lead_agent_id TEXT,
        created_at INTEGER NOT NULL,
        ended_at INTEGER,
        config_snapshot TEXT NOT NULL,
        UNIQUE(team_name, created_at)
      );

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

      CREATE TABLE IF NOT EXISTS session_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER REFERENCES sessions(id),
        inbox_owner TEXT,
        from_agent TEXT,
        message_type TEXT,
        raw_text TEXT,
        parsed_json TEXT,
        summary TEXT,
        color TEXT,
        is_read INTEGER DEFAULT 0,
        timestamp TEXT,
        UNIQUE(session_id, inbox_owner, from_agent, timestamp)
      );

      CREATE TABLE IF NOT EXISTS session_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER REFERENCES sessions(id),
        task_id TEXT,
        subject TEXT,
        description TEXT,
        active_form TEXT,
        status TEXT,
        owner TEXT,
        blocks TEXT,
        blocked_by TEXT,
        is_internal INTEGER DEFAULT 0,
        UNIQUE(session_id, task_id)
      );
    `);
  }

  /**
   * Prepare SQL statements for better performance
   */
  _prepareStatements() {
    this.stmts = {
      findSession: this.db.prepare(`
        SELECT * FROM sessions
        WHERE team_name = ? AND created_at = ?
      `),

      insertSession: this.db.prepare(`
        INSERT OR IGNORE INTO sessions
        (team_name, description, lead_agent_id, created_at, config_snapshot)
        VALUES (?, ?, ?, ?, ?)
      `),

      insertMember: this.db.prepare(`
        INSERT OR IGNORE INTO session_members
        (session_id, agent_id, name, agent_type, model, color, joined_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `),

      insertMessage: this.db.prepare(`
        INSERT OR IGNORE INTO session_messages
        (session_id, inbox_owner, from_agent, message_type, raw_text,
         parsed_json, summary, color, is_read, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),

      upsertTask: this.db.prepare(`
        INSERT OR REPLACE INTO session_tasks
        (session_id, task_id, subject, description, active_form, status,
         owner, blocks, blocked_by, is_internal)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),

      updateSessionEnd: this.db.prepare(`
        UPDATE sessions SET ended_at = ? WHERE id = ?
      `),

      listSessions: this.db.prepare(`
        SELECT * FROM sessions ORDER BY created_at DESC
      `),

      getSession: this.db.prepare(`
        SELECT * FROM sessions WHERE id = ?
      `),

      getMembers: this.db.prepare(`
        SELECT * FROM session_members WHERE session_id = ?
      `),

      getMessages: this.db.prepare(`
        SELECT * FROM session_messages WHERE session_id = ? ORDER BY timestamp
      `),

      getTasks: this.db.prepare(`
        SELECT * FROM session_tasks WHERE session_id = ?
      `)
    };
  }

  /**
   * Create or find session by team_name and created_at
   * @param {Object} teamConfig - Team configuration object
   * @returns {number} Session ID
   */
  upsertSession(teamConfig) {
    const createdAt = teamConfig.createdAt || Date.now();
    const teamName = teamConfig.name || teamConfig.teamName || 'Unnamed Team';
    const description = teamConfig.description || null;
    const leadAgentId = teamConfig.leadAgentId || null;
    const configSnapshot = JSON.stringify(teamConfig);

    // Try to find existing session
    const existing = this.stmts.findSession.get(teamName, createdAt);
    if (existing) {
      return existing.id;
    }

    // Insert new session
    const result = this.stmts.insertSession.run(
      teamName,
      description,
      leadAgentId,
      createdAt,
      configSnapshot
    );

    // If INSERT OR IGNORE didn't insert (race condition), fetch the existing one
    if (result.changes === 0) {
      const session = this.stmts.findSession.get(teamName, createdAt);
      return session.id;
    }

    return result.lastInsertRowid;
  }

  /**
   * Insert team members for a session (skip duplicates)
   * @param {number} sessionId - Session ID
   * @param {Array} members - Array of member objects
   */
  upsertMembers(sessionId, members) {
    if (!Array.isArray(members) || members.length === 0) {
      return;
    }

    const insertMany = this.db.transaction((members) => {
      for (const member of members) {
        this.stmts.insertMember.run(
          sessionId,
          member.agentId || null,
          member.name || null,
          member.agentType || null,
          member.model || null,
          member.color || null,
          member.joinedAt || Date.now()
        );
      }
    });

    insertMany(members);
  }

  /**
   * Insert a message (skip duplicates)
   * @param {number} sessionId - Session ID
   * @param {Object} message - Message object
   */
  upsertMessage(sessionId, message) {
    if (!message) {
      return;
    }

    this.stmts.insertMessage.run(
      sessionId,
      message.inboxOwner || null,
      message.from || null,
      message.messageType || null,
      message.rawText || null,
      message.parsedJson ? JSON.stringify(message.parsedJson) : null,
      message.summary || null,
      message.color || null,
      message.isRead ? 1 : 0,
      message.timestamp || new Date().toISOString()
    );
  }

  /**
   * Insert or replace a task
   * @param {number} sessionId - Session ID
   * @param {Object} task - Task object
   */
  upsertTask(sessionId, task) {
    if (!task || !task.taskId) {
      return;
    }

    this.stmts.upsertTask.run(
      sessionId,
      task.taskId,
      task.subject || null,
      task.description || null,
      task.activeForm || null,
      task.status || null,
      task.owner || null,
      task.blocks ? JSON.stringify(task.blocks) : null,
      task.blockedBy ? JSON.stringify(task.blockedBy) : null,
      task.isInternal ? 1 : 0
    );
  }

  /**
   * Mark session as ended
   * @param {number} sessionId - Session ID
   * @param {number} endedAt - Timestamp when session ended
   */
  endSession(sessionId, endedAt = Date.now()) {
    this.stmts.updateSessionEnd.run(endedAt, sessionId);
  }

  /**
   * List all sessions ordered by created_at DESC
   * @returns {Array} Array of session objects
   */
  listSessions() {
    return this.stmts.listSessions.all();
  }

  /**
   * Get a complete session with all related data
   * @param {number} sessionId - Session ID
   * @returns {Object|null} Session object with members, messages, and tasks
   */
  getSession(sessionId) {
    const session = this.stmts.getSession.get(sessionId);
    if (!session) {
      return null;
    }

    // Parse config snapshot
    try {
      session.config = JSON.parse(session.config_snapshot);
    } catch (error) {
      console.error('Failed to parse config snapshot:', error);
      session.config = null;
    }

    // Fetch related data
    session.members = this.stmts.getMembers.all(sessionId);

    session.messages = this.stmts.getMessages.all(sessionId).map(msg => {
      // Parse JSON fields
      if (msg.parsed_json) {
        try {
          msg.parsedJson = JSON.parse(msg.parsed_json);
        } catch (error) {
          console.error('Failed to parse message JSON:', error);
          msg.parsedJson = null;
        }
      }
      msg.isRead = Boolean(msg.is_read);
      return msg;
    });

    session.tasks = this.stmts.getTasks.all(sessionId).map(task => {
      // Parse JSON array fields
      if (task.blocks) {
        try {
          task.blocks = JSON.parse(task.blocks);
        } catch (error) {
          console.error('Failed to parse task blocks:', error);
          task.blocks = [];
        }
      }
      if (task.blocked_by) {
        try {
          task.blockedBy = JSON.parse(task.blocked_by);
        } catch (error) {
          console.error('Failed to parse task blockedBy:', error);
          task.blockedBy = [];
        }
      }
      task.isInternal = Boolean(task.is_internal);
      return task;
    });

    return session;
  }

  /**
   * Close database connection
   */
  close() {
    this.db.close();
  }
}

module.exports = SQLiteStore;
