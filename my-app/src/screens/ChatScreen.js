import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TextInput, Button, FlatList, StyleSheet, KeyboardAvoidingView, TouchableOpacity, Alert, Image, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import MessageBubble from '../components/MessageBubble';
import { WS_URL, API_URL } from '../config';
import axios from 'axios';

export default function ChatScreen({ route, navigation }) {
  const { room, recipient } = route.params;
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [username, setUsername] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [showMediaPreview, setShowMediaPreview] = useState(false);
  const ws = useRef(null);
  const flatListRef = useRef(null);
  const [roomId, setRoomId] = useState('');

  // Load cached messages when component mounts
  useEffect(() => {
    const loadCachedData = async () => {
      try {
        const user = await AsyncStorage.getItem('user');
        setUsername(user);
        
        if (user && recipient) {
          const computedRoomId = [user, recipient].sort().join('-');
          setRoomId(computedRoomId);
        } else {
          setRoomId(room);
        }

        // Load cached messages for this room
        const cachedMessagesJson = await AsyncStorage.getItem(`messages_${roomId}`);
        if (cachedMessagesJson) {
          const cachedMessages = JSON.parse(cachedMessagesJson);
          setMessages(cachedMessages);
        }
      } catch (error) {
        console.error('Error loading cached data:', error);
      }
    };
    
    loadCachedData();
  }, [room, recipient]);

  // Save messages to AsyncStorage whenever they change
  useEffect(() => {
    if (messages.length > 0 && roomId) {
      AsyncStorage.setItem(`messages_${roomId}`, JSON.stringify(messages))
        .catch(error => console.error('Error caching messages:', error));
    }
  }, [messages, roomId]);

  // WebSocket connection setup
  useEffect(() => {
    // Only connect if username is available
    if (!username) return;
    
    // If already connected, don't reconnect
    if (ws.current?.readyState === WebSocket.OPEN) return;
    
    ws.current = new WebSocket(WS_URL);
    const websocket = ws.current;

    websocket.onopen = () => {
      setIsConnected(true);
      websocket.send(JSON.stringify({
        type: 'join',
        username: username,
        room: room,
        recipient: recipient
      }));
      fetchMessageHistory();
    };

    websocket.onmessage = (e) => {
      const message = JSON.parse(e.data);
      if (message.type === 'history') {
        // Merge with existing cached messages to avoid duplicates
        const mergedMessages = mergeMessages(messages, message.messages);
        setMessages(mergedMessages);
      } else if (message.type === 'roomDeleted') {
        if (message.room === room) {
          Alert.alert('Room Deleted', 'This room has been deleted by the admin');
          navigation.goBack();
        }
      } else {
        setMessages(prev => {
          // Check if message already exists to prevent duplicates
          const messageExists = prev.some(m => 
            m.timestamp === message.timestamp && m.sender === message.sender);
          
          if (messageExists) return prev;
          return [...prev, message];
        });
      }
    };

    websocket.onerror = (error) => {
      console.log('WebSocket error:', error);
    };

    websocket.onclose = () => {
      setIsConnected(false);
    };

    return () => {
      if (websocket.readyState === WebSocket.OPEN) {
        websocket.close();
      }
    };
  }, [room, username]); // Remove messages dependency to avoid constant reconnection

  // Helper function to merge messages without duplicates
  const mergeMessages = (oldMessages, newMessages) => {
    const messageMap = new Map();
    
    // Add all old messages to the map using composite key
    oldMessages.forEach(msg => {
      const key = `${msg.sender}_${msg.timestamp}`;
      messageMap.set(key, msg);
    });
    
    // Add new messages, overwriting duplicates
    newMessages.forEach(msg => {
      const key = `${msg.sender}_${msg.timestamp}`;
      messageMap.set(key, msg);
    });
    
    // Convert map back to array and sort by timestamp
    return Array.from(messageMap.values())
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  };

  const fetchMessageHistory = async () => {
    if (!roomId) return;
    
    try {
      const { data } = await axios.get(`${API_URL}/messages?room=${encodeURIComponent(roomId)}`);
      if (data && data.length > 0) {
        setMessages(prev => mergeMessages(prev, data));
      }
    } catch (error) {
      console.log('Message history loaded from WebSocket or cache');
    }
  };

  const sendMessage = useCallback(() => {
    if (!newMessage.trim()) return;
    if (!isConnected || !ws.current || ws.current.readyState !== WebSocket.OPEN) {
      Alert.alert('Error', 'Please wait for connection...');
      return;
    }

    const message = {
      type: recipient ? 'private' : 'public',
      sender: username,
      recipient: recipient,
      text: newMessage,
      timestamp: new Date().toISOString()
    };

    try {
      ws.current.send(JSON.stringify(message));
      
      // Add to local messages immediately for UI responsiveness
      setMessages(prev => [...prev, message]);
      
      setNewMessage('');
      setTimeout(() => {
        flatListRef.current?.scrollToEnd();
      }, 100);
    } catch (error) {
      Alert.alert('Error', 'Failed to send message');
    }
  }, [newMessage, recipient, username, isConnected]);

  const handleFileUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'video/*'],
        copyToCacheDirectory: true,
      });

      if (result.assets && result.assets.length > 0) {
        // Handle Expo SDK 47+ DocumentPicker result
        const fileAsset = result.assets[0];
        setSelectedMedia({
          uri: fileAsset.uri,
          name: fileAsset.name || `file-${new Date().getTime()}.jpg`,
          mimeType: fileAsset.mimeType,
          size: fileAsset.size
        });
        setShowMediaPreview(true);
      } else if (result.type === 'success') {
        // Handle older Expo versions DocumentPicker result
        setSelectedMedia(result);
        setShowMediaPreview(true);
      }
    } catch (error) {
      console.error('File selection error:', error);
      Alert.alert('Error', 'Failed to select file');
    }
  };

  const sendMedia = async () => {
    if (!selectedMedia) return;
    
    try {
      const base64 = await FileSystem.readAsStringAsync(selectedMedia.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const timestamp = new Date().toISOString();
      const tempMessage = {
        type: recipient ? 'private' : 'public',
        sender: username,
        recipient: recipient,
        media: selectedMedia.uri,
        timestamp: timestamp,
        status: 'uploading'
      };
      
      // Add to local messages immediately for UI feedback
      setMessages(prev => [...prev, tempMessage]);

      const { data } = await axios.post(`${API_URL}/upload`, {
        file: base64,
        filename: selectedMedia.name
      });

      const finalMessage = {
        ...tempMessage,
        media: data.url,
        status: 'sent'
      };
      
      setMessages(prev => prev.map(msg => 
        msg.timestamp === tempMessage.timestamp ? finalMessage : msg
      ));

      ws.current.send(JSON.stringify(finalMessage));
      
      // Close preview and reset
      setShowMediaPreview(false);
      setSelectedMedia(null);
      
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Error', 'Failed to upload file');
      // Remove the temporary message using timestamp
      setMessages(prev => prev.filter(msg => 
        !(msg.status === 'uploading' && msg.sender === username)
      ));
    }
  };

  const cancelMedia = () => {
    setSelectedMedia(null);
    setShowMediaPreview(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{recipient || room}</Text>
        <Text style={styles.connectionStatus}>
          {isConnected ? "online" : "connecting..."}
        </Text>
      </View>
      
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item, index) => `${item.sender}_${item.timestamp}_${index}`}
        style={styles.messageList}
        contentContainerStyle={styles.messageListContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            isOwn={item.sender === username}
            isPrivate={!!item.recipient}
          />
        )}
      />
      
      <KeyboardAvoidingView 
        behavior="padding" 
        keyboardVerticalOffset={100}
        style={styles.inputWrapper}
      >
        <View style={styles.inputContainer}>
          <TouchableOpacity style={styles.mediaButton} onPress={handleFileUpload}>
            <Text style={styles.mediaText}>+</Text>
          </TouchableOpacity>
          
          <TextInput
            style={styles.messageInput}
            placeholder="Type a message"
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
          />
          
          <TouchableOpacity 
            style={styles.sendButton} 
            onPress={sendMessage} 
            disabled={!newMessage.trim()}
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Media Preview Modal */}
      <Modal
        visible={showMediaPreview}
        transparent={true}
        animationType="slide"
        onRequestClose={cancelMedia}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Media Preview</Text>
            
            {selectedMedia && selectedMedia.uri && (
              <Image 
                source={{ uri: selectedMedia.uri }} 
                style={styles.mediaPreview} 
                resizeMode="contain"
              />
            )}
            
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={cancelMedia}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.sendMediaButton} onPress={sendMedia}>
                <Text style={styles.sendMediaButtonText}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#DCE5EE' // Classic WhatsApp light blue/gray background
  },
  header: {
    backgroundColor: '#075E54', // Classic WhatsApp dark green
    padding: 15,
    paddingTop: 40, // Extra padding for status bar
    borderBottomWidth: 1,
    borderBottomColor: '#054D44',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  connectionStatus: {
    fontSize: 12,
    color: '#C4E3E1',
    marginTop: 2,
  },
  messageList: {
    flex: 1,
    padding: 10,
  },
  messageListContent: {
    paddingBottom: 10,
  },
  inputWrapper: {
    borderTopWidth: 1,
    borderTopColor: '#BDC3C7',
    backgroundColor: '#EBEBEB',
  },
  inputContainer: { 
    flexDirection: 'row',
    alignItems: 'center', 
    padding: 8,
    backgroundColor: '#EBEBEB',
  },
  mediaButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#128C7E', // WhatsApp green
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  mediaText: { 
    color: 'white', 
    fontSize: 22,
    fontWeight: 'bold',
  },
  messageInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 80,
    borderColor: '#C8C8C8',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: 'white',
    fontSize: 16,
  },
  sendButton: {
    marginLeft: 8,
    height: 40,
    paddingHorizontal: 15,
    backgroundColor: '#25D366', // WhatsApp light green
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  sendButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 15,
  },
  // Media Preview Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#075E54',
    textAlign: 'center',
  },
  mediaPreview: {
    width: '100%',
    height: 300,
    borderRadius: 8,
    marginBottom: 15,
    backgroundColor: '#f0f0f0',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    padding: 12,
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
    marginRight: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: 'bold',
  },
  sendMediaButton: {
    flex: 1,
    padding: 12,
    backgroundColor: '#25D366',
    borderRadius: 8,
    alignItems: 'center',
  },
  sendMediaButtonText: {
    color: 'white',
    fontWeight: 'bold',
  }
});