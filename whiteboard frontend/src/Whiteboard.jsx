import React, { useRef, useState, useEffect, useContext } from "react";
import { io } from "socket.io-client";


const Whiteboard = () => {
  const tools = ["Pencil", "Line", "Rectangle", "Circle", "Eraser", "Undo", "Redo", "Clear", "Save"];

  const [selectedTool, setSelectedTool] = useState("");
  const [value, setvalue] = useState(2);
  const [room, setroom] = useState(false);
  const [users, setusers] = useState([]);

  const canvasref = useRef(null);
  const canvascontextref = useRef(null);
  const lastposition = useRef({ x: 0, y: 0 });
  const isdrawing = useRef(false);
  const allstates = useRef([]);
  const inputroom = useRef(null);
  const socketref = useRef(null);
  const[fullroomname,setfullroomname] =useState("")
  const { fullname, setfullname } = useContext(globaldata);
const [mousemove,setmousemove]=useState()
const getRelativePosition = (e) => {
  const canvas = canvasref.current;
  const rect = canvas.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  };
};
  useEffect(() => {
    const canvas = canvasref.current;
    canvas.height = window.innerHeight ;
    canvas.width = window.innerWidth ;
    const canvascontext = canvas.getContext("2d");
    canvascontext.lineWidth = 2;
    canvascontext.strokeStyle = "black";
    canvascontext.lineCap = "round";
    canvascontextref.current = canvascontext;

    socketref.current = io("http://localhost:3000");
    socketref.current.on("JoinedUsersWhiteBoardRoom", (data) => {
      setusers(data);
    });
    socketref.current.on('draw',(data)=>{
      const ctx = canvascontextref.current;

    ctx.lineWidth = data.strokeWidth;
    ctx.strokeStyle = data.color;
    ctx.beginPath();

    if (data.tool === "Pencil" || data.tool === "Eraser") {
      ctx.moveTo(data.start.x, data.start.y);
      ctx.lineTo(data.end.x, data.end.y);
      ctx.stroke();
    }

    if (data.tool === "Line") {
      ctx.moveTo(data.start.x, data.start.y);
      ctx.lineTo(data.end.x, data.end.y);
      ctx.stroke();
    }

    if (data.tool === "Rectangle") {
      const width = data.end.x - data.start.x;
      const height = data.end.y - data.start.y;
      ctx.strokeRect(data.start.x, data.start.y, width, height);
    }
          //  allstates.current=data.allstates
   if (data.tool === "Undo") {
    if (allstates.current.length <=1) return;
    allstates.current.pop();
            const img =new Image();
            img.src=allstates.current[allstates.current.length-1];
            img.onload=()=>{
       ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
            }
    }
    
    })
   socketref.current.on('cursor-move-recieve', (data) => {
  console.log("🟢 Received cursor data:", data); // Log full object
  setmousemove(data);
});
    return () => {
        socketref.current.disconnect();
    socketref.current.off('cursor-move-recieve');
  };
  }, []);


 const handledown = (e) => {
  if (!["Pencil", "Eraser", "Line", "Rectangle"].includes(selectedTool)) return;

  const pos = getRelativePosition(e);
  lastposition.current = pos;
  isdrawing.current = true;

  // Save current canvas state for undo/redo (toDataURL)
  allstates.current.push(canvasref.current.toDataURL());
};

const handlemove = (e) => {
  if (!isdrawing.current) return;

  const { offsetX, offsetY } = e.nativeEvent;
  const ctx = canvascontextref.current;
  const canvas = canvasref.current;

  ctx.lineWidth = value;
  ctx.strokeStyle = selectedTool === "Eraser" ? "white" : "black";
    socketref.current.emit('cursor-move', {
  id: socketref.current.id,
  room: fullroomname,
  x: offsetX,
  y: offsetY,
  color: ctx.strokeStyle
});
  // Emit drawing data for Pencil, Eraser, Line, and Rectangle during move
  // For Pencil and Eraser, emit every small segment as user draws
  // For Line and Rectangle, just update preview on canvas without emitting continuously to avoid flooding
  if (["Pencil", "Eraser"].includes(selectedTool)) {
    // Draw line segment on local canvas
    ctx.beginPath();
    ctx.moveTo(lastposition.current.x, lastposition.current.y);
    ctx.lineTo(offsetX, offsetY);
    ctx.stroke();

    // Emit draw event for real-time sync
    socketref.current.emit("draw", {
      room: fullroomname,
      tool: selectedTool,
      start: { x: lastposition.current.x, y: lastposition.current.y },
      end: { x: offsetX, y: offsetY },
      strokeWidth: value,
      color: ctx.strokeStyle,
      allstates:allstates.current
    });

    // Update last position for next segment
    lastposition.current = { x: offsetX, y: offsetY };
  } else if (["Line", "Rectangle"].includes(selectedTool)) {
    // For shapes, show preview on local canvas without emitting on every move
    const img = new Image();
    img.src = allstates.current[allstates.current.length - 1] || "";

    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      ctx.beginPath();
      if (selectedTool === "Line") {
        ctx.moveTo(lastposition.current.x, lastposition.current.y);
        ctx.lineTo(offsetX, offsetY);
      } else if (selectedTool === "Rectangle") {
        const width = offsetX - lastposition.current.x;
        const height = offsetY - lastposition.current.y;
        ctx.strokeRect(lastposition.current.x, lastposition.current.y, width, height);
      }
      ctx.stroke();
    };
  }
};

