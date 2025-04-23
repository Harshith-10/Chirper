const { Server } = require("socket.io");
const http = require("http");
const server = http.createServer();
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

io.on("connection", (socket) => {
  socket.on("offer", (data) => socket.broadcast.emit("offer", data));
  socket.on("answer", (data) => socket.broadcast.emit("answer", data));
  socket.on("ice", (data) => socket.broadcast.emit("ice", data));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Signaling server running on http://localhost:${PORT}`);
});
