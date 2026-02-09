const EventEmitter = require('events');
const chokidar = require('chokidar');
const path = require('path');
const os = require('os');
const fs = require('fs').promises;

/**
 * FileWatcher monitors Claude Code agent team files and emits events on changes
 *
 * Emits:
 * - 'team-config-changed' with { teamName, filePath }
 * - 'inbox-changed' with { teamName, agentName, filePath }
 * - 'task-changed' with { teamName, taskId, filePath }
 */
class FileWatcher extends EventEmitter {
  constructor(options = {}) {
    super();

    // Resolve default directories with tilde expansion
    const homeDir = os.homedir();
    this.teamsDir = options.teamsDir || path.join(homeDir, '.claude', 'teams');
    this.tasksDir = options.tasksDir || path.join(homeDir, '.claude', 'tasks');

    this.watcher = null;
    this.debounceTimers = new Map();
    this.debounceDelay = 100; // Windows fires double events

    // Track if we've completed initial scan
    this.initialScanComplete = false;
  }

  /**
   * Start watching for file changes
   */
  async start() {
    if (this.watcher) {
      console.warn('FileWatcher already started');
      return;
    }

    try {
      // Perform initial scan of existing files
      await this._performInitialScan();

      // Watch directories (chokidar v4 works best with directory watching)
      const watchPaths = [this.teamsDir, this.tasksDir];
      console.log('Watching directories:', watchPaths);

      // Initialize chokidar watcher
      this.watcher = chokidar.watch(watchPaths, {
        persistent: true,
        ignoreInitial: true  // We handle initial scan ourselves
      });

      // Set up event handlers
      this.watcher
        .on('add', (filePath) => this._handleFileChange(filePath))
        .on('change', (filePath) => this._handleFileChange(filePath))
        .on('unlink', (filePath) => this._handleFileChange(filePath))
        .on('error', (error) => {
          console.error('FileWatcher error:', error.message);
        });

      this.initialScanComplete = true;
      console.log('FileWatcher started successfully');
    } catch (error) {
      console.error('Failed to start FileWatcher:', error.message);
      throw error;
    }
  }

  /**
   * Stop watching for file changes
   */
  async stop() {
    if (!this.watcher) {
      return;
    }

    try {
      // Clear all pending debounce timers
      for (const timer of this.debounceTimers.values()) {
        clearTimeout(timer);
      }
      this.debounceTimers.clear();

      await this.watcher.close();
      this.watcher = null;
      this.initialScanComplete = false;
      console.log('FileWatcher stopped');
    } catch (error) {
      console.error('Error stopping FileWatcher:', error.message);
    }
  }

  /**
   * Perform initial scan of existing files and emit events
   */
  async _performInitialScan() {
    try {
      // Scan team configs
      await this._scanTeamConfigs();

      // Scan inboxes
      await this._scanInboxes();

      // Scan tasks
      await this._scanTasks();
    } catch (error) {
      console.error('Error during initial scan:', error.message);
      // Don't throw - continue with partial scan
    }
  }

  /**
   * Scan all team config files
   */
  async _scanTeamConfigs() {
    try {
      const teamDirs = await this._readDirectory(this.teamsDir);

      for (const teamName of teamDirs) {
        const configPath = path.join(this.teamsDir, teamName, 'config.json');

        try {
          await fs.access(configPath);
          this._emitTeamConfigChanged(configPath);
        } catch (error) {
          // File doesn't exist, skip
        }
      }
    } catch (error) {
      // teamsDir doesn't exist yet, skip
    }
  }

  /**
   * Scan all inbox files
   */
  async _scanInboxes() {
    try {
      const teamDirs = await this._readDirectory(this.teamsDir);

      for (const teamName of teamDirs) {
        const inboxesDir = path.join(this.teamsDir, teamName, 'inboxes');

        try {
          const inboxFiles = await this._readFiles(inboxesDir);

          for (const fileName of inboxFiles) {
            if (fileName.endsWith('.json')) {
              const inboxPath = path.join(inboxesDir, fileName);
              this._emitInboxChanged(inboxPath);
            }
          }
        } catch (error) {
          // inboxes directory doesn't exist, skip
        }
      }
    } catch (error) {
      // teamsDir doesn't exist yet, skip
    }
  }

  /**
   * Scan all task files
   */
  async _scanTasks() {
    try {
      const teamDirs = await this._readDirectory(this.tasksDir);

      for (const teamName of teamDirs) {
        const teamTasksDir = path.join(this.tasksDir, teamName);

        try {
          const taskFiles = await this._readFiles(teamTasksDir);

          for (const fileName of taskFiles) {
            if (fileName.endsWith('.json')) {
              const taskPath = path.join(teamTasksDir, fileName);
              this._emitTaskChanged(taskPath);
            }
          }
        } catch (error) {
          // Team tasks directory doesn't exist, skip
        }
      }
    } catch (error) {
      // tasksDir doesn't exist yet, skip
    }
  }

