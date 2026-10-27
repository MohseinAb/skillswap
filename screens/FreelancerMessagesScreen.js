import React, { useState, useEffect } from 'react';
import { Text, View, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { COLORS, styles } from '../styles';

import { auth, db } from '../firebaseConfig';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export default function FreelancerMessagesScreen({ navigation }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, "chats"), 
      where("participants", "array-contains", auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = [];
      snapshot.forEach((doc) => msgs.push({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <LinearGradient colors={[COLORS.bgTop, COLORS.bgBottom]} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Messages</Text>
          <TouchableOpacity style={styles.headerIconBtn}>
            <Feather name="search" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={[styles.searchContainer, { marginTop: 0 }]}>
          <Feather name="search" size={18} color={COLORS.textSecondary} />
          <TextInput style={styles.searchInput} placeholder="Search client inquiries..." placeholderTextColor={COLORS.textSecondary} />
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} />
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            {messages.length > 0 ? (
              messages.map((msg) => (
                <TouchableOpacity 
                  key={msg.id} 
                  style={styles.msgCard}
                  onPress={() => navigation.navigate('Chat', { chatId: msg.id, otherUserName: msg.clientName })}
                >
                  <View style={styles.msgAvatarContainer}>
                    <View style={styles.msgAvatar}><Feather name="user" size={20} color={COLORS.textSecondary} /></View>
                  </View>
                  <View style={styles.msgContent}>
                    <View style={styles.msgTopRow}>
                      <Text style={styles.msgName}>{msg.clientName || "Client"}</Text>
                      <Text style={styles.msgTime}>Today</Text>
                    </View>
                    <Text style={[styles.msgPreview, { color: COLORS.text, fontWeight: '500' }]} numberOfLines={1}>{msg.lastMessage || "No messages yet."}</Text>
                    <Text style={[styles.msgRole, { marginLeft: 0, marginTop: 4 }]}>Project: {msg.projectName || msg.projectTitle || "General Inquiry"}</Text>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={{ alignItems: 'center', marginTop: 50 }}>
                <Feather name="message-square" size={40} color={COLORS.inputBorder} style={{ marginBottom: 15 }} />
                <Text style={styles.subtitle}>No client inquiries yet.</Text>
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}