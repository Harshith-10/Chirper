const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');
const { createSession, getSession, updateSessionStatus } = require('../utils/sessionManager');
const { validate, schemas } = require('../utils/validation');

const users = new Map(); // username -> { socketId, passwordHash, status, role }

function socketController(io) {
  io.on('connection', (socket) => {
    let currentUser = null;

    console.log(`New client connected: ${socket.id}`);
    socket.emit('server-message', '✅ Signaling server is up and running!');

    socket.on('register', async (data) => {
      try {
        const validation = validate(schemas.userRegistrationSchema, data);
        if (!validation.success) {
          socket.emit('register-failed', `Validation error: ${JSON.stringify(validation.error)}`);
          return;
        }
        
        const { username, password, role } = validation.data;
        
        if (users.has(username)) {
          socket.emit('register-failed', 'Username already taken');
          return;
        }
        const passwordHash = await bcrypt.hash(password, 10);
        users.set(username, { socketId: socket.id, passwordHash, status: 'online', role });
        currentUser = username;
        
        // Generate JWT token
        const token = jwt.sign({ username, role }, JWT_SECRET, { expiresIn: '24h' });
        
        socket.emit('register-success', { username, token });
        broadcastUserList(io);
      } catch (error) {
        console.error('Register error:', error);
        socket.emit('register-failed', 'Registration failed due to server error');
      }
    });

    socket.on('login', async (data) => {
      try {
        const validation = validate(schemas.userLoginSchema, data);
        if (!validation.success) {
          socket.emit('login-failed', `Validation error: ${JSON.stringify(validation.error)}`);
          return;
        }
        
        const { username, password } = validation.data;
        
        const user = users.get(username);
        if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
          socket.emit('login-failed', 'Invalid credentials');
          return;
        }
        user.socketId = socket.id;
        user.status = 'online';
        currentUser = username;
        
        // Generate JWT token
        const token = jwt.sign({ username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        
        socket.emit('login-success', { username, token });
        broadcastUserList(io);
      } catch (error) {
        console.error('Login error:', error);
        socket.emit('login-failed', 'Login failed due to server error');
      }
    });

    socket.on('file-send-request', (data) => {
      try {
        if (!currentUser) {
          socket.emit('error', 'Not authenticated');
          return;
        }
        
        const validation = validate(schemas.fileTransferRequestSchema, data);
        if (!validation.success) {
          socket.emit('error', `Validation error: ${JSON.stringify(validation.error)}`);
          return;
        }
        
        const { to, fileMeta } = validation.data;
        
        if (!users.has(to)) {
          socket.emit('error', 'User not found');
          return;
        }
        
        try {
          const sessionId = createSession([currentUser, to], fileMeta);
          const recipient = users.get(to);
          io.to(recipient.socketId).emit('file-send-request', { from: currentUser, fileMeta, sessionId });
        } catch (err) {
          socket.emit('error', err.message);
        }
      } catch (error) {
        console.error('File send request error:', error);
        socket.emit('error', 'Failed to send file request');
      }
    });

    socket.on('file-send-response', (data) => {
      try {
        if (!currentUser) {
          socket.emit('error', 'Not authenticated');
          return;
        }
        
        const validation = validate(schemas.fileTransferResponseSchema, data);
        if (!validation.success) {
          socket.emit('error', `Validation error: ${JSON.stringify(validation.error)}`);
          return;
        }
        
        const { sessionId, accept } = validation.data;
        
        const session = getSession(sessionId);
        if (!session || !session.users.includes(currentUser)) {
          socket.emit('error', 'Invalid session');
          return;
        }
        
        try {
          updateSessionStatus(sessionId, accept ? 'accepted' : 'rejected');
          session.users.forEach((user) => {
            const userData = users.get(user);
            if (userData) {
              io.to(userData.socketId).emit('file-send-response', { sessionId, accept });
            }
          });
        } catch (err) {
          socket.emit('error', err.message);
        }
      } catch (error) {
        console.error('File send response error:', error);
        socket.emit('error', 'Failed to process file send response');
      }
    });

    socket.on('file-transfer-progress', (data) => {
      try {
        if (!currentUser) {
          socket.emit('error', 'Not authenticated');
          return;
        }
        
        const validation = validate(schemas.fileTransferProgressSchema, data);
        if (!validation.success) {
          socket.emit('error', `Validation error: ${JSON.stringify(validation.error)}`);
          return;
        }
        
        const { sessionId, progress } = validation.data;
        
        const session = getSession(sessionId);
        if (!session || !session.users.includes(currentUser)) {
          socket.emit('error', 'Invalid session');
          return;
        }
        
        session.users.forEach((user) => {
          if (user !== currentUser) {
            const userData = users.get(user);
            if (userData) {
              io.to(userData.socketId).emit('file-transfer-progress', { sessionId, progress });
            }
          }
        });
      } catch (error) {
        console.error('File transfer progress error:', error);
        socket.emit('error', 'Failed to update file transfer progress');
      }
    });

    socket.on('disconnect', () => {
      try {
        if (currentUser && users.has(currentUser)) {
          const user = users.get(currentUser);
          user.status = 'offline';
          broadcastUserList(io);
          io.emit('user-disconnected', currentUser);
        }
      } catch (error) {
        console.error('Disconnect error:', error);
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
