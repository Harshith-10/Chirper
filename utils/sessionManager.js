const { v4: uuidv4 } = require("uuid");

const sessions = new Map();

function createSession(users, fileMeta) {
  const sessionId = uuidv4();
  sessions.set(sessionId, { users, fileMeta, status: 'pending' });
  return sessionId;
}

function getSession(sessionId) {
  return sessions.get(sessionId);
}

function updateSessionStatus(sessionId, status) {
  const session = sessions.get(sessionId);
  if (session) {
    session.status = status;
    sessions.set(sessionId, session);
  }
}

module.exports = {
  createSession,
  getSession,
  updateSessionStatus
};
