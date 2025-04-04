const WebSocket = require('ws');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(bodyParser.json({ limit: '50mb' }));
app.use(cors());

// Use Railway's provided PORT or default to 3001
const HTTP_PORT = process.env.PORT || 3001;
const WS_PORT = process.env.WS_PORT || 3002;

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
app.use('/uploads', express.static(uploadsDir));

let users = [];
let messages = {};
let rooms = [];
const activeUsers = new Set();

const loadData = () => {
  if (fs.existsSync('data.json')) {
    try {
      const data = JSON.parse(fs.readFileSync('data.json'));
      users = data.users || [];
      messages = data.messages || {};
      rooms = data.rooms || [];
    } catch (e) {
      console.error('Error loading data:', e);
    }
  }
};

const saveData = () => {
  try {
    fs.writeFileSync('data.json', JSON.stringify({ users, messages, rooms }));
  } catch (e) {
    console.error('Error saving data:', e);
  }
};

loadData();

// Function to broadcast room updates to all connected clients
const broadcastRooms = () => {
  const roomsUpdate = {
    type: 'rooms_update',
    rooms: rooms
  };
  
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(roomsUpdate));
    }
  });
};

app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Invalid credentials' });
  if (users.some(u => u.username === username)) return res.status(400).json({ error: 'Username exists' });
  users.push({ username, password });
  saveData();
  res.status(201).json({ message: 'Registered', username });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);
  if (!user || user.password !== password) return res.status(401).json({ error: 'Invalid credentials' });
  activeUsers.add(username);
  saveData();
  res.json({ message: 'Logged in', username });
});

app.post('/upload', (req, res) => {
  try {
    const { file, filename } = req.body;
    const buffer = Buffer.from(file, 'base64');
    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, buffer);
    res.json({ url: `${process.env.API_URL}/uploads/${filename}` });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'File upload failed' });
  }
});

app.get('/users', (req, res) => {
  res.json(users.map(u => ({
    username: u.username,
    online: activeUsers.has(u.username)
  })));
});

app.get('/rooms', (req, res) => res.json(rooms));

app.post('/rooms', (req, res) => {
  const { room, username, isPrivate, password } = req.body;
  if (rooms.some(r => r.name === room)) return res.status(400).json({ error: 'Room exists' });
  
  rooms.push({ 
    name: room, 
    admin: username, 
    members: [username],
    isPrivate: isPrivate || false,
    password: isPrivate ? password : ''
  });
  
  messages[room] = messages[room] || [];
  saveData();
  
  // Broadcast room update to all clients
  broadcastRooms();
  
  res.status(201).json({ message: 'Room created' });
});

// Add endpoint for joining private rooms
app.post('/joinRoom', (req, res) => {
  const { room, username, password } = req.body;
  const foundRoom = rooms.find(r => r.name === room);

  if (!foundRoom) {
    return res.status(404).json({ error: 'Room not found' });
  }

  if (foundRoom.isPrivate && foundRoom.password !== password && foundRoom.admin !== username) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  // Add user to room members if not already a member
  if (!foundRoom.members.includes(username)) {
    foundRoom.members.push(username);
    saveData();
  }

  res.json({ success: true });
});

// Add endpoint for deleting rooms
app.delete('/rooms', (req, res) => {
  const { room, username } = req.body;
  const roomIndex = rooms.findIndex(r => r.name === room);

  if (roomIndex === -1) {
    return res.status(404).json({ error: 'Room not found' });
  }

  if (rooms[roomIndex].admin !== username) {
    return res.status(403).json({ error: 'Only the room admin can delete this room' });
  }

  rooms.splice(roomIndex, 1);
  delete messages[room];
  saveData();
  
  // Broadcast room update to all clients
  broadcastRooms();
  
  res.json({ message: 'Room deleted' });
});

const server = app.listen(HTTP_PORT, () => console.log(`HTTP Server running on port ${HTTP_PORT}`));

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      if (message.type === 'join') {
        ws.username = message.username;
        ws.room = message.room;
        activeUsers.add(message.username);
        
        // Send rooms list to newly connected user
        ws.send(JSON.stringify({
          type: 'rooms_update',
          rooms: rooms
        }));
      } else if (message.type === 'message') {
        messages[ws.room] = messages[ws.room] || [];
        messages[ws.room].push(message);
        saveData();
        
        // Broadcast chat message to clients in the same room
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN && client.room === ws.room) {
            client.send(JSON.stringify(message));
          }
        });
        
        return; // Skip the broadcast at the end since we already sent to room clients
      }
      
      // For other message types (non-chat messages), broadcast to all clients
      if (message.type !== 'message') {
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
          }
        });
      }
    } catch (error) {
      console.error('WS error:', error);
    }
  });

  ws.on('close', () => {
    if (ws.username) activeUsers.delete(ws.username);
  });
});