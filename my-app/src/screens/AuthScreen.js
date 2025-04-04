import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Image } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { API_URL } from '../config';

export default function AuthScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);

  const handleAuth = async () => {
    try {
      const endpoint = isLogin ? '/login' : '/register';
      const { data } = await axios.post(`${API_URL}${endpoint}`, { username, password });
      
      if (data.message) {
        await AsyncStorage.setItem('user', username);
        navigation.navigate('Rooms');
      }
    } catch (error) {
      alert(error.response?.data?.error || 'Authentication failed');
    }
  };

  return (
    <LinearGradient colors={['#3498db', '#2c3e50']} style={styles.container}>
      <KeyboardAvoidingView behavior="padding" style={styles.innerContainer}>
        <MaterialIcons name="chat-bubble" size={80} color="#ecf0f1" style={styles.icon} />
        <Text style={styles.title}>{isLogin ? 'Welcome Back!' : 'Create Account'}</Text>
        
        <View style={styles.inputContainer}>
          <MaterialIcons name="person" size={24} color="#7f8c8d" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor="#95a5a6"
            value={username}
            onChangeText={setUsername}
          />
        </View>

        <View style={styles.inputContainer}>
          <MaterialIcons name="lock" size={24} color="#7f8c8d" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#95a5a6"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        <TouchableOpacity style={styles.authButton} onPress={handleAuth}>
          <LinearGradient colors={['#e74c3c', '#c0392b']} style={styles.gradient}>
            <Text style={styles.buttonText}>{isLogin ? 'Sign In' : 'Create Account'}</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
          <Text style={styles.switchText}>
            {isLogin ? 'New user? Create account' : 'Existing user? Sign in'}
          </Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  innerContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    padding: 30 
  },
  icon: {
    alignSelf: 'center',
    marginBottom: 30
  },
  title: {
    fontSize: 28,
    color: '#ecf0f1',
    marginBottom: 40,
    textAlign: 'center',
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(236, 240, 241, 0.9)',
    borderRadius: 25,
    marginBottom: 15,
    paddingHorizontal: 20,
    elevation: 3
  },
  inputIcon: {
    marginRight: 10
  },
  input: {
    flex: 1,
    height: 50,
    color: '#2c3e50',
    fontSize: 16,
  },
  authButton: {
    marginTop: 20,
    borderRadius: 25,
    overflow: 'hidden',
    elevation: 5
  },
  gradient: {
    paddingVertical: 15,
    paddingHorizontal: 30,
    alignItems: 'center'
  },
  buttonText: {
    color: '#ecf0f1',
    fontSize: 18,
    fontWeight: '500',
    letterSpacing: 1.1
  },
  switchText: {
    color: '#bdc3c7',
    textAlign: 'center',
    marginTop: 20,
    fontSize: 14,
    textDecorationLine: 'underline'
  }
});