  /**
   * Read directory and return list of subdirectory entries, handling errors gracefully
   */
  async _readDirectory(dirPath) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      return entries
        .filter(e => e.isDirectory())
        .map(e => e.name);
    } catch (error) {
      return [];
    }
  }

  /**
   * Read directory and return list of file entries
   */
  async _readFiles(dirPath) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      return entries
        .filter(e => e.isFile())
        .map(e => e.name);
    } catch (error) {
      return [];
    }
  }

  /**
   * Handle file change with debouncing
   */
  _handleFileChange(filePath) {
    // Only process JSON files
    if (!filePath.endsWith('.json')) return;

    // Normalize path to handle both Windows and Unix separators
    const normalizedPath = path.normalize(filePath);

    // Clear existing debounce timer for this file
    if (this.debounceTimers.has(normalizedPath)) {
      clearTimeout(this.debounceTimers.get(normalizedPath));
    }

    // Set new debounce timer
    const timer = setTimeout(() => {
      this.debounceTimers.delete(normalizedPath);
      this._processFileChange(normalizedPath);
    }, this.debounceDelay);

    this.debounceTimers.set(normalizedPath, timer);
  }

  /**
   * Process file change and emit appropriate event
   */
  _processFileChange(filePath) {
    try {
      // Determine file type and emit appropriate event
      if (this._isTeamConfig(filePath)) {
        this._emitTeamConfigChanged(filePath);
      } else if (this._isInboxFile(filePath)) {
        this._emitInboxChanged(filePath);
      } else if (this._isTaskFile(filePath)) {
        this._emitTaskChanged(filePath);
      }
    } catch (error) {
      console.error(`Error processing file change for ${filePath}:`, error.message);
    }
  }

  /**
   * Check if file is a team config
   */
  _isTeamConfig(filePath) {
    const normalized = this._normalizePath(filePath);
    const teamsDir = this._normalizePath(this.teamsDir);

    if (!normalized.startsWith(teamsDir)) {
      return false;
    }

    return normalized.endsWith(this._normalizePath('config.json')) &&
           !normalized.includes(this._normalizePath('inboxes'));
  }

  /**
   * Check if file is an inbox file
   */
  _isInboxFile(filePath) {
    const normalized = this._normalizePath(filePath);
    const teamsDir = this._normalizePath(this.teamsDir);

    return normalized.startsWith(teamsDir) &&
           normalized.includes(this._normalizePath('inboxes')) &&
           normalized.endsWith('.json');
  }

  /**
   * Check if file is a task file
   */
  _isTaskFile(filePath) {
    const normalized = this._normalizePath(filePath);
    const tasksDir = this._normalizePath(this.tasksDir);

    return normalized.startsWith(tasksDir) && normalized.endsWith('.json');
  }

  /**
   * Emit team-config-changed event
   */
  _emitTeamConfigChanged(filePath) {
    const teamName = this._extractTeamNameFromConfig(filePath);

    if (teamName) {
      this.emit('team-config-changed', {
        teamName,
        filePath
      });
    }
  }

  /**
   * Emit inbox-changed event
   */
  _emitInboxChanged(filePath) {
    const { teamName, agentName } = this._extractInboxInfo(filePath);

    if (teamName && agentName) {
      this.emit('inbox-changed', {
        teamName,
        agentName,
        filePath
      });
    }
  }

  /**
   * Emit task-changed event
   */
  _emitTaskChanged(filePath) {
    const { teamName, taskId } = this._extractTaskInfo(filePath);

    if (teamName && taskId) {
      this.emit('task-changed', {
        teamName,
        taskId,
        filePath
      });
    }
  }

  /**
   * Extract team name from config file path
   * Example: C:\Users\...\.claude\teams\my-team\config.json -> "my-team"
   */
  _extractTeamNameFromConfig(filePath) {
    try {
      const normalized = this._normalizePath(filePath);
      const teamsDir = this._normalizePath(this.teamsDir);

      const relativePath = normalized.substring(teamsDir.length + 1);
      const parts = relativePath.split('/');

      return parts[0] || null;
    } catch (error) {
      console.error('Error extracting team name from config:', error.message);
      return null;
    }
  }

  /**
   * Extract team name and agent name from inbox file path
   * Example: C:\Users\...\.claude\teams\my-team\inboxes\agent-1.json
   * Returns: { teamName: "my-team", agentName: "agent-1" }
   */
  _extractInboxInfo(filePath) {
    try {
      const normalized = this._normalizePath(filePath);
      const teamsDir = this._normalizePath(this.teamsDir);

      const relativePath = normalized.substring(teamsDir.length + 1);
      const parts = relativePath.split('/');

      // parts should be: [teamName, 'inboxes', 'agent-name.json']
      if (parts.length >= 3) {
        const teamName = parts[0];
        const fileName = parts[2];
        const agentName = fileName.replace('.json', '');

        return { teamName, agentName };
      }

      return { teamName: null, agentName: null };
    } catch (error) {
      console.error('Error extracting inbox info:', error.message);
      return { teamName: null, agentName: null };
    }
  }

  /**
   * Extract team name and task ID from task file path
   * Example: C:\Users\...\.claude\tasks\my-team\task-123.json
   * Returns: { teamName: "my-team", taskId: "task-123" }
   */
  _extractTaskInfo(filePath) {
    try {
      const normalized = this._normalizePath(filePath);
      const tasksDir = this._normalizePath(this.tasksDir);

      const relativePath = normalized.substring(tasksDir.length + 1);
      const parts = relativePath.split('/');

      // parts should be: [teamName, 'task-id.json']
      if (parts.length >= 2) {
        const teamName = parts[0];
        const fileName = parts[1];
        const taskId = fileName.replace('.json', '');

        return { teamName, taskId };
      }

      return { teamName: null, taskId: null };
    } catch (error) {
      console.error('Error extracting task info:', error.message);
      return { teamName: null, taskId: null };
    }
  }

  /**
   * Normalize path to use forward slashes (handles Windows and Unix)
   */
  _normalizePath(filePath) {
    return filePath.split(path.sep).join('/');
  }
}

module.exports = FileWatcher;
