const { Server } = require("socket.io");
const http = require("http");
const express = require("express");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const users = {}; // username -> socket.id

io.on("connection", (socket) => {
  let username = null;

  console.log(`New client connected: ${socket.id}`);

  // Send a welcome message to the newly connected client
  socket.emit("server-message", "✅ Signaling server is up and running!");

  socket.on("register", (name) => {
    username = name;
    users[username] = socket.id;
    io.emit("user-list", Object.keys(users));
  });

  socket.on("offer", ({ to, offer }) => {
    if (users[to]) {
      io.to(users[to]).emit("offer", { from: username, offer });
    }
  });

  socket.on("answer", ({ to, answer }) => {
    if (users[to]) {
      io.to(users[to]).emit("answer", { from: username, answer });
    }
  });

  socket.on("ice", ({ to, candidate }) => {
    if (users[to]) {
      io.to(users[to]).emit("ice", { from: username, candidate });
    }
  });

  socket.on("disconnect", () => {
    if (username) {
      delete users[username];
      io.emit("user-disconnected", username);
      io.emit("user-list", Object.keys(users));
    }
  });
});

server.listen(3000, () => {
  console.log("Signaling server running on http://localhost:3000");
});