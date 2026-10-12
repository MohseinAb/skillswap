import React, { useState, useEffect } from 'react';
import { Text, View, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { COLORS, styles } from '../styles';

import { auth, db } from '../firebaseConfig';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

// 1. Make sure { navigation } is added here
export default function MessagesScreen({ navigation }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Live listener for chats belonging to the current user
    const q = query(
      collection(db, "chats"), 
      where("participants", "array-contains", auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const msgs = [];
      querySnapshot.forEach((doc) => {
        msgs.push({ id: doc.id, ...doc.data() });
      });
      setMessages(msgs);
      setLoading(false);
    }, (error) => {
      console.error("Error listening to messages:", error);
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
            <Feather name="plus" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={[styles.searchContainer, { marginTop: 0 }]}>
          <Feather name="search" size={18} color={COLORS.textSecondary} />
          <TextInput 
            style={styles.searchInput} 
            placeholder="Search conversations..." 
            placeholderTextColor={COLORS.textSecondary} 
          />
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
                  // 2. Added the onPress navigation here
                  onPress={() => navigation.navigate('Chat', { chatId: msg.id, otherUserName: msg.freelancerName || "Freelancer" })}
                >
                  <View style={styles.msgAvatarContainer}>
                    <View style={styles.msgAvatar}>
                      <Feather name="user" size={20} color={COLORS.textSecondary} />
                    </View>
                  </View>
                  <View style={styles.msgContent}>
                    {/* 3. Display the freelancer's name instead of just "User" */}
                    <Text style={styles.msgName}>{msg.freelancerName || "Freelancer"}</Text>
                    <Text style={styles.msgPreview} numberOfLines={1}>{msg.lastMessage || "No messages yet."}</Text>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={{ alignItems: 'center', marginTop: 50 }}>
                <Feather name="message-square" size={40} color={COLORS.inputBorder} style={{ marginBottom: 15 }} />
                <Text style={styles.subtitle}>No messages yet.</Text>
              </View>
            )}
          </ScrollView>
        )}

      </SafeAreaView>
    </LinearGradient>
  );
}