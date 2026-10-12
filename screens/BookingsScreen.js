import React, { useState, useEffect } from 'react';
import { Text, View, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { COLORS, styles } from '../styles';

import { auth, db } from '../firebaseConfig';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export default function BookingsScreen() {
  const [activeTab, setActiveTab] = useState('Active');
  const [bookings, setBookings] = useState({ active: [], pending: [], completed: [] });
  const [loading, setLoading] = useState(true);

  const tabs = ['Active', 'Pending', 'Completed'];

  useEffect(() => {
    if (!auth.currentUser) return;

    // Live listener for bookings linked to the user
    const q = query(
      collection(db, "bookings"),
      where("clientId", "==", auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const active = [];
      const pending = [];
      const completed = [];

      querySnapshot.forEach((doc) => {
        const data = { id: doc.id, ...doc.data() };
        if (data.status === 'active') active.push(data);
        else if (data.status === 'pending') pending.push(data);
        else if (data.status === 'completed') completed.push(data);
      });

      setBookings({ active, pending, completed });
      setLoading(false);
    }, (error) => {
      console.error("Error listening to bookings:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Determine which list to show based on the active tab
  const currentList = 
    activeTab === 'Active' ? bookings.active : 
    activeTab === 'Pending' ? bookings.pending : 
    bookings.completed;

  return (
    <LinearGradient colors={[COLORS.bgTop, COLORS.bgBottom]} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>My Bookings</Text>
          <TouchableOpacity>
            <Feather name="bell" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.tabRow}>
          {tabs.map((tab) => (
            <TouchableOpacity key={tab} style={styles.tabBtn} onPress={() => setActiveTab(tab)}>
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab} {tab === 'Active' && bookings.active.length > 0 ? `(${bookings.active.length})` : ''}
              </Text>
              {activeTab === tab && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} />
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            {currentList.length > 0 ? (
              currentList.map((booking) => (
                <View key={booking.id} style={styles.bookingCard}>
                  <View style={styles.bookingTopRow}>
                    <View style={styles.statusPill}>
                      <Text style={styles.statusText}>{booking.status.toUpperCase()}</Text>
                    </View>
                  </View>
                  <Text style={styles.bookingTitle}>{booking.title || "Service Booking"}</Text>
                  
                  <View style={styles.bookingBtnRow}>
                    <TouchableOpacity style={[styles.btnHalf, styles.btnDark]}>
                      <Text style={styles.btnDarkText}>Message</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btnHalf, styles.btnPrimary]}>
                      <Text style={styles.btnPrimaryText}>View Details</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
              // This blank state will display until actual bookings are created
              <View style={{ alignItems: 'center', marginTop: 50 }}>
                <Feather name="calendar" size={40} color={COLORS.inputBorder} style={{ marginBottom: 15 }} />
                <Text style={styles.subtitle}>No {activeTab.toLowerCase()} bookings found.</Text>
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}