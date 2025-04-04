const WebSocket = require('ws');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

// Middleware
app.use(bodyParser.json({ limit: '50mb' }));
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Server setup
const PORT = process.env.PORT || 3001;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory');
}
app.use('/uploads', express.static(uploadsDir));

// Data storage
let users = [];
let messages = {};
let rooms = [];
const activeUsers = new Set();

// Data persistence
const dataFile = path.join(__dirname, 'data.json');

const loadData = () => {
  if (fs.existsSync(dataFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(dataFile));
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
    fs.writeFileSync(dataFile, JSON.stringify({ users, messages, rooms }));
  } catch (e) {
    console.error('Error saving data:', e);
  }
};

loadData();

// WebSocket setup
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

// Routes
app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Invalid credentials' });
  }
  if (users.some(u => u.username === username)) {
    return res.status(400).json({ error: 'Username exists' });
  }
  users.push({ username, password });
  saveData();
  res.status(201).json({ message: 'Registered', username });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  activeUsers.add(username);
  saveData();
  res.json({ message: 'Logged in', username });
});

app.post('/upload', (req, res) => {
  try {
    const { file, filename } = req.body;
    if (!file || !filename) {
      return res.status(400).json({ error: 'Missing file data' });
    }
    const buffer = Buffer.from(file, 'base64');
    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, buffer);
    res.json({ url: `/uploads/${filename}` });
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

app.get('/rooms', (req, res) => {
  res.json(rooms);
});

app.post('/rooms', (req, res) => {
  const { room, username, isPrivate, password } = req.body;
  if (rooms.some(r => r.name === room)) {
    return res.status(400).json({ error: 'Room exists' });
  }
  
  rooms.push({ 
    name: room, 
    admin: username, 
    members: [username],
    isPrivate: isPrivate || false,
    password: isPrivate ? password : ''
  });
  
  messages[room] = messages[room] || [];
  saveData();
  broadcastRooms();
  res.status(201).json({ message: 'Room created' });
});

app.post('/joinRoom', (req, res) => {
  const { room, username, password } = req.body;
  const foundRoom = rooms.find(r => r.name === room);

  if (!foundRoom) {
    return res.status(404).json({ error: 'Room not found' });
  }

  if (foundRoom.isPrivate && foundRoom.password !== password && foundRoom.admin !== username) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  if (!foundRoom.members.includes(username)) {
    foundRoom.members.push(username);
    saveData();
  }

  res.json({ success: true });
});

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
  broadcastRooms();
  res.json({ message: 'Room deleted' });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uploadsDirExists: fs.existsSync(uploadsDir)
  });
});

// Server initialization
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Uploads directory: ${uploadsDir}`);
  console.log(`Data file: ${dataFile}`);
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('New WebSocket connection');

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      if (message.type === 'join') {
        ws.username = message.username;
        ws.room = message.room;
        activeUsers.add(message.username);
        ws.send(JSON.stringify({
          type: 'rooms_update',
          rooms: rooms
        }));
      } else if (message.type === 'message') {
        messages[ws.room] = messages[ws.room] || [];
        messages[ws.room].push(message);
        saveData();
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN && client.room === ws.room) {
            client.send(JSON.stringify(message));
          }
        });
      }
    } catch (error) {
      console.error('WS message error:', error);
    }
  });

  ws.on('close', () => {
    if (ws.username) {
      activeUsers.delete(ws.username);
    }
    console.log('Client disconnected');
  });

  ws.send(JSON.stringify({ 
    type: 'connected', 
    message: 'WebSocket connection established' 
  }));
});