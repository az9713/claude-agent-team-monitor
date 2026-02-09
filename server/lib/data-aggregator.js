const fs = require('fs');

/**
 * DataAggregator manages unified state for Claude Code agent teams.
 * Aggregates team configs, inboxes, and tasks from file system.
 */
class DataAggregator {
  constructor() {
    this.state = {
      teams: {},
      activeTeam: null
    };
  }

  /**
   * Updates team configuration from config.json file
   * @param {string} teamName - Name of the team
   * @param {string} filePath - Path to config.json file
   */
  updateTeamConfig(teamName, filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const config = JSON.parse(content);

      // Initialize team if it doesn't exist
      if (!this.state.teams[teamName]) {
        this.state.teams[teamName] = {
          config: {},
          inboxes: {},
          tasks: {}
        };
      }

      this.state.teams[teamName].config = config;
      this.state.activeTeam = teamName;
    } catch (error) {
      console.warn(`Failed to update team config for ${teamName}:`, error.message);
    }
  }

  /**
   * Updates inbox messages for an agent
   * @param {string} teamName - Name of the team
   * @param {string} agentName - Name of the agent (inbox owner)
   * @param {string} filePath - Path to inbox JSON file
   */
  updateInbox(teamName, agentName, filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const messages = JSON.parse(content);

      // Initialize team if it doesn't exist
      if (!this.state.teams[teamName]) {
        this.state.teams[teamName] = {
          config: {},
          inboxes: {},
          tasks: {}
        };
      }

      // Parse and enrich each message
      const parsedMessages = messages.map(msg => {
        const enrichedMsg = {
          ...msg,
          to: agentName,
          messageType: 'text',
          parsedContent: null
        };

        // Try to parse the text field as JSON
        if (msg.text) {
          try {
            const parsed = JSON.parse(msg.text);
            if (parsed && typeof parsed === 'object' && parsed.type) {
              enrichedMsg.parsedContent = parsed;
              enrichedMsg.messageType = parsed.type;
            }
          } catch (parseError) {
            // Text is not JSON, keep as plain text
          }
        }

        return enrichedMsg;
      });

      this.state.teams[teamName].inboxes[agentName] = parsedMessages;
      this.state.activeTeam = teamName;
    } catch (error) {
      console.warn(`Failed to update inbox for ${teamName}/${agentName}:`, error.message);
    }
  }

  /**
   * Updates a task from task JSON file
   * @param {string} teamName - Name of the team
   * @param {string} taskId - ID of the task
   * @param {string} filePath - Path to task JSON file
   */
  updateTask(teamName, taskId, filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const task = JSON.parse(content);

      // Initialize team if it doesn't exist
      if (!this.state.teams[teamName]) {
        this.state.teams[teamName] = {
          config: {},
          inboxes: {},
          tasks: {}
        };
      }

      // Add internal flag if metadata indicates internal task
      if (task.metadata && task.metadata._internal === true) {
        task.isInternal = true;
      }

      this.state.teams[teamName].tasks[taskId] = task;
      this.state.activeTeam = teamName;
    } catch (error) {
      console.warn(`Failed to update task ${taskId} for ${teamName}:`, error.message);
    }
  }

  /**
   * Returns the current aggregated state
   * @returns {object} Current state with teams and activeTeam
   */
  getState() {
    return this.state;
  }

  /**
   * Returns list of all team names
   * @returns {string[]} Array of team names
   */
  getTeamNames() {
    return Object.keys(this.state.teams);
  }

  /**
   * Returns all messages across all inboxes for a team, merged chronologically
   * @param {string} teamName - Name of the team
   * @returns {object[]} Array of messages sorted by timestamp
   */
  getMessages(teamName) {
    const team = this.state.teams[teamName];
    if (!team) {
      return [];
    }

    // Collect all messages from all inboxes
    const allMessages = [];
    for (const [agentName, messages] of Object.entries(team.inboxes)) {
      allMessages.push(...messages);
    }

    // Sort chronologically by timestamp
    allMessages.sort((a, b) => {
      const timeA = new Date(a.timestamp || 0).getTime();
      const timeB = new Date(b.timestamp || 0).getTime();
      return timeA - timeB;
    });

    return allMessages;
  }
}

module.exports = DataAggregator;
