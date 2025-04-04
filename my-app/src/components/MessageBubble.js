import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';

export default function MessageBubble({ message, isOwn, isPrivate }) {
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={[
      styles.container,
      isOwn ? styles.ownContainer : styles.otherContainer
    ]}>
      {!isOwn && (
        <Text style={styles.sender}>{message.sender}</Text>
      )}
      
      {message.text ? (
        <View style={[
          styles.bubble,
          isOwn ? styles.ownBubble : styles.otherBubble,
          isPrivate && styles.privateBubble
        ]}>
          <Text style={styles.text}>{message.text}</Text>
          <Text style={styles.timestamp}>{formatTime(message.timestamp)}</Text>
          
          {isOwn && (
            <View style={styles.tickContainer}>
              <Text style={styles.tickMark}>✓</Text>
            </View>
          )}
        </View>
      ) : message.media && (
        <View style={[
          styles.mediaBubble,
          isOwn ? styles.ownBubble : styles.otherBubble
        ]}>
          <Image 
            source={{ uri: message.media }} 
            style={styles.mediaImage} 
            resizeMode="cover"
          />
          <Text style={styles.timestamp}>{formatTime(message.timestamp)}</Text>
          
          {message.status === 'uploading' && (
            <View style={styles.uploadingOverlay}>
              <Text style={styles.uploadingText}>Uploading...</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    maxWidth: '80%',
  },
  ownContainer: {
    alignSelf: 'flex-end',
    marginRight: 8,
  },
  otherContainer: {
    alignSelf: 'flex-start',
    marginLeft: 8,
  },
  sender: {
    fontSize: 12,
    color: '#128C7E',
    marginBottom: 2,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  bubble: {
    padding: 8,
    paddingRight: 36, // Space for timestamp
    borderRadius: 8,
    position: 'relative',
  },
  ownBubble: {
    backgroundColor: '#DCF8C6', // Classic WhatsApp light green
    borderTopRightRadius: 0,
  },
  otherBubble: {
    backgroundColor: 'white',
    borderTopLeftRadius: 0,
  },
  privateBubble: {
    backgroundColor: '#FFF0C4', // Light yellow for private messages
  },
  text: {
    fontSize: 15,
    color: '#303030',
  },
  timestamp: {
    position: 'absolute',
    bottom: 4,
    right: 8,
    fontSize: 10,
    color: '#7F8C8D',
  },
  tickContainer: {
    position: 'absolute',
    bottom: 4,
    right: 34, // Just before timestamp
  },
  tickMark: {
    fontSize: 10,
    color: '#34B7F1',
  },
  mediaBubble: {
    padding: 4,
    paddingBottom: 16, // Space for timestamp
    borderRadius: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  mediaImage: {
    width: 200,
    height: 200,
    borderRadius: 4,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
});