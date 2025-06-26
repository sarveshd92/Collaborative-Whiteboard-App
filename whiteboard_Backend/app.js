// server.js or index.js
import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);

// Store whiteboard users and cursors per room
let WhiteBoardUsers = {}; // { roomName: [{ id, name }] }
let WhiteBoardCursors = {}; // { roomName: { socketId: { x, y, color } } }

app.use(cors({
  origin: ["http://localhost:5173"],
  methods: ['GET', 'POST'],
  credentials: true,
}));

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:5174"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

io.on("connection", (socket) => {
  console.log("🟢 New connection:", socket.id);

  socket.on("JoinWhiteBoardRoom", (data) => {
    const { RoomName, name, id } = data;
    socket.join(RoomName);

    // Add user to room
    if (!WhiteBoardUsers[RoomName]) WhiteBoardUsers[RoomName] = [];
    WhiteBoardUsers[RoomName].push({ id, name });

    // Initialize cursor map for room
    if (!WhiteBoardCursors[RoomName]) WhiteBoardCursors[RoomName] = {};

    // Send updated users to all
    io.to(RoomName).emit("JoinedUsersWhiteBoardRoom", WhiteBoardUsers[RoomName]);
    console.log(`🟢 ${name} joined ${RoomName}`);
  });

  socket.on("draw", (data) => {
    socket.to(data.room).emit("draw", data);
  });

  socket.on("cursor-move", (data) => {
    const { room, x, y, color, id } = data;
    if (!WhiteBoardCursors[room]) WhiteBoardCursors[room] = {};
    WhiteBoardCursors[room][id] = { x, y, color };

    // Broadcast to all except sender
    socket.to(room).emit("cursor-move-recieve", {
      id,
      x,
      y,
      color
    });
  });

  socket.on("disconnect", () => {
    console.log("🔴 Disconnected:", socket.id);

    // Remove user from all rooms
    for (const room in WhiteBoardUsers) {
      const users = WhiteBoardUsers[room];
      const updatedUsers = users.filter((user) => user.id !== socket.id);
      if (updatedUsers.length !== users.length) {
        WhiteBoardUsers[room] = updatedUsers;
        io.to(room).emit("JoinedUsersWhiteBoardRoom", updatedUsers);
      }

      // Remove cursor data
      if (WhiteBoardCursors[room] && WhiteBoardCursors[room][socket.id]) {
        delete WhiteBoardCursors[room][socket.id];
      }
    }
  });
});

app.get("/", (req, res) => {
  res.send("Whiteboard Realtime Server Running 🚀");
});

server.listen(3000, () => {
  console.log("✅ Server listening on http://localhost:3000");
});