const handleup = (e) => {
  if (!isdrawing.current) return; // Prevent multiple handleup calls

  const { offsetX, offsetY } = e.nativeEvent;
  const ctx = canvascontextref.current;
  const canvas = canvasref.current;

  if (["Line", "Rectangle"].includes(selectedTool)) {
    // Draw final shape on canvas
    ctx.lineWidth = value;
    ctx.strokeStyle = selectedTool === "Eraser" ? "white" : "black";

    ctx.beginPath();
    if (selectedTool === "Line") {
      ctx.moveTo(lastposition.current.x, lastposition.current.y);
      ctx.lineTo(offsetX, offsetY);
      ctx.stroke();
    } else if (selectedTool === "Rectangle") {
      const width = offsetX - lastposition.current.x;
      const height = offsetY - lastposition.current.y;
      ctx.strokeRect(lastposition.current.x, lastposition.current.y, width, height);
    }

    // Emit draw event once on mouse up for shapes
    socketref.current.emit("draw", {
      room: fullroomname,
      tool: selectedTool,
      start: { x: lastposition.current.x, y: lastposition.current.y },
      end: { x: offsetX, y: offsetY },
      strokeWidth: value,
      color: ctx.strokeStyle,
      allstates:allstates.current
    });
  }

  isdrawing.current = false;

  // For Pencil and Eraser, drawing and emit already happened during mousemove,
  // so no need to emit again on mouseup.

  // Save current canvas state for undo/redo
  allstates.current.push(canvasref.current.toDataURL());
};


  const handleclick = (tool) => {
    setSelectedTool(tool);
    const ctx = canvascontextref.current;
    const canvas = canvasref.current;
    if (tool === "Clear") {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      allstates.current = [];
    }
    if (tool === "Undo") {
      if (allstates.current.length < 1) return;
      allstates.current.pop();
      const img = new Image();
      img.src = allstates.current[allstates.current.length - 1] || "";
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      };
    }
  };

  const handleclickroom = () => {
    let id = Math.random() * 100;
    let name = fullname || `User-${Math.floor(id)}`;
    setfullname(name);
    setfullroomname(inputroom.current.value);

   
    socketref.current.emit("JoinWhiteBoardRoom", { RoomName: inputroom.current.value, name, id: socketref.current.id });
    setroom(!room);
  };
 console.log(mousemove)
  return (
   <div className="h-screen w-full bg-amber-50 flex flex-col border-2 relative">
 <div
          key={1}
          className="absolute rounded-full h-4 w-4 bg-blue-600 z-10 transition-all duration-75 pointer-events-none"
          style={{
          top: `${mousemove?.y || 0}px`,
  left: `${mousemove?.x || 0}px`,
          }}
        />
  {/* Toolbar */}
  <div className=" w-[99%] mt-2  flex flex-wrap justify-between items-center px-4 py-3 bg-white shadow-md border-b">
   <div className=" w-[99%]  flex flex-wrap justify-between items-center px-4 py-3 bg-white shadow-md border-b">
    {/* Tool Buttons */}
    <div className="flex flex-wrap gap-2">
      {tools.map((tool, idx) => (
        <button
          key={idx}
          onClick={() => handleclick(tool)}
          className={`px-4 py-2 text-sm font-medium rounded-xl border transition duration-200 ease-in-out
            ${selectedTool === tool
              ? "bg-red-600 text-white border-red-600 shadow"
              : "bg-white text-gray-800 border-gray-300 hover:bg-amber-400 hover:text-white hover:border-amber-500"}`}
        >
          {tool}
        </button>
      ))}
    </div>

    {/* Range + Color Picker */}
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <input
          type="range"
          min="1"
          max="40"
          value={value}
          onChange={(e) => setvalue(e.target.value)}
          className="w-24"
        />
        <label className="text-sm text-gray-700 font-medium">{value}</label>
      </div>
      <input type="color" className="w-8 h-8 rounded cursor-pointer border" />
    </div>
  </div>
  </div>

  {/* Canvas (takes full height - some % reserved for room section) */}
  <div className="flex-grow bg-white  flex items-center justify-center  overflow-y-visible">
    <canvas
      ref={canvasref}
      onMouseDown={handledown}
      onMouseMove={handlemove}
      onMouseUp={handleup}
      className="bg-white  shadow "
    />
  </div>

  {/* Room Section - Join/Create/Users */}
  <div className="w-full bg-white p-6 border-t shadow-md">
    {room ? (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Users in Room</h2>
        <div className="flex flex-wrap gap-2">
          {users.map((user) => (
            <div key={user.id} className="px-4 py-2 border rounded bg-gray-50 text-gray-700">
              {user.name.trim()}
            </div>
          ))}
        </div>
        <button
          onClick={handleclickroom}
          className="w-full py-2 bg-red-500 text-white rounded hover:bg-red-600 transition"
        >
          EXIT
        </button>
      </div>
    ) : (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Enter Room ID</h2>
        <input
          ref={inputroom}
          type="text"
          placeholder="ROOM_ID"
          className="w-full px-3 py-2 border rounded focus:outline-none focus:ring"
        />
        <div className="flex gap-2">
          <button
            onClick={handleclickroom}
            className="flex-1 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition"
          >
            CREATE
          </button>
          <button
            onClick={handleclickroom}
            className="flex-1 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
          >
            JOIN
          </button>
        </div>
      </div>
    )}
  </div>

</div>

  );
};

export default Whiteboard;
