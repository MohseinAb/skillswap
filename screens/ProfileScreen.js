import React, { useState, useEffect } from 'react';
import { Text, View, TouchableOpacity, ScrollView, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { COLORS, styles } from '../styles';

import { auth, db } from '../firebaseConfig';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export default function ProfileScreen({ navigation }) {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch the current user's data from Firestore
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        if (auth.currentUser) {
          const docRef = doc(db, "users", auth.currentUser.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            setUserData(docSnap.data());
          }
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    navigation.reset({ index: 0, routes: [{ name: 'GetStarted' }] });
  };

  if (loading) {
    return (
      <LinearGradient colors={[COLORS.bgTop, COLORS.bgBottom]} style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={[COLORS.bgTop, COLORS.bgBottom]} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Text style={styles.headerText}>My Profile</Text>

        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.profileAvatarContainer}>
            {/* Render Base64 Image if it exists, otherwise show default icon */}
            {userData?.idImage ? (
              <Image 
                source={{ uri: `data:image/jpeg;base64,${userData.idImage}` }} 
                style={styles.profileAvatar} 
              />
            ) : (
              <View style={styles.profileAvatar}>
                <Feather name="user" size={32} color={COLORS.textSecondary} />
              </View>
            )}
            
            <Text style={styles.profileName}>{userData?.fullName || 'No Name'}</Text>
            <Text style={styles.profileRole}>{userData?.role?.toUpperCase() || 'ACCOUNT'}</Text>
          </View>

          <Text style={styles.sectionTitle}>ACCOUNT INFO</Text>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Email Address</Text>
            <Text style={styles.infoValue}>{userData?.email || 'N/A'}</Text>
            <Text style={styles.infoLabel}>Location</Text>
            <Text style={[styles.infoValue, { marginBottom: 0 }]}>{userData?.city || 'N/A'}</Text>
          </View>

          <Text style={styles.sectionTitle}>PAYMENT & PREFERENCES</Text>
          <View style={styles.infoCard}>
            <TouchableOpacity style={styles.listItem}>
              <View style={styles.listLeft}>
                <Feather name="credit-card" size={18} color={COLORS.textSecondary} />
                <Text style={styles.listText}>Payment Methods</Text>
              </View>
              <Feather name="chevron-right" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.listItem}>
              <View style={styles.listLeft}>
                <Feather name="lock" size={18} color={COLORS.textSecondary} />
                <Text style={styles.listText}>Security & Password</Text>
              </View>
              <Feather name="chevron-right" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.listItem, { borderBottomWidth: 0 }]}>
              <View style={styles.listLeft}>
                <Feather name="help-circle" size={18} color={COLORS.textSecondary} />
                <Text style={styles.listText}>Help & Support</Text>
              </View>
              <Feather name="chevron-right" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Feather name="log-out" size={18} color="#FF4C4C" />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}