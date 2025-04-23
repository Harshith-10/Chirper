const { v4: uuidv4 } = require("uuid");

const sessions = new Map();
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

/**
 * Creates a new session between users for file transfer
 * @param {Array<string>} users - Array of usernames involved in the session
 * @param {Object} fileMeta - Metadata about the file being transferred
 * @returns {string} The created session ID
 */
function createSession(users, fileMeta) {
  if (!Array.isArray(users) || users.length < 2) {
    throw new Error('At least two users are required for a session');
  }
  
  if (!fileMeta || !fileMeta.name) {
    throw new Error('Valid file metadata is required');
  }
  
  const sessionId = uuidv4();
  const createdAt = Date.now();
  
  sessions.set(sessionId, { 
    users, 
    fileMeta, 
    status: 'pending',
    createdAt,
    expiresAt: createdAt + SESSION_TIMEOUT
  });
  
  // Schedule cleanup for expired sessions
  setTimeout(() => {
    cleanupSession(sessionId);
  }, SESSION_TIMEOUT);
  
  return sessionId;
}

/**
 * Retrieves a session by ID
 * @param {string} sessionId - The session ID to retrieve
 * @returns {Object|undefined} The session object or undefined if not found
 */
function getSession(sessionId) {
  const session = sessions.get(sessionId);
  
  // Check if session exists and has not expired
  if (session && Date.now() > session.expiresAt) {
    cleanupSession(sessionId);
    return undefined;
  }
  
  return session;
}

/**
 * Updates the status of a session
 * @param {string} sessionId - The session ID to update
 * @param {string} status - The new status ('pending', 'accepted', 'rejected', 'completed')
 * @returns {boolean} Whether the update was successful
 */
function updateSessionStatus(sessionId, status) {
  const session = sessions.get(sessionId);
  if (!session) return false;
  
  const validStatuses = ['pending', 'accepted', 'rejected', 'completed'];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }
  
  session.status = status;
  sessions.set(sessionId, session);
  
  // If session is completed or rejected, schedule it for cleanup
  if (['completed', 'rejected'].includes(status)) {
    setTimeout(() => {
      cleanupSession(sessionId);
    }, 5 * 60 * 1000); // Clean up after 5 minutes
  }
  
  return true;
}

/**
 * Removes a session from memory
 * @param {string} sessionId - The session ID to clean up
 */
function cleanupSession(sessionId) {
  if (sessions.has(sessionId)) {
    sessions.delete(sessionId);
    console.log(`Session ${sessionId} has been cleaned up`);
  }
}

/**
 * Gets all active sessions
 * @returns {Array<Object>} Array of session objects with their IDs
 */
function getAllActiveSessions() {
  const now = Date.now();
  const activeSessions = [];
  
  for (const [id, session] of sessions.entries()) {
    if (session.expiresAt > now) {
      activeSessions.push({ id, ...session });
    } else {
      cleanupSession(id);
    }
  }
  
  return activeSessions;
}

module.exports = {
  createSession,
  getSession,
  updateSessionStatus,
  getAllActiveSessions
};
