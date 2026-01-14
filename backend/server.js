const express = require("express");
const cors = require("cors");
const http = require("http");
const WebSocket = require("ws");
const PDFDocument = require("pdfkit");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

/*GLOBAL STORAGE (Render-safe)*/
global.rooms = global.rooms || {};
const rooms = global.rooms;

/* Health Check */
app.get("/", (req, res) => {
  res.send("Chat backend running");
});

/* PDF Download */
app.get("/download-notes/:room", (req, res) => {
  const roomCode = req.params.room;
  const room = rooms[roomCode];

  if (!room || room.messages.length === 0) {
    return res.status(404).send("No notes found for this room");
  }

  const doc = new PDFDocument();
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=notes_${roomCode}.pdf`
  );
  res.setHeader("Content-Type", "application/pdf");

  doc.pipe(res);
  doc.fontSize(16).text(`Chat Notes – Room ${roomCode}\n\n`);

  room.messages.forEach((m) => {
    doc.fontSize(12).text(`${m.name}: ${m.text}`);
    doc.moveDown();
  });

  doc.end();
});

/* WebSocket */
wss.on("connection", (ws) => {
  let currentRoom = null;
  let currentRole = null;
  let currentName = null;

  ws.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }

    /* Mentor creates room */
    if (msg.type === "create-room") {
      const roomCode = uuidv4().slice(0, 6).toUpperCase();

      rooms[roomCode] = {
        mentor: ws,
        students: [],
        messages: []
      };

      currentRoom = roomCode;
      currentRole = "mentor";
      currentName = msg.name || "Mentor"; 

      ws.send(
        JSON.stringify({
          type: "room-created",
          code: roomCode
        })
      );
    }

    /* Student joins room  */
    if (msg.type === "join-room") {
      const room = rooms[msg.code];

      if (!room) {
        ws.send(
          JSON.stringify({
            type: "error",
            text: "Invalid room code"
          })
        );
        return;
      }

      room.students.push(ws);
      currentRoom = msg.code;
      currentRole = "student";
      currentName = msg.name;

      // SEND CHAT HISTORY
      ws.send(
        JSON.stringify({
          type: "history",
          messages: room.messages
        })
      );
    }

    /* Chat Message */
    if (msg.type === "chat" && currentRoom) {
      const chat = {
        name: currentName,
        role: currentRole,
        text: msg.text,
        time: new Date().toISOString()
      };

      rooms[currentRoom].messages.push(chat);

      const room = rooms[currentRoom];

      // mentor
      if (room.mentor?.readyState === WebSocket.OPEN) {
        room.mentor.send(
          JSON.stringify({
            type: "chat",
            ...chat
          })
        );
      }

      // students
      room.students.forEach((s) => {
        if (s.readyState === WebSocket.OPEN) {
          s.send(
            JSON.stringify({
              type: "chat",
              ...chat
            })
          );
        }
      });
    }
  });

  ws.on("close", () => {
    if (!currentRoom) return;

    const room = rooms[currentRoom];
    if (!room) return;

    if (currentRole === "student") {
      room.students = room.students.filter((s) => s !== ws);
    }

    if (currentRole === "mentor") {
      delete rooms[currentRoom]; // class closed
    }
  });
});

server.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);
