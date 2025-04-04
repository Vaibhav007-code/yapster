import React from 'react';
import { View, TextInput, Button, FlatList, StyleSheet } from 'react-native';
import emojis from 'emoji-datasource';

export default function EmojiPicker({ onSelect }) {
  const [search, setSearch] = useState('');
  
  const filteredEmojis = emojis.filter(emoji =>
    emoji.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Search emojis..."
        value={search}
        onChangeText={setSearch}
      />
      <FlatList
        data={filteredEmojis}
        keyExtractor={item => item.unified}
        numColumns={8}
        renderItem={({ item }) => (
          <Text style={styles.emoji} onPress={() => onSelect(item)}>
            {String.fromCodePoint(parseInt(item.unified, 16))}
          </Text>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { maxHeight: 200, padding: 10 },
  search: { height: 40, borderColor: 'gray', borderWidth: 1, marginBottom: 10, padding: 10 },
  emoji: { fontSize: 24, margin: 2 }
});