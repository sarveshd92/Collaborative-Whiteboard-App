// App.js (Updated with Multi-User Colored Cursors)
import { useRef, useState, useEffect } from 'react';
import './App.css';
import { io } from 'socket.io-client';

function App() {
  const tools = ["Pencil", "Line", "Rectangle", "Circle", "Eraser", "Undo", "Clear", "Save"];

  const [color, setColor] = useState("#000000");
  const [selectedTool, setSelectedTool] = useState("");
  const [value, setValue] = useState(2);
  const [roomJoined, setRoomJoined] = useState(false);
  const [users, setUsers] = useState([]);
  const [cursorMap, setCursorMap] = useState({});
  const [roomName, setRoomName] = useState("");


  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const isDrawing = useRef(false);
  const statesRef = useRef([]);
  const roomInputRef = useRef(null);
  const socketRef = useRef(null);

  const getRelativePosition = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext("2d");
    ctx.lineCap = "round";
    ctx.lineWidth = value;
    ctx.strokeStyle = color;
    contextRef.current = ctx;

    socketRef.current = io("http://localhost:3000");

    socketRef.current.on("JoinedUsersWhiteBoardRoom", setUsers);

    socketRef.current.on("draw", (data) => {
      const ctx = contextRef.current;
      ctx.lineWidth = data.strokeWidth;
      ctx.strokeStyle = data.color;

      ctx.beginPath();
      if (["Pencil", "Eraser", "Line"].includes(data.tool)) {
        ctx.moveTo(data.start.x, data.start.y);
        ctx.lineTo(data.end.x, data.end.y);
        ctx.stroke();
      } else if (data.tool === "Rectangle") {
        const width = data.end.x - data.start.x;
        const height = data.end.y - data.start.y;
        ctx.strokeRect(data.start.x, data.start.y, width, height);
      } else if (data.tool === "Circle") {
        const radius = Math.sqrt(Math.pow(data.end.x - data.start.x, 2) + Math.pow(data.end.y - data.start.y, 2));
        ctx.arc(data.start.x, data.start.y, radius, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (data.tool === "Undo") {
        if (statesRef.current.length <= 1) return;
        statesRef.current.pop();
        const img = new Image();
        img.src = statesRef.current[statesRef.current.length - 1];
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
        };
      }
    });

    socketRef.current.on("cursor-move-recieve", ({ id, x, y, color }) => {
      setCursorMap(prev => ({ ...prev, [id]: { x, y, color } }));
    });


    return () => {
      socketRef.current.disconnect();
    };
  }, []);

  const handleMouseDown = (e) => {
    if (!tools.includes(selectedTool)) return;
    lastPosRef.current = getRelativePosition(e);
    isDrawing.current = true;
    statesRef.current.push(canvasRef.current.toDataURL());
  };

  const handleMouseMove = (e) => {
    if (!isDrawing.current) return;

    const ctx = contextRef.current;
    const { offsetX, offsetY } = e.nativeEvent;

    ctx.lineWidth = value;
    ctx.strokeStyle = selectedTool === "Eraser" ? "white" : color;

    socketRef.current.emit("cursor-move", {
      id: socketRef.current.id,
      room: roomName,
      x: offsetX,
      y: offsetY,
      color
    });

    if (["Pencil", "Eraser"].includes(selectedTool)) {
      ctx.beginPath();
      ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
      ctx.lineTo(offsetX, offsetY);
      ctx.stroke();

      socketRef.current.emit("draw", {
        room: roomName,
        tool: selectedTool,
        start: { ...lastPosRef.current },
        end: { x: offsetX, y: offsetY },
        strokeWidth: value,
        color
      });

      lastPosRef.current = { x: offsetX, y: offsetY };
    } else {
      const img = new Image();
      img.src = statesRef.current[statesRef.current.length - 1] || "";

      img.onload = () => {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        ctx.drawImage(img, 0, 0);

        ctx.beginPath();
        if (selectedTool === "Circle") {
          const radius = Math.sqrt(Math.pow(offsetX - lastPosRef.current.x, 2) + Math.pow(offsetY - lastPosRef.current.y, 2));
          ctx.arc(lastPosRef.current.x, lastPosRef.current.y, radius, 0, 2 * Math.PI);
        } else if (selectedTool === "Line") {
          ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
          ctx.lineTo(offsetX, offsetY);
        } else if (selectedTool === "Rectangle") {
          ctx.strokeRect(lastPosRef.current.x, lastPosRef.current.y, offsetX - lastPosRef.current.x, offsetY - lastPosRef.current.y);
        }
        ctx.stroke();
      };
    }
  };

  const handleMouseUp = (e) => {
    if (!isDrawing.current) return;
    const ctx = contextRef.current;
    const { offsetX, offsetY } = e.nativeEvent;

    ctx.lineWidth = value;
    ctx.strokeStyle = selectedTool === "Eraser" ? "white" : color;

    if (["Line", "Rectangle", "Circle"].includes(selectedTool)) {
      ctx.beginPath();
      if (selectedTool === "Line") {
        ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
        ctx.lineTo(offsetX, offsetY);
      } else if (selectedTool === "Rectangle") {
        ctx.strokeRect(lastPosRef.current.x, lastPosRef.current.y, offsetX - lastPosRef.current.x, offsetY - lastPosRef.current.y);
      } else if (selectedTool === "Circle") {
        const radius = Math.sqrt(Math.pow(offsetX - lastPosRef.current.x, 2) + Math.pow(offsetY - lastPosRef.current.y, 2));
        ctx.arc(lastPosRef.current.x, lastPosRef.current.y, radius, 0, 2 * Math.PI);
      }
      ctx.stroke();

      socketRef.current.emit("draw", {
        room: roomName,
        tool: selectedTool,
        start: { ...lastPosRef.current },
        end: { x: offsetX, y: offsetY },
        strokeWidth: value,
        color
      });
    }
    isDrawing.current = false;
    statesRef.current.push(canvasRef.current.toDataURL());
  };

  const handleToolClick = (tool) => {
    setSelectedTool(tool);
    const ctx = contextRef.current;
    if (tool === "Clear") {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      statesRef.current = [];
    }
    if (tool === "Undo") {
      if (statesRef.current.length <= 1) return;
      statesRef.current.pop();
      const img = new Image();
      img.src = statesRef.current[statesRef.current.length - 1];
      img.onload = () => {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        ctx.drawImage(img, 0, 0);
      };
    }
  };

  const handleJoinRoom = () => {
    const room = roomInputRef.current.value.trim();
    if (!room) return;
    const id = Math.floor(Math.random() * 10000);
    const name = `User-${id}`;
    setRoomName(room);
    setRoomJoined(true);
    socketRef.current.emit("JoinWhiteBoardRoom", { RoomName: room, name, id: socketRef.current.id });
  };

  return (
    <div className="h-screen w-full bg-gray-100 flex flex-col relative">
      {Object.entries(cursorMap).map(([id, cursor]) => (
        <div
          key={id}
          className="absolute rounded-full h-4 w-4 z-50 pointer-events-none"
          style={{
            top: `${cursor?.y}px`,
            left: `${cursor?.x}px`,
            backgroundColor: cursor?.color || 'black'
          }}
        />
      ))}

      {/* Toolbar */}
      <div className="w-full p-4 bg-white shadow-md flex flex-wrap justify-between gap-4">
        <div className="flex gap-2 flex-wrap">
          {tools.map((tool, idx) => (
            <button
              key={idx}
              onClick={() => handleToolClick(tool)}
              className={`px-3 py-1 text-sm rounded border font-medium ${selectedTool === tool ? "bg-blue-600 text-white" : "bg-white text-black"}`}
            >
              {tool}
            </button>
          ))}
        </div>
        <div className="flex gap-3 items-center">
          <input type="range" min="1" max="40" value={value} onChange={(e) => setValue(e.target.value)} />
          <span>{value}</span>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        </div>
      </div>

      <div className="flex-grow relative">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className="w-full h-full bg-white"
        />
      </div>

      {/* Room Section */}
      <div className="p-4 bg-white border-t">
        {roomJoined ? (
          <div>
            <h3 className="text-lg font-semibold">Users in Room</h3>
            <div className="flex flex-wrap gap-2 mt-2">
              {users.map(user => (
                <span key={user.id} className="px-3 py-1 bg-gray-200 rounded">{user.name}</span>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <input ref={roomInputRef} type="text" placeholder="Enter Room ID" className="border px-3 py-2 rounded" />
            <button onClick={handleJoinRoom} className="bg-green-500 text-white py-2 rounded hover:bg-green-600">Join Room</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
