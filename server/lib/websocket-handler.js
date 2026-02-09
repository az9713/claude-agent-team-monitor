const WebSocket = require('ws');

/**
 * WebSocket connection manager for real-time surveillance updates
 * Handles client connections, broadcasts, and message routing
 */
class WebSocketHandler {
  constructor({ wss }) {
    if (!wss) {
      throw new Error('WebSocketServer instance is required');
    }

    this.wss = wss;
    this.clients = new Set();
    this.getStateFn = null;
    this.getHistoryFn = null;
    this.getSessionFn = null;
    this.heartbeatInterval = null;

    this._setupConnectionHandler();
    this._startHeartbeat();
  }

  /**
   * Initialize callback functions for state and data retrieval
   * @param {Function} getStateFn - Returns current state for clients
   * @param {Function} getHistoryFn - Returns session history
   * @param {Function} getSessionFn - Returns specific session data
   */
  init(getStateFn, getHistoryFn, getSessionFn) {
    this.getStateFn = getStateFn;
    this.getHistoryFn = getHistoryFn;
    this.getSessionFn = getSessionFn;
  }

  /**
   * Set up WebSocket connection event handler
   * @private
   */
  _setupConnectionHandler() {
    this.wss.on('connection', (ws) => {
      console.log('New WebSocket client connected');
      this.clients.add(ws);

      // Send initial full state to new client
      this._sendFullState(ws);

      // Handle incoming messages from client
      ws.on('message', (message) => {
        this._handleClientMessage(ws, message);
      });

      // Remove client on disconnect
      ws.on('close', () => {
        console.log('WebSocket client disconnected');
        this.clients.delete(ws);
      });

      // Handle connection errors
      ws.on('error', (error) => {
        console.error('WebSocket client error:', error.message);
        this.clients.delete(ws);
      });
    });
  }

  /**
   * Send initial full state to a newly connected client
   * @private
   * @param {WebSocket} ws - Client connection
   */
  _sendFullState(ws, teamName = null) {
    if (!this.getStateFn) {
      console.warn('getStateFn not initialized, cannot send full state');
      return;
    }

    try {
      const state = this.getStateFn(teamName);
      this._sendToClient(ws, 'full_state', state);
    } catch (error) {
      console.error('Error sending full state:', error.message);
    }
  }

  /**
   * Handle incoming messages from a client
   * @private
   * @param {WebSocket} ws - Client connection
   * @param {Buffer|String} message - Raw message data
   */
  _handleClientMessage(ws, message) {
    try {
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
    } catch (error) {
      console.error('Error handling client message:', error.message);
      // Attempt to send error response to client
      try {
        this._sendToClient(ws, 'error', {
          message: 'Failed to process message',
          error: error.message
        });
      } catch (sendError) {
        console.error('Failed to send error response:', sendError.message);
      }
    }
  }

  /**
   * Handle switch_team message
   * @private
   * @param {WebSocket} ws - Client connection
   * @param {string} teamName - Team to filter state by
   */
  _handleSwitchTeam(ws, teamName) {
    console.log('Client switching to team:', teamName);
    this._sendFullState(ws, teamName);
  }

  /**
   * Handle get_history message
   * @private
   * @param {WebSocket} ws - Client connection
   */
  _handleGetHistory(ws) {
    if (!this.getHistoryFn) {
      console.warn('getHistoryFn not initialized');
      this._sendToClient(ws, 'error', { message: 'History not available' });
      return;
    }

    try {
      const history = this.getHistoryFn();
      this._sendToClient(ws, 'history', history);
    } catch (error) {
      console.error('Error getting history:', error.message);
      this._sendToClient(ws, 'error', {
        message: 'Failed to retrieve history',
        error: error.message
      });
    }
  }

  /**
   * Handle get_session message
   * @private
   * @param {WebSocket} ws - Client connection
   * @param {string} sessionId - Session ID to retrieve
   */
  _handleGetSession(ws, sessionId) {
    if (!sessionId) {
      this._sendToClient(ws, 'error', { message: 'Session ID is required' });
      return;
    }

    if (!this.getSessionFn) {
      console.warn('getSessionFn not initialized');
      this._sendToClient(ws, 'error', { message: 'Session data not available' });
      return;
    }

    try {
      const session = this.getSessionFn(sessionId);
      this._sendToClient(ws, 'session', session);
    } catch (error) {
      console.error('Error getting session:', error.message);
      this._sendToClient(ws, 'error', {
        message: 'Failed to retrieve session',
        error: error.message
      });
    }
  }

  /**
   * Send a message to a specific client
   * @private
   * @param {WebSocket} ws - Client connection
   * @param {string} type - Message type
   * @param {*} data - Message data
   */
  _sendToClient(ws, type, data) {
    if (ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      const message = JSON.stringify({
        type,
        data,
        timestamp: Date.now()
      });
      ws.send(message);
    } catch (error) {
      console.error('Error sending to client:', error.message);
    }
  }

  /**
   * Broadcast a message to all connected clients
   * @param {string} type - Message type
   * @param {*} data - Message data
   */
  broadcast(type, data) {
    const message = JSON.stringify({
      type,
      data,
      timestamp: Date.now()
    });

    let sentCount = 0;
    let failedCount = 0;

    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
          sentCount++;
        } catch (error) {
          console.error('Error broadcasting to client:', error.message);
          failedCount++;
        }
      } else {
        // Clean up dead connections
        this.clients.delete(client);
        failedCount++;
      }
    });

    if (failedCount > 0) {
      console.log(`Broadcast sent to ${sentCount} clients, ${failedCount} failed`);
    }
  }

  /**
   * Broadcast a team update event to all clients
   * @param {string} teamName - Name of the team that changed
   * @param {string} changeType - Type of change (e.g., 'member_added', 'member_removed')
   * @param {*} changeData - Data associated with the change
   */
  broadcastTeamUpdate(teamName, changeType, changeData) {
    this.broadcast('team_update', {
      teamName,
      changeType,
      changeData
    });
  }

  /**
   * Get the number of currently connected clients
   * @returns {number} Number of connected clients
   */
  getClientCount() {
    // Clean up any dead connections before counting
    this.clients.forEach((client) => {
      if (client.readyState !== WebSocket.OPEN) {
        this.clients.delete(client);
      }
    });

    return this.clients.size;
  }

  /**
   * Start heartbeat interval to keep connections alive
   * @private
   */
  _startHeartbeat() {
    // Clear any existing interval
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Send heartbeat every 5 seconds
    this.heartbeatInterval = setInterval(() => {
      const clientCount = this.getClientCount();
      this.broadcast('heartbeat', { clients: clientCount });
    }, 5000);
  }

  /**
   * Stop heartbeat interval and close all connections
   * Call this during server shutdown
   */
  shutdown() {
    console.log('Shutting down WebSocket handler');

    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Close all client connections
    this.clients.forEach((client) => {
      try {
        client.close(1000, 'Server shutting down');
      } catch (error) {
        console.error('Error closing client connection:', error.message);
      }
    });

    this.clients.clear();
  }
}

module.exports = WebSocketHandler;
