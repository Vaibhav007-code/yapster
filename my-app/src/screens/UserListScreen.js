import React, { useState, useEffect } from 'react';
import { View, FlatList, Text, StyleSheet, TouchableOpacity } from 'react-native';
import axios from 'axios';
import { MaterialIcons } from '@expo/vector-icons';
import { API_URL } from '../config';

export default function UserListScreen({ navigation, route }) {
  const [users, setUsers] = useState([]);

  // Set the header title if not already set in the navigation config
  useEffect(() => {
    navigation.setOptions({
      title: 'Active Users',
      headerStyle: {
        backgroundColor: '#075E54',
      },
      headerTintColor: 'white',
      headerTitleStyle: {
        fontWeight: 'bold',
      },
    });
  }, [navigation]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const { data } = await axios.get(`${API_URL}/users`);
        setUsers(data);
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };
    fetchUsers();
    const interval = setInterval(fetchUsers, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Available Contacts</Text>
        <Text style={styles.subHeaderText}>{users.length} users</Text>
      </View>
      
      <FlatList
        data={users}
        keyExtractor={item => item.username}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.userCard}
            onPress={() => navigation.navigate('Chat', { 
              recipient: item.username,
              room: `Chat with ${item.username}`
            })}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {item.username.charAt(0).toUpperCase()}
              </Text>
            </View>
            
            <View style={styles.userInfo}>
              <Text style={styles.username}>{item.username}</Text>
              <Text style={[
                styles.status,
                item.online ? styles.statusOnline : styles.statusOffline
              ]}>
                {item.online ? 'online' : 'last seen recently'}
              </Text>
            </View>
            
            {item.online && <View style={styles.onlineDot} />}
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#EDEDED' 
  },
  header: {
    backgroundColor: '#075E54',
    padding: 15,
    paddingTop: 25,
  },
  headerText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  subHeaderText: {
    color: '#C4E3E1',
    fontSize: 12,
    marginTop: 2,
  },
  listContent: { 
    backgroundColor: 'white' 
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    position: 'relative',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#128C7E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold'
  },
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#25D366',
    position: 'absolute',
    right: 15,
    top: '50%',
    marginTop: -5,
  },
  userInfo: {
    flex: 1,
    borderBottomWidth: 0,
  },
  username: {
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: '500',
  },
  status: {
    fontSize: 13,
    marginTop: 3,
  },
  statusOnline: {
    color: '#25D366',
  },
  statusOffline: {
    color: '#7f8c8d',
  },
  separator: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginLeft: 75,
  }
});