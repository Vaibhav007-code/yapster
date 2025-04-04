const WebSocket = require('ws');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(bodyParser.json({ limit: '50mb' }));
app.use(cors());

const HTTP_PORT = 3001;
const WS_PORT = 3002;

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
    res.json({ url: `http://192.168.244.197:3001/uploads/${filename}` });
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
  res.status(201).json({ message: 'Room created' });
});

app.post('/joinRoom', (req, res) => {
  const { room, username, password } = req.body;
  const roomData = rooms.find(r => r.name === room);
  
  if (!roomData) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  if (roomData.isPrivate && roomData.password !== password && roomData.admin !== username) {
    return res.status(403).json({ error: 'Incorrect password' });
  }
  
  // Add user to room members if not already there
  if (!roomData.members.includes(username)) {
    roomData.members.push(username);
    saveData();
  }
  
  res.json({ success: true, message: 'Joined room successfully' });
});

app.delete('/rooms', (req, res) => {
  const { room, username } = req.body;
  const roomIndex = rooms.findIndex(r => r.name === room);
  if (roomIndex === -1) return res.status(404).json({ error: 'Room not found' });
  if (rooms[roomIndex].admin !== username) return res.status(403).json({ error: 'Not authorized' });
  
  rooms.splice(roomIndex, 1);
  delete messages[room];
  saveData();
  
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'roomDeleted', room }));
    }
  });
  
  res.json({ message: 'Room deleted' });
});

app.get('/messages', (req, res) => {
  const { room } = req.query;
  res.json(messages[room] || []);
});

const wss = new WebSocket.Server({ port: WS_PORT });

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      switch(message.type) {
        case 'join':
          if (!users.some(u => u.username === message.username)) return;
          
          // Check if private room and user has access
          const roomToJoin = rooms.find(r => r.name === message.room);
          if (roomToJoin && roomToJoin.isPrivate && 
              !roomToJoin.members.includes(message.username) && 
              roomToJoin.admin !== message.username) {
            // Don't allow joining if user is not a member or admin of private room
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Password required to join this room'
            }));
            return;
          }
          
          ws.username = message.username;
          ws.room = message.room;
          activeUsers.add(message.username);
          
          // For private chats, use the sorted usernames as the room ID
          const roomId = ws.room.includes('Chat with') && message.recipient 
            ? [message.username, message.recipient].sort().join('-') 
            : ws.room;
            
          const roomMessages = messages[roomId] || [];
          ws.send(JSON.stringify({
            type: 'history',
            messages: roomMessages
          }));
          
          broadcast({ type: 'userUpdate', users: Array.from(activeUsers) });
          break;

        case 'public':
          if (!ws.room || !ws.username) return;
          
          // Check if the user has access to this room
          const currentRoom = rooms.find(r => r.name === ws.room);
          if (currentRoom && currentRoom.isPrivate && 
              !currentRoom.members.includes(ws.username) && 
              currentRoom.admin !== ws.username) {
            return; // No access to send messages
          }
          
          messages[ws.room] = messages[ws.room] || [];
          const msgExists = messages[ws.room].some(m => 
            m.timestamp === message.timestamp && m.sender === message.sender);
          
          if (!msgExists) {
            messages[ws.room].push(message);
            saveData();
            broadcastToRoom(ws.room, message);
          }
          break;

        case 'private':
          const participants = [message.sender, message.recipient].sort();
          const chatId = participants.join('-');
          messages[chatId] = messages[chatId] || [];
          
          // Check if message already exists
          const privateExists = messages[chatId].some(m => 
            m.timestamp === message.timestamp && m.sender === message.sender);
            
          if (!privateExists) {
            messages[chatId].push(message);
            saveData();
            
            // Send to recipient
            sendPrivateMessage(message.recipient, message);
            
            // Echo back to sender for confirmation
            wss.clients.forEach(client => {
              if (client.readyState === WebSocket.OPEN && 
                  client.username === message.sender) {
                client.send(JSON.stringify(message));
              }
            });
          }
          break;
      }
    } catch (error) {
      console.error('WS error:', error);
    }
  });

  ws.on('close', () => {
    if (ws.username) {
      activeUsers.delete(ws.username);
      broadcast({ type: 'userUpdate', users: Array.from(activeUsers) });
      saveData();
    }
  });
});

function broadcast(message) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

function broadcastToRoom(room, message) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN && client.room === room) {
      client.send(JSON.stringify(message));
    }
  });
}

function sendPrivateMessage(recipient, message) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN && client.username === recipient) {
      client.send(JSON.stringify(message));
    }
  });
}

app.listen(HTTP_PORT, () => console.log(`HTTP Server: ${HTTP_PORT}`));
wss.on('listening', () => console.log(`WS Server: ${WS_PORT}`));