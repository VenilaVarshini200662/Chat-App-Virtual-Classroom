import { useRef, useState } from "react";
import "./style.css";

const BACKEND_WS = "wss://chat-application-x3vg.onrender.com";
const BACKEND_HTTP = "https://chat-application-x3vg.onrender.com";

export default function App() {
  const socketRef = useRef(null);

  const [stage, setStage] = useState("home"); // home | chat
  const [role, setRole] = useState("");
  const [name, setName] = useState("");
  const [roomInput, setRoomInput] = useState("");
  const [room, setRoom] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

  const connect = (selectedRole) => {
    if (!name.trim()) return alert("Enter your name");
    if (selectedRole === "student" && !roomInput.trim())
      return alert("Enter room code");

    setRole(selectedRole);
    setMessages([]);

    const socket = new WebSocket(BACKEND_WS);
    socketRef.current = socket;

    socket.onopen = () => {
      if (selectedRole === "mentor") {
        socket.send(
          JSON.stringify({
            type: "create-room",
            name: name
          })
        );
      } else {
        socket.send(
          JSON.stringify({
            type: "join-room",
            code: roomInput,
            name: name
          })
        );
        setRoom(roomInput);
        setStage("chat");
      }
    };

    socket.onmessage = (e) => {
      const data = JSON.parse(e.data);
      console.log("Received:", data);

      if (data.type === "room-created") {
        setRoom(data.code);
        setStage("chat");
      }

      // CHAT HIST
      if (data.type === "history") {
        setMessages(data.messages || []);
        return;
      }

      //LIVE CHAT
      if (data.type === "chat") {
        setMessages((prev) => [...prev, data]);
      }

      if (data.type === "error") alert(data.text);
    };

    socket.onerror = () => alert("WebSocket connection failed");
  };

  const sendMessage = () => {
    if (!message.trim() || !socketRef.current) return;

    socketRef.current.send(
      JSON.stringify({
        type: "chat",
        text: message
      })
    );
    setMessage("");
  };

  const downloadNotes = () => {
    if (!room) return alert("Room not available");
    window.open(`${BACKEND_HTTP}/download-notes/${room}`);
  };

  /* HOME PAGE */
  if (stage === "home") {
    return (
      <div className="center">
        <div className="home-card">
          <h2>📚 Venila's Virtual Classroom</h2>

          <input
            placeholder="Your Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <input
            placeholder="Room Code (Students only)"
            value={roomInput}
            onChange={(e) => setRoomInput(e.target.value)}
          />

          <div className="btn-group">
            <button onClick={() => connect("mentor")}>Create Class</button>
            <button onClick={() => connect("student")}>Join Class</button>
          </div>
        </div>
      </div>
    );
  }

  /* CHAT PAGE */
  return (
    <div className="app">
      <div className="header">
        <span>
          {role === "mentor" ? "Mentor" : "Student"}: {name}
        </span>
        <span>Room: {room}</span>
      </div>

      <button className="downloadBtn" onClick={downloadNotes}>
        📄 Download Notes
      </button>

      <div className="chatBox">
        {messages.map((m, i) => {
          const isMine =
            (role === "mentor" && m.role === "mentor") ||
            (role === "student" && m.role === "student" && m.name === name);

          return (
            <div key={i} className={`msg ${isMine ? "my" : "other"}`}>
              <b>{m.name}</b>
              <p>{m.text}</p>
            </div>
          );
        })}
      </div>

      <div className="inputBox">
        <input
          placeholder="Type your message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}
