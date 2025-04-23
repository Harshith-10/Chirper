const { Server } = require("socket.io");
const http = require("http");
const express = require("express");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const users = {}; // username -> { socketId, password, status, role }
const sessions = {}; // sessionId -> { users: [], fileMeta: {}, status }

function generateSessionId() {
  return Math.random().toString(36).substr(2, 9);
}

io.on("connection", (socket) => {
  let username = null;

  console.log(`New client connected: ${socket.id}`);

  socket.emit("server-message", "✅ Signaling server is up and running!");

  // User registration with password (demo only, not secure)
  socket.on("register", ({ name, password, role }) => {
    if (users[name]) {
      socket.emit("register-failed", "Username already taken");
      return;
    }
    username = name;
    users[username] = { socketId: socket.id, password, status: "online", role };
    // Filter users based on role
    const filteredUsers = Object.keys(users)
      .filter(u => u !== username)
      .map(username => ({ 
        username,
        role: users[username].role 
      }))
      .filter(user => {
        const currentRole = users[username].role;
        return currentRole === 'sender' ? user.role === 'receiver' :
               currentRole === 'receiver' ? user.role === 'sender' :
               false;
      });
    io.emit("user-list", filteredUsers);
    socket.emit("register-success", username);
  });

  // User login
  socket.on("login", ({ name, password, role }) => {
    if (!users[name] || users[name].password !== password) {
      socket.emit("login-failed", "Invalid credentials");
      return;
    }
    username = name;
    users[username].socketId = socket.id;
    users[username].status = "online";
    users[username].role = role;
    // Filter users based on role
    const filteredUsers = Object.keys(users)
      .filter(u => u !== username)
      .map(username => ({ 
        username,
        role: users[username].role 
      }))
      .filter(user => {
        const currentRole = users[username].role;
        return currentRole === 'sender' ? user.role === 'receiver' :
               currentRole === 'receiver' ? user.role === 'sender' :
               false;
      });
    io.emit("user-list", filteredUsers);
    socket.emit("login-success", username);
  });

  // User presence update
  socket.on("update-status", (status) => {
    if (username && users[username]) {
      users[username].status = status;
      io.emit("user-status", { user: username, status });
    }
  });

  // File send request signaling
  socket.on("file-send-request", ({ to, fileMeta }) => {
    if (users[to]) {
      const sessionId = generateSessionId();
      sessions[sessionId] = { users: [username, to], fileMeta, status: "pending" };
      io.to(users[to].socketId).emit("file-send-request", { from: username, fileMeta, sessionId });
    }
  });

  // File send response (accept/reject)
  socket.on("file-send-response", ({ sessionId, accept }) => {
    const session = sessions[sessionId];
    if (session && session.users.includes(username)) {
      session.status = accept ? "accepted" : "rejected";
      session.users.forEach(user => {
        if (users[user]) {
          io.to(users[user].socketId).emit("file-send-response", { sessionId, accept });
        }
      });
    }
  });

  // File transfer progress signaling
  socket.on("file-transfer-progress", ({ sessionId, progress }) => {
    const session = sessions[sessionId];
    if (session && session.users.includes(username)) {
      session.users.forEach(user => {
        if (users[user] && user !== username) {
          io.to(users[user].socketId).emit("file-transfer-progress", { sessionId, progress });
        }
      });
    }
  });

  // File transfer error/cancel signaling
  socket.on("file-transfer-error", ({ sessionId, error }) => {
    const session = sessions[sessionId];
    if (session && session.users.includes(username)) {
      session.status = "error";
      session.users.forEach(user => {
        if (users[user]) {
          io.to(users[user].socketId).emit("file-transfer-error", { sessionId, error });
        }
      });
    }
  });
  socket.on("file-transfer-cancel", ({ sessionId }) => {
    const session = sessions[sessionId];
    if (session && session.users.includes(username)) {
      session.status = "cancelled";
      session.users.forEach(user => {
        if (users[user]) {
          io.to(users[user].socketId).emit("file-transfer-cancel", { sessionId });
        }
      });
    }
  });

  // Group/multi-peer signaling (demo: broadcast file offer)
  socket.on("group-file-offer", ({ toUsers, fileMeta }) => {
    const sessionId = generateSessionId();
    sessions[sessionId] = { users: [username, ...toUsers], fileMeta, status: "pending" };
    toUsers.forEach(user => {
      if (users[user]) {
        io.to(users[user].socketId).emit("group-file-offer", { from: username, fileMeta, sessionId });
      }
    });
  });

  // Existing offer/answer/ice logic
  socket.on("offer", ({ to, offer }) => {
    if (users[to]) {
      io.to(users[to].socketId).emit("offer", { from: username, offer });
    }
  });
  socket.on("answer", ({ to, answer }) => {
    if (users[to]) {
      io.to(users[to].socketId).emit("answer", { from: username, answer });
    }
  });
  socket.on("ice", ({ to, candidate }) => {
    if (users[to]) {
      io.to(users[to].socketId).emit("ice", { from: username, candidate });
    }
  });

  socket.on("disconnect", () => {
    if (username && users[username]) {
      users[username].status = "offline";
      io.emit("user-disconnected", username);
      // Filter users based on role
    const filteredUsers = Object.keys(users)
      .filter(u => u !== username)
      .map(username => ({ 
        username,
        role: users[username].role 
      }))
      .filter(user => {
        const currentRole = users[username].role;
        return currentRole === 'sender' ? user.role === 'receiver' :
               currentRole === 'receiver' ? user.role === 'sender' :
               false;
      });
    io.emit("user-list", filteredUsers);
    }
  });
});

server.listen(3000, () => {
  console.log("Signaling server running on http://localhost:3000");
});