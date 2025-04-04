import React, { useState, useEffect } from 'react'; 
import { View, Text, FlatList, TextInput, StyleSheet, TouchableOpacity, Alert, Switch, ScrollView } from 'react-native'; 
import axios from 'axios'; 
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import { API_URL } from '../config';  

export default function RoomScreen({ navigation }) {   
  const [rooms, setRooms] = useState([]);   
  const [newRoom, setNewRoom] = useState('');   
  const [username, setUsername] = useState('');  
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {     
    const loadUser = async () => {       
      const user = await AsyncStorage.getItem('user');       
      setUsername(user);     
    };     
    loadUser();     
    fetchRooms();   
  }, []);    

  const fetchRooms = async () => {     
    try {       
      const { data } = await axios.get(`${API_URL}/rooms`);       
      setRooms(data);     
    } catch (error) {       
      console.error('Error fetching rooms:', error);     
    }   
  };    

  const createRoom = async () => {     
    if (!newRoom.trim()) {
      Alert.alert('Error', 'Please enter a room name');
      return;
    }
    
    if (isPrivate && !password.trim()) {
      Alert.alert('Error', 'Please enter a password for private room');
      return;
    }
    
    try {       
      await axios.post(`${API_URL}/rooms`, { 
        room: newRoom, 
        username,
        isPrivate,
        password: isPrivate ? password : '' 
      });       
      setNewRoom('');
      setPassword('');
      setIsPrivate(false);
      setShowCreateForm(false);
      fetchRooms();     
    } catch (error) {       
      Alert.alert('Error', error.response?.data?.error || 'Failed to create room');     
    }   
  };    

  const deleteRoom = async (roomName) => {     
    try {       
      await axios.delete(`${API_URL}/rooms`, { data: { room: roomName, username } });       
      fetchRooms();     
    } catch (error) {       
      Alert.alert('Error', error.response?.data?.error || 'Failed to delete room');     
    }   
  };

  const handleJoinRoom = (item) => {
    if (item.isPrivate && item.admin !== username) {
      // Ask for password if room is private and user is not the admin
      Alert.prompt(
        'Private Room',
        'Please enter the password to join this room:',
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Join',
            onPress: async (password) => {
              try {
                const response = await axios.post(`${API_URL}/joinRoom`, {
                  room: item.name,
                  username,
                  password
                });
                
                if (response.data.success) {
                  navigation.navigate('Chat', { room: item.name });
                }
              } catch (error) {
                Alert.alert('Error', error.response?.data?.error || 'Incorrect password');
              }
            }
          }
        ],
        'secure-text'
      );
    } else {
      // Public room or user is the admin - join directly
      navigation.navigate('Chat', { room: item.name });
    }
  };

  const toggleCreateForm = () => {
    setShowCreateForm(!showCreateForm);
  };

  return (     
    <View style={styles.container}>       
      <View style={styles.header}>
        <Text style={styles.title}>Welcome, {username}</Text>
        <View style={styles.headerIcons}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.navigate('Users')}
          >
            <View style={styles.iconCircle}>
              <Text style={styles.iconText}>👤</Text>
            </View>
            <Text style={styles.iconLabel}>Users</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.iconButton}
            onPress={toggleCreateForm}
          >
            <View style={styles.iconCircle}>
              <Text style={styles.iconText}>＋</Text>
            </View>
            <Text style={styles.iconLabel}>Create</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.mainContent}>
        {showCreateForm && (
          <View style={styles.createContainer}>
            <View style={styles.createHeader}>
              <Text style={styles.createTitle}>Create New Room</Text>
              <TouchableOpacity onPress={toggleCreateForm}>
                <Text style={styles.closeButton}>×</Text>
              </TouchableOpacity>
            </View>
            
            <TextInput           
              style={styles.input}           
              placeholder="Room Name"           
              value={newRoom}           
              onChangeText={setNewRoom}
              placeholderTextColor="#888"
            />
            
            <View style={styles.switchContainer}>
              <Text style={styles.switchLabel}>Private Room</Text>
              <Switch
                value={isPrivate}
                onValueChange={setIsPrivate}
                trackColor={{ false: "#d0d0d0", true: "#9FD6B6" }}
                thumbColor={isPrivate ? "#4AAF7B" : "#f4f3f4"}
              />
            </View>
            
            {isPrivate && (
              <TextInput
                style={styles.input}
                placeholder="Room Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholderTextColor="#888"
              />
            )}
            
            <TouchableOpacity style={styles.createButton} onPress={createRoom}>
              <Text style={styles.createButtonText}>Create Room</Text>
            </TouchableOpacity>
          </View>
        )}
        
        <View style={styles.roomsSection}>
          <Text style={styles.sectionTitle}>Available Rooms</Text>
          
          {rooms.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No rooms available.</Text>
              <Text style={styles.emptyStateSubtext}>Create a new room to get started!</Text>
            </View>
          ) : (
            <FlatList
              data={rooms}
              keyExtractor={(item) => item.name}
              scrollEnabled={false}
              contentContainerStyle={styles.roomList}
              renderItem={({ item }) => (
                <View style={styles.roomCard}>
                  <TouchableOpacity
                    style={styles.roomItem}
                    onPress={() => handleJoinRoom(item)}
                  >
                    <View style={[styles.roomIcon, item.isPrivate && styles.privateRoomIcon]}>
                      <Text style={styles.roomIconText}>{item.name.charAt(0).toUpperCase()}</Text>
                      {item.isPrivate && (
                        <View style={styles.lockIcon}>
                          <Text style={styles.lockIconText}>🔒</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.roomDetails}>
                      <Text style={styles.roomText}>{item.name}</Text>
                      <Text style={styles.roomAdmin}>Created by {item.admin}</Text>
                    </View>
                    
                    <View style={styles.joinButton}>
                      <Text style={styles.joinButtonText}>Join</Text>
                    </View>
                  </TouchableOpacity>
                  
                  {item.admin === username && (
                    <TouchableOpacity 
                      style={styles.deleteButton} 
                      onPress={() => deleteRoom(item.name)}
                    >
                      <Text style={styles.deleteText}>Delete Room</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            />
          )}
        </View>
      </ScrollView>
      
      {!showCreateForm && (
        <TouchableOpacity 
          style={styles.fab} 
          onPress={toggleCreateForm}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}
    </View>   
  ); 
}  

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#406882',
    paddingTop: 48,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  title: { 
    fontSize: 24, 
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 16
  },
  headerIcons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  iconButton: {
    alignItems: 'center',
    padding: 10,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1A374D',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  iconText: {
    color: 'white',
    fontSize: 20,
  },
  iconLabel: {
    color: 'white',
    fontSize: 12,
    marginTop: 2,
  },
  mainContent: {
    flex: 1,
    padding: 15,
  },
  createContainer: { 
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  createHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  createTitle: {
    fontSize: 18,
    color: '#1A374D',
    fontWeight: 'bold',
  },
  closeButton: {
    fontSize: 24,
    color: '#999',
    fontWeight: 'bold',
  },
  input: {     
    height: 50,     
    borderColor: '#E0E0E0',     
    borderWidth: 1,     
    padding: 12,
    paddingHorizontal: 16,
    borderRadius: 10,     
    backgroundColor: '#F8F8F8',
    marginBottom: 15,
    fontSize: 15,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingHorizontal: 5,
  },
  switchLabel: {
    fontSize: 15,
    color: '#333',
  },
  createButton: {
    backgroundColor: '#4AAF7B',
    paddingVertical: 14,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 5,
  },
  createButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  roomsSection: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    color: '#1A374D',
    fontWeight: 'bold',
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  roomList: {
    paddingBottom: 5,
  },
  roomCard: {
    marginBottom: 15,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  roomItem: {     
    backgroundColor: 'white',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  roomIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#6998AB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  privateRoomIcon: {
    backgroundColor: '#B1A296',
  },
  roomIconText: {
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
  },
  lockIcon: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#FFCE54',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'white',
  },
  lockIconText: {
    fontSize: 10,
  },
  roomDetails: {
    flex: 1,
  },
  roomText: { 
    fontSize: 17, 
    color: '#333',
    fontWeight: '600',
  },     
  roomAdmin: { 
    fontSize: 13, 
    color: '#7F8C8D', 
    marginTop: 4,
  },
  joinButton: {
    backgroundColor: '#F0F7FF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D0E1F9',
  },
  joinButtonText: {
    color: '#406882',
    fontWeight: '600',
    fontSize: 14,
  },
  deleteButton: {
    backgroundColor: '#FFF0F0',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#FFEEEE',
    alignItems: 'center',
  },
  deleteText: { 
    color: '#E57373', 
    fontWeight: '600',
    fontSize: 14, 
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4AAF7B',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  fabText: {
    fontSize: 28,
    color: 'white',
    fontWeight: 'bold',
  }
});