import React, { useState, useEffect } from 'react';
import { Text, View, TouchableOpacity, ScrollView, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { COLORS, styles } from '../styles';

import { auth, db } from '../firebaseConfig';
import { doc, collection, query, where, onSnapshot } from 'firebase/firestore';

export default function FreelancerHomeScreen() {
  const [userData, setUserData] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [activeProjects, setActiveProjects] = useState([]);
  const [earnings, setEarnings] = useState({ total: 0, escrow: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    const userUnsubscribe = onSnapshot(doc(db, "users", auth.currentUser.uid), (docSnap) => {
      if (docSnap.exists()) setUserData(docSnap.data());
    });

    const bookingsQuery = query(
      collection(db, "bookings"),
      where("freelancerId", "==", auth.currentUser.uid)
    );

    const bookingsUnsubscribe = onSnapshot(bookingsQuery, (snapshot) => {
      const requests = [];
      const active = [];
      let totalEarned = 0;
      let totalEscrow = 0;

      snapshot.forEach((doc) => {
        const data = { id: doc.id, ...doc.data() };
        if (data.status === 'pending') requests.push(data);
        else if (data.status === 'active') {
          active.push(data);
          totalEscrow += Number(data.price || 0);
        }
        else if (data.status === 'completed') totalEarned += Number(data.price || 0);
      });

      setPendingRequests(requests);
      setActiveProjects(active);
      setEarnings({ total: totalEarned, escrow: totalEscrow });
      setLoading(false);
    });

    return () => { userUnsubscribe(); bookingsUnsubscribe(); };
  }, []);

  return (
    <LinearGradient colors={[COLORS.bgTop, COLORS.bgBottom]} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} />
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.fhHeader}>
              <View style={styles.fhHeaderLeft}>
                {userData?.idImage ? (
                  <Image source={{ uri: `data:image/jpeg;base64,${userData.idImage}` }} style={styles.chatHeaderAvatar} />
                ) : (
                  <View style={styles.chatHeaderAvatar}><Feather name="user" size={18} color={COLORS.textSecondary} /></View>
                )}
                <View style={styles.fhGreetingRow}>
                  <Text style={styles.fhGreeting}>Welcome back,</Text>
                  <Text style={styles.fhName}>{userData?.fullName?.split(' ')[0] || 'User'}!</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.bellIconWrapper}>
                <Feather name="bell" size={22} color={COLORS.primary} />
                <View style={styles.notificationDot} />
              </TouchableOpacity>
            </View>

            <View style={styles.earningsCard}>
              <Text style={styles.earningsLabel}>Total Earnings via Bookings</Text>
              <Text style={styles.earningsAmount}>₱ {earnings.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
              <View style={styles.escrowRow}>
                <Text style={styles.escrowText}>Pending Escrow: ₱ {earnings.escrow.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
              </View>
            </View>

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitleMain}>New Booking Requests ({pendingRequests.length})</Text>
            </View>
            
            {pendingRequests.length > 0 ? (
              pendingRequests.map((req) => (
                <View key={req.id} style={styles.requestCard}>
                  <View style={styles.requestTopRow}>
                    <View style={styles.requestClientInfo}>
                      <View style={styles.clientInitialAvatar}>
                        <Text style={styles.clientInitialText}>{req.clientName?.charAt(0) || 'C'}</Text>
                      </View>
                      <View>
                        <Text style={styles.requestClientName}>{req.clientName || 'Client'}</Text>
                        <Text style={styles.requestProjectTitle}>{req.title || 'Service Request'}</Text>
                      </View>
                    </View>
                    <View style={styles.requestPriceRight}>
                      <Text style={styles.requestPriceText}>₱ {Number(req.price || 0).toLocaleString()}</Text>
                      <Text style={styles.requestLocationText}>{req.location || 'Unknown'}</Text>
                    </View>
                  </View>
                  <View style={styles.requestBtnRow}>
                    <TouchableOpacity style={styles.declineBtn}><Text style={styles.declineBtnText}>Decline</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.acceptBtn}><Text style={styles.acceptBtnText}>Accept Project</Text></TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
              <Text style={[styles.subtitle, { textAlign: 'left', marginBottom: 30 }]}>No new requests at the moment.</Text>
            )}

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitleMain}>Active Projects</Text>
              <TouchableOpacity><Text style={styles.viewAllText}>View All</Text></TouchableOpacity>
            </View>

            {activeProjects.length > 0 ? (
              activeProjects.map((proj) => (
                <View key={proj.id} style={styles.activeProjectCard}>
                  <View style={styles.verticalAccent} />
                  <View style={styles.apContent}>
                    <Text style={styles.apTitle}>{proj.title || 'Ongoing Project'}</Text>
                    <Text style={styles.apClient}>Client: {proj.clientName || 'Client'}</Text>
                    <View style={styles.progressRow}>
                      <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: `${proj.progress || 0}%` }]} />
                      </View>
                      <Text style={styles.progressText}>{proj.progress || 0}%</Text>
                    </View>
                  </View>
                </View>
              ))
            ) : (
              <Text style={[styles.subtitle, { textAlign: 'left' }]}>No active projects.</Text>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}