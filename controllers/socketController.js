const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');
const { createSession, getSession, updateSessionStatus } = require('../utils/sessionManager');

const users = new Map(); // username -> { socketId, passwordHash, status, role }

function socketController(io) {
  io.on('connection', (socket) => {
    let currentUser = null;

    console.log(`New client connected: ${socket.id}`);
    socket.emit('server-message', '✅ Signaling server is up and running!');

    socket.on('register', async ({ username, password, role }) => {
      if (users.has(username)) {
        socket.emit('register-failed', 'Username already taken');
        return;
      }
      const passwordHash = await bcrypt.hash(password, 10);
      users.set(username, { socketId: socket.id, passwordHash, status: 'online', role });
      currentUser = username;
      socket.emit('register-success', username);
      broadcastUserList(io);
    });

    socket.on('login', async ({ username, password }) => {
      const user = users.get(username);
      if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        socket.emit('login-failed', 'Invalid credentials');
        return;
      }
      user.socketId = socket.id;
      user.status = 'online';
      currentUser = username;
      socket.emit('login-success', username);
      broadcastUserList(io);
    });

    socket.on('file-send-request', ({ to, fileMeta }) => {
      if (!users.has(to)) return;
      const sessionId = createSession([currentUser, to], fileMeta);
      const recipient = users.get(to);
      io.to(recipient.socketId).emit('file-send-request', { from: currentUser, fileMeta, sessionId });
    });

    socket.on('file-send-response', ({ sessionId, accept }) => {
      const session = getSession(sessionId);
      if (!session || !session.users.includes(currentUser)) return;
      updateSessionStatus(sessionId, accept ? 'accepted' : 'rejected');
      session.users.forEach((user) => {
        const userData = users.get(user);
        if (userData) {
          io.to(userData.socketId).emit('file-send-response', { sessionId, accept });
        }
      });
    });

    socket.on('file-transfer-progress', ({ sessionId, progress }) => {
      const session = getSession(sessionId);
      if (!session || !session.users.includes(currentUser)) return;
      session.users.forEach((user) => {
        if (user !== currentUser) {
          const userData = users.get(user);
          if (userData) {
            io.to(userData.socketId).emit('file-transfer-progress', { sessionId, progress });
          }
        }
      });
    });

    socket.on('disconnect', () => {
      if (currentUser && users.has(currentUser)) {
        const user = users.get(currentUser);
        user.status = 'offline';
        broadcastUserList(io);
        io.emit('user-disconnected', currentUser);
      }
    });
  });
}

function broadcastUserList(io) {
  const userList = Array.from(users.entries()).map(([username, { role, status }]) => ({
    username,
    role,
    status
  }));
  io.emit('user-list', userList);
}

module.exports = socketController;
