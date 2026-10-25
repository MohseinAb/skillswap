import React, { useState, useEffect, useRef } from 'react';
import { 
  Text, View, TextInput, TouchableOpacity, ScrollView, 
  KeyboardAvoidingView, Platform, ActivityIndicator 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { COLORS, styles } from '../styles';

import { auth, db } from '../firebaseConfig';
import { 
  collection, doc, getDoc, addDoc, updateDoc, 
  query, orderBy, onSnapshot, serverTimestamp 
} from 'firebase/firestore';

export default function ChatScreen({ route, navigation }) {
  const { chatId, otherUserName } = route.params || {};
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [currentUserData, setCurrentUserData] = useState(null);
  const [chatData, setChatData] = useState(null);
  const [loading, setLoading] = useState(true);
  const scrollViewRef = useRef();

  useEffect(() => {
    if (auth.currentUser) {
      getDoc(doc(db, 'users', auth.currentUser.uid)).then((snap) => {
        if (snap.exists()) setCurrentUserData(snap.data());
      });
    }

    if (!chatId) {
      setLoading(false);
      return;
    }

    // Listen to chat document metadata
    const unsubChat = onSnapshot(doc(db, 'chats', chatId), (docSnap) => {
      if (docSnap.exists()) {
        setChatData({ id: docSnap.id, ...docSnap.data() });
      }
    });

    // Listen to messages in real time
    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubMessages = onSnapshot(q, (snapshot) => {
      const loaded = [];
      snapshot.forEach((docSnap) => {
        loaded.push({ id: docSnap.id, ...docSnap.data() });
      });
      setMessages(loaded);
      setLoading(false);
    });

    return () => {
      unsubChat();
      unsubMessages();
    };
  }, [chatId]);

  const isAdmin = 
    (currentUserData?.role || currentUserData?.accountType || '').toLowerCase() === 'admin' ||
    auth.currentUser?.email?.toLowerCase() === 'admin@skillswap.ph';

  const handleSendMessage = async () => {
    if (!inputText.trim() || !auth.currentUser || !chatId) return;

    const cleanText = inputText.trim();
    setInputText('');

    try {
      const senderName = currentUserData?.fullName || currentUserData?.name || auth.currentUser.email?.split('@')[0] || 'User';

      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        text: cleanText,
        senderId: auth.currentUser.uid,
        senderName: senderName,
        senderRole: isAdmin ? 'ADMIN' : (currentUserData?.role || 'USER').toUpperCase(),
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: isAdmin ? `[ADMIN] ${cleanText}` : cleanText,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const displayOtherName = otherUserName || 
    (auth.currentUser?.uid === chatData?.clientId ? chatData?.freelancerName : chatData?.clientName) || 
    'User';

  return (
    <LinearGradient colors={[COLORS.bgTop, COLORS.bgBottom]} style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right', 'bottom']}>
        <KeyboardAvoidingView 
          style={{ flex: 1 }} 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Curved Top Chat Header */}
          <View style={styles.chatHeaderBg}>
            <View style={styles.chatHeaderLeft}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 5 }}>
                <Feather name="chevron-left" size={24} color={COLORS.primary} />
              </TouchableOpacity>
              
              <View style={styles.chatAvatarWrapper}>
                <View style={[styles.chatHeaderAvatar, { borderWidth: 1, borderColor: COLORS.primary }]}>
                  <Feather name="user" size={18} color={COLORS.primary} />
                </View>
                <View style={styles.onlineDot} />
              </View>

              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.chatHeaderName} numberOfLines={1}>
                    {displayOtherName.replace(/\s*\[ADMIN\]/gi, '')}
                  </Text>
                  {displayOtherName.includes('[ADMIN]') && (
                    <View style={{ backgroundColor: COLORS.primary, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, marginLeft: 6 }}>
                      <Text style={{ color: '#000', fontSize: 9, fontWeight: 'bold' }}>ADMIN</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.chatHeaderStatus} numberOfLines={1}>
                  {chatData?.projectTitle ? `Project: ${chatData.projectTitle}` : 'Online'}
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.detailsBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.detailsBtnText}>Details</Text>
            </TouchableOpacity>
          </View>

          {/* Messages Scroll Area */}
          {loading ? (
            <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50, flex: 1 }} />
          ) : (
            <ScrollView
              ref={scrollViewRef}
              style={styles.chatArea}
              contentContainerStyle={{ paddingBottom: 20 }}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
            >
              <View style={styles.datePillWrapper}>
                <View style={styles.datePill}>
                  <Text style={styles.datePillText}>TODAY</Text>
                </View>
              </View>

              {messages.map((msg) => {
                const isSent = msg.senderId === auth.currentUser?.uid;
                const isMsgAdmin = msg.senderRole === 'ADMIN' || (msg.text && msg.text.startsWith('[ADMIN]'));
                const cleanMsgText = msg.text ? msg.text.replace(/^\[ADMIN\]\s*/i, '') : '';

                return (
                  <View
                    key={msg.id}
                    style={[styles.msgRow, isSent ? styles.msgRowSent : styles.msgRowReceived]}
                  >
                    {!isSent && (
                      <View style={[styles. bubble, styles.bubbleReceived, isMsgAdmin && { borderColor: COLORS.primary }]}>
                        {isMsgAdmin && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                            <View style={{ backgroundColor: COLORS.primary, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5 }}>
                              <Text style={{ color: '#000', fontSize: 9, fontWeight: 'bold' }}>ADMIN</Text>
                            </View>
                            <Text style={{ color: COLORS.primary, fontSize: 10, fontWeight: 'bold', marginLeft: 6 }}>
                              {msg.senderName?.replace(/\s*\[ADMIN\]/gi, '') || 'SkillSwap Admin'}
                            </Text>
                          </View>
                        )}
                        <Text style={styles.bubbleTextReceived}>{cleanMsgText}</Text>
                      </View>
                    )}

                    <Text style={styles.msgTimestamp}>{formatTime(msg.createdAt)}</Text>

                    {isSent && (
                      <View style={[styles.bubble, styles.bubbleSent]}>
                        {isMsgAdmin && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                            <View style={{ backgroundColor: '#000', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5 }}>
                              <Text style={{ color: COLORS.primary, fontSize: 9, fontWeight: 'bold' }}>ADMIN</Text>
                            </View>
                          </View>
                        )}
                        <Text style={styles.bubbleTextSent}>{cleanMsgText}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          )}

          {/* Bottom Message Input Bar */}
          <View style={styles.inputArea}>
            <TouchableOpacity style={styles.plusIconBtn}>
              <Feather name="plus" size={18} color={COLORS.primary} />
            </TouchableOpacity>

            <View style={styles.chatInputWrapper}>
              <TextInput
                style={styles.chatInput}
                placeholder={isAdmin ? "Message as Admin..." : "Type a message..."}
                placeholderTextColor={COLORS.textSecondary}
                value={inputText}
                onChangeText={setInputText}
                onSubmitEditing={handleSendMessage}
              />
            </View>

            <TouchableOpacity style={styles.sendBtn} onPress={handleSendMessage}>
              <Feather name="send" size={16} color="#000" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}