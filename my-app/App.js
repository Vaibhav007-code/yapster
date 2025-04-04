import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AuthScreen from './src/screens/AuthScreen';
import RoomScreen from './src/screens/RoomScreen';
import ChatScreen from './src/screens/ChatScreen';
import UserListScreen from './src/screens/UserListScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: '#3498DB' },
            headerTintColor: 'white',
            headerTitleStyle: { fontSize: 20 }
          }}
        >
          <Stack.Screen name="Auth" component={AuthScreen} options={{ title: 'YAPSTER' }} />
          <Stack.Screen name="Rooms" component={RoomScreen} options={{ title: 'Chat Rooms' }} />
          <Stack.Screen name="Chat" component={ChatScreen} />
          <Stack.Screen name="Users" component={UserListScreen} options={{ title: 'All Users' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}