const { Server } = require("socket.io");
const http = require("http");

const server = http.createServer();
const io = new Server(server, {
  cors: {
    origin: "*", // In production, specify your frontend's origin
  },
});

io.on("connection", (socket) => {
  console.log(`New client connected: ${socket.id}`);

  // Send a welcome message to the newly connected client
  socket.emit("server-message", "✅ Signaling server is up and running!");

  // Relay signaling data to other clients
  socket.on("offer", (data) => socket.broadcast.emit("offer", data));
  socket.on("answer", (data) => socket.broadcast.emit("answer", data));
  socket.on("ice", (data) => socket.broadcast.emit("ice", data));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Signaling server running on http://localhost:${PORT}`);
});
