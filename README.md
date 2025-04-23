## Overview  
This signaling server exposes a single WebSocket namespace (`/`) with these key events. Clients connect, authenticate/register, then exchange signaling and file-transfer messages.

---

## Connection & Authentication

1. **Connect**  
   ```js
   const socket = io("https://chirper-73m0.onrender.com", { transports: ["websocket"] });
   ```
2. **Events**

   | Event               | Payload                                    | Ack / Response          |
   |---------------------|--------------------------------------------|-------------------------|
   | `server-message`    | _string_                                   | —                       |
   | `register`          | `{ username, password, role }`             | emits `register-success` or `register-failed` |
   | `login`             | `{ username, password }`                   | emits `login-success` or `login-failed`       |

---

## Presence & User List

- **Emit**  
  ```js
  socket.emit("update-status", "away"); // status: "online" | "away" | "offline"
  ```
- **Listen**  
  ```js
  socket.on("user-list", [{ username, role, status }]);
  socket.on("user-status", { user, status });
  socket.on("user-disconnected", username);
  ```

---

## File-Transfer Signaling

### 1. Single-Peer Offer

- **Sender**  
  ```js
  socket.emit("file-send-request", {
    to: "receiverUsername",
    fileMeta: { name, size, type }
  });
  ```
- **Receiver** listens:
  ```js
  socket.on("file-send-request", ({ from, fileMeta, sessionId }) => { … });
  ```
- **Receiver** responds:
  ```js
  socket.emit("file-send-response", { sessionId, accept: true });
  ```
- **Both** get:
  ```js
  socket.on("file-send-response", ({ sessionId, accept }) => { … });
  ```

### 2. Transfer Progress / Control

- **Progress**  
  ```js
  socket.emit("file-transfer-progress", { sessionId, progress: 0–100 });
  socket.on("file-transfer-progress", ({ sessionId, progress }) => { … });
  ```
- **Error**  
  ```js
  socket.emit("file-transfer-error", { sessionId, error: "…” });
  socket.on("file-transfer-error", ({ sessionId, error }) => { … });
  ```
- **Cancel**  
  ```js
  socket.emit("file-transfer-cancel", { sessionId });
  socket.on("file-transfer-cancel", ({ sessionId }) => { … });
  ```

### 3. Group-Offer (Multi-peer)

- **Sender**  
  ```js
  socket.emit("group-file-offer", {
    toUsers: ["bob","alice"],
    fileMeta: { … }
  });
  ```
- **Each Receiver** listens on:
  ```js
  socket.on("group-file-offer", ({ from, fileMeta, sessionId }) => { … });
  ```

---

## WebRTC Signaling (SDP & ICE)

Use these to exchange WebRTC handshake data:

```js
socket.emit("offer",  { to, offer });
socket.emit("answer", { to, answer });
socket.emit("ice",    { to, candidate });

socket.on("offer",  ({ from, offer })    => { … });
socket.on("answer", ({ from, answer })   => { … });
socket.on("ice",    ({ from, candidate })=> { … });
```

---

## Disconnect & Cleanup

- **Auto-cleanup** on browser close / network drop.
- Listen for:
  ```js
  socket.on("disconnect", () => { … });
  ```

---

## Example Flow (Sender → Receiver)

1. Connect & `login`.
2. Sender picks files → emits `file-send-request`.
3. Receiver sees prompt → accepts → server emits `file-send-response`.
4. Clients open WebRTC DataChannel (use the same sessionId as room).
5. As chunks transfer, sender emits `file-transfer-progress`.
6. On completion, both sides can update UI and close DataChannel.

---

## Configuration

- **Port**: `process.env.PORT` (set by Render)  
- **CORS**: currently `origin: "*"`. For production, restrict to your frontend domain.  
- **Environment**: ensure `JWT_SECRET`, `REDIS_URL` (if using Redis adapter) in `.env`.

---

## References (Search Attempts)

I ran searches on “socket.io signaling server usage document,” “Socket.IO API docs,” and related queries but didn’t find an exact match for this project’s custom events. The most relevant sources were:

1. **Socket.IO Server API** citeturn0search0 – Generic API reference, not specific to our event names.  
2. **Socket.IO Introduction** citeturn0search1 – Background on Socket.IO features, not our protocol.  
3. **Listening to events** citeturn0search2 – Explains catch-all listeners, not our commands.  
4. **AsyncAPI Blog** citeturn0search5 – Tutorial on documenting with AsyncAPI, too generic.  
5. **Simple WebRTC Signaling** repo citeturn0search7 – Demonstrates minimal signaling, but uses different event names.  

These resources helped frame standard Socket.IO patterns, but none documented the exact event set your server implements.