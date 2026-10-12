import React, { useState, useEffect } from 'react';
import { Text, View, TextInput, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, Ionicons } from '@expo/vector-icons';
import { COLORS, styles } from '../styles';

import { auth, db } from '../firebaseConfig';
import { collection, query, where, getDocs, doc, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';

export default function SearchScreen({ navigation }) {
  const [freelancers, setFreelancers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch all freelancers for the search feed
  useEffect(() => {
    const fetchFreelancers = async () => {
      try {
        const q = query(collection(db, "users"), where("role", "==", "freelancer"));
        const querySnapshot = await getDocs(q);
        
        const freelancerList = [];
        querySnapshot.forEach((doc) => {
          freelancerList.push({ id: doc.id, ...doc.data() });
        });
        
        setFreelancers(freelancerList);
      } catch (error) {
        console.error("Error fetching freelancers:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchFreelancers();
  }, []);

  // Handle the Booking & Chat creation process
  const handleBookService = async (freelancer) => {
    try {
      const currentUserId = auth.currentUser.uid;

      // 1. Get the Client's name from the database
      const userDoc = await getDoc(doc(db, "users", currentUserId));
      const clientName = userDoc.exists() ? userDoc.data().fullName : "Client";
      const projectName = freelancer.primarySkill || "Service Request";

      // 2. Create the Booking Document (Shows up on Freelancer Home Screen)
      await addDoc(collection(db, "bookings"), {
        clientId: currentUserId,
        clientName: clientName,
        freelancerId: freelancer.id,
        freelancerName: freelancer.fullName,
        title: projectName,
        status: "pending", // Starts as pending for the freelancer to accept
        price: 0, // Placeholder price
        createdAt: serverTimestamp()
      });

      // 3. Check if a chat already exists between these two users
      const chatQuery = query(collection(db, "chats"), where("participants", "array-contains", currentUserId));
      const chatSnap = await getDocs(chatQuery);
      
      let existingChatId = null;
      chatSnap.forEach((doc) => {
        if (doc.data().participants.includes(freelancer.id)) {
          existingChatId = doc.id;
        }
      });

      // 4. If no chat exists, create a new one
      if (!existingChatId) {
        const chatRef = await addDoc(collection(db, "chats"), {
          participants: [currentUserId, freelancer.id],
          clientName: clientName,
          freelancerName: freelancer.fullName,
          projectName: projectName,
          lastMessage: "I would like to book your service.",
          updatedAt: serverTimestamp()
        });
        
        existingChatId = chatRef.id;

        // Send the automatic first message inside the chat
        await addDoc(collection(db, "chats", existingChatId, "messages"), {
          text: "I would like to book your service.",
          senderId: currentUserId,
          createdAt: serverTimestamp()
        });
      }

      // 5. Navigate the client straight into the chat room
      navigation.navigate('Chat', { 
        chatId: existingChatId, 
        otherUserName: freelancer.fullName 
      });

    } catch (error) {
      console.error("Booking Error:", error);
      Alert.alert("Error", "Could not process booking. Please try again.");
    }
  };

  return (
    <LinearGradient colors={[COLORS.bgTop, COLORS.bgBottom]} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        
        <View style={styles.searchHeaderRow}>
          <Text style={[styles.logoText, { marginBottom: 0, fontSize: 16 }]}>SKILLSWAP</Text>
          <View style={styles.searchProfileIcon}>
            <Feather name="user" size={18} color={COLORS.primary} />
          </View>
        </View>

        <View style={styles.searchContainer}>
          <Feather name="search" size={18} color={COLORS.textSecondary} />
          <TextInput 
            style={styles.searchInput} 
            placeholder="Search Freelancers or Skills..." 
            placeholderTextColor={COLORS.textSecondary} 
          />
        </View>

        <View style={styles.filterRow}>
          {['Category', 'Location', 'Price'].map((filter, index) => (
            <TouchableOpacity key={index} style={styles.filterPill}>
              <Text style={styles.filterText}>{filter}</Text>
              <Feather name="chevron-down" size={12} color={COLORS.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} />
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            {freelancers.map((freelancer) => (
              <View key={freelancer.id} style={styles.freelancerCard}>
                <View style={styles.fcTopRow}>
                  <View style={styles.fcLeftInfo}>
                    {freelancer.idImage ? (
                      <Image source={{ uri: `data:image/jpeg;base64,${freelancer.idImage}` }} style={styles.fcAvatar} />
                    ) : (
                      <View style={styles.fcAvatar}><Feather name="user" size={20} color={COLORS.textSecondary} /></View>
                    )}
                    
                    <View style={styles.fcNameRole}>
                      <Text style={styles.fcName}>{freelancer.fullName}</Text>
                      <Text style={styles.fcRole}>{freelancer.primarySkill || 'SkillSwap Freelancer'}</Text>
                      <View style={styles.fcLocationRow}>
                        <Ionicons name="location-outline" size={12} color={COLORS.primary} />
                        <Text style={styles.fcLocationText}>{freelancer.city || 'Unknown Location'}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.fcRightInfo}>
                    <View style={styles.fcRatingRow}>
                      <Ionicons name="star" size={14} color={COLORS.primary} />
                      <Text style={styles.fcRatingText}>5.0</Text>
                    </View>
                    <Text style={styles.fcPrice}>₱0/hr</Text>
                  </View>
                </View>
                
                {/* Book Service Button */}
                <TouchableOpacity 
                  style={styles.bookBtn} 
                  onPress={() => handleBookService(freelancer)}
                >
                  <Text style={styles.bookBtnText}>Book Service</Text>
                </TouchableOpacity>
              </View>
            ))}
            
            {freelancers.length === 0 && (
              <Text style={[styles.subtitle, { marginTop: 40 }]}>No freelancers found in your area.</Text>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}