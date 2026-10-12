import React, { useState, useEffect } from 'react';
import { Text, View, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, Ionicons } from '@expo/vector-icons';
import { COLORS, styles } from '../styles';

import { auth, db } from '../firebaseConfig';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';

export default function ChatScreen({ route, navigation }) {
  // We expect the previous screen to pass the chatId and the other user's name
  const { chatId, otherUserName } = route.params || { chatId: 'temp-chat-id', otherUserName: 'User' };
  
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);

  // Live listener for messages in this specific chat
  useEffect(() => {
    if (!auth.currentUser || !chatId) return;

    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedMessages = [];
      snapshot.forEach((doc) => {
        loadedMessages.push({ id: doc.id, ...doc.data() });
      });
      setMessages(loadedMessages);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [chatId]);

  const handleSend = async () => {
    if (newMessage.trim() === '') return;

    try {
      const messageText = newMessage;
      setNewMessage(''); // Clear input instantly for better UX
      
      await addDoc(collection(db, "chats", chatId, "messages"), {
        text: messageText,
        senderId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  return (
    <LinearGradient colors={[COLORS.bgTop, COLORS.bgBottom]} style={styles.container}>
      <SafeAreaView style={[styles.safeArea, { padding: 0 }]} edges={['top', 'left', 'right']}>
        
        {/* Curved Header */}
        <View style={styles.chatHeaderBg}>
          <View style={styles.chatHeaderLeft}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Feather name="chevron-left" size={24} color={COLORS.primary} />
            </TouchableOpacity>
            <View style={styles.chatAvatarWrapper}>
              <View style={styles.chatHeaderAvatar}>
                <Feather name="user" size={18} color={COLORS.textSecondary} />
              </View>
              <View style={styles.onlineDot} />
            </View>
            <View>
              <Text style={styles.chatHeaderName}>{otherUserName}</Text>
              <Text style={styles.chatHeaderStatus}>Online</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.detailsBtn}>
            <Text style={styles.detailsBtnText}>Details</Text>
          </TouchableOpacity>
        </View>

        {/* Chat Area */}
        <KeyboardAvoidingView 
          style={{ flex: 1 }} 
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView contentContainerStyle={styles.chatArea} showsVerticalScrollIndicator={false}>
            {loading ? (
              <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: 20 }} />
            ) : messages.length === 0 ? (
              <View style={{ alignItems: 'center', marginTop: 40 }}>
                <Text style={styles.subtitle}>No messages yet. Say hi!</Text>
              </View>
            ) : (
              <>
                <View style={styles.datePillWrapper}>
                  <View style={styles.datePill}><Text style={styles.datePillText}>TODAY</Text></View>
                </View>

                {messages.map((msg) => {
                  const isSent = msg.senderId === auth.currentUser?.uid;
                  return (
                    <View key={msg.id} style={[styles.msgRow, isSent ? styles.msgRowSent : styles.msgRowReceived]}>
                      {!isSent && <Text style={styles.msgTimestamp}>11:35 AM</Text> /* Hardcoded time for layout purposes until timestamp formatter is built */}
                      
                      <View style={[styles.bubble, isSent ? styles.bubbleSent : styles.bubbleReceived]}>
                        <Text style={isSent ? styles.bubbleTextSent : styles.bubbleTextReceived}>
                          {msg.text}
                        </Text>
                      </View>

                      {isSent && <Text style={styles.msgTimestamp}>11:42 AM</Text>}
                    </View>
                  );
                })}
              </>
            )}
          </ScrollView>

          {/* Input Bar */}
          <View style={styles.inputArea}>
            <TouchableOpacity style={styles.plusIconBtn}>
              <Feather name="plus" size={16} color={COLORS.textSecondary} />
            </TouchableOpacity>
            
            <View style={styles.chatInputWrapper}>
              <TextInput 
                style={styles.chatInput}
                placeholder="Type a message..."
                placeholderTextColor={COLORS.textSecondary}
                value={newMessage}
                onChangeText={setNewMessage}
              />
            </View>

            <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
              <Ionicons name="send" size={14} color="#000" style={{ marginLeft: 3 }} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

      </SafeAreaView>
    </LinearGradient>
  );
}