import React, { useState, useEffect } from 'react';
import { Text, View, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, FontAwesome } from '@expo/vector-icons';
import { COLORS, styles } from '../styles';

import { auth, db } from '../firebaseConfig';
import { 
  collection, query, where, onSnapshot, getDocs, 
  addDoc, doc, getDoc, serverTimestamp 
} from 'firebase/firestore';

export default function BookingsScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('Active');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'bookings'),
      where('clientId', '==', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setBookings(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Include 'disputed' in Active so bookings never vanish when a dispute is opened!
  const activeList = bookings.filter(b => 
    ['active', 'accepted', 'disputed'].includes((b.status || '').toLowerCase()) || b.disputeStatus === 'open'
  );
  const pendingList = bookings.filter(b => (b.status || 'pending').toLowerCase() === 'pending');
  const completedList = bookings.filter(b => 
    ['completed', 'cancelled'].includes((b.status || '').toLowerCase())
  );

  const displayedBookings = 
    activeTab === 'Active' ? activeList : 
    activeTab === 'Pending' ? pendingList : completedList;

  const handleMessageFreelancer = async (booking) => {
    if (!auth.currentUser) return;

    try {
      const qChats = query(
        collection(db, 'chats'),
        where('participants', 'array-contains', auth.currentUser.uid)
      );
      const snapshot = await getDocs(qChats);
      let chatId = null;

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.participants && data.participants.includes(booking.freelancerId)) {
          chatId = docSnap.id;
        }
      });

      if (!chatId) {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        const clientName = userDoc.exists() ? (userDoc.data().fullName || userDoc.data().name) : 'Client';

        const newChat = await addDoc(collection(db, 'chats'), {
          participants: [auth.currentUser.uid, booking.freelancerId],
          clientId: auth.currentUser.uid,
          clientName: clientName,
          freelancerId: booking.freelancerId,
          freelancerName: booking.freelancerName || 'Freelancer',
          projectTitle: booking.serviceTitle || booking.projectTitle || 'Service Booking',
          lastMessage: 'Chat started from Bookings',
          updatedAt: serverTimestamp()
        });
        chatId = newChat.id;
      }

      navigation.navigate('Chat', {
        chatId: chatId,
        otherUserName: booking.freelancerName || 'Freelancer'
      });
    } catch (error) {
      Alert.alert('Error', 'Unable to open chat right now.');
    }
  };

  return (
    <LinearGradient colors={[COLORS.bgTop, COLORS.bgBottom]} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>My Bookings</Text>
          <Feather name="bell" size={20} color={COLORS.textSecondary} />
        </View>

        <View style={styles.tabRow}>
          <TouchableOpacity style={styles.tabBtn} onPress={() => setActiveTab('Active')}>
            <Text style={[styles.tabText, activeTab === 'Active' && styles.tabTextActive]}>
              Active ({activeList.length})
            </Text>
            {activeTab === 'Active' && <View style={styles.tabIndicator} />}
          </TouchableOpacity>

          <TouchableOpacity style={styles.tabBtn} onPress={() => setActiveTab('Pending')}>
            <Text style={[styles.tabText, activeTab === 'Pending' && styles.tabTextActive]}>
              Pending ({pendingList.length})
            </Text>
            {activeTab === 'Pending' && <View style={styles.tabIndicator} />}
          </TouchableOpacity>

          <TouchableOpacity style={styles.tabBtn} onPress={() => setActiveTab('Completed')}>
            <Text style={[styles.tabText, activeTab === 'Completed' && styles.tabTextActive]}>
              Completed ({completedList.length})
            </Text>
            {activeTab === 'Completed' && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} />
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
            {displayedBookings.length > 0 ? (
              displayedBookings.map((booking) => {
                const progress = booking.progress || 0;
                const isDisputed = (booking.status || '').toLowerCase() === 'disputed' || booking.disputeStatus === 'open';
                const isReadyForReview = !isDisputed && (progress >= 80 || booking.status === 'completed');

                return (
                  <TouchableOpacity
                    key={booking.id}
                    style={[
                      styles.bookingCard,
                      isReadyForReview && booking.status !== 'completed' && { borderColor: '#F4C77F' },
                      isDisputed && { borderColor: '#FF4C4C' }
                    ]}
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate('ClientBookingDetail', { bookingId: booking.id })}
                  >
                    <View style={styles.bookingTopRow}>
                      <View style={[
                        styles.statusPill,
                        isReadyForReview && booking.status !== 'completed' && { borderColor: '#F4C77F' },
                        booking.status === 'completed' && { borderColor: COLORS.primary },
                        isDisputed && { borderColor: '#FF4C4C', backgroundColor: 'rgba(255, 76, 76, 0.1)' }
                      ]}>
                        <Text style={[
                          styles.statusText,
                          isReadyForReview && booking.status !== 'completed' && { color: '#F4C77F' },
                          booking.status === 'completed' && { color: COLORS.primary },
                          isDisputed && { color: '#FF4C4C' }
                        ]}>
                          {isDisputed
                            ? '⚠️ DISPUTE OPEN (ADMIN IN CHAT)'
                            : booking.status === 'completed'
                            ? '✓ COMPLETED'
                            : booking.status === 'cancelled'
                            ? '✕ CANCELLED'
                            : booking.status === 'pending'
                            ? '• AWAITING APPROVAL'
                            : isReadyForReview
                            ? '● REVIEW MILESTONE'
                            : `● IN PROGRESS (${progress}%)`}
                        </Text>
                      </View>

                      <View style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' }}>
                        <Feather name="user" size={16} color={COLORS.primary} />
                      </View>
                    </View>

                    <Text style={styles.bookingTitle}>
                      {booking.serviceTitle || booking.projectTitle || 'Booked Service'}
                    </Text>
                    <Text style={styles.bookingDetails}>
                      Freelancer: {booking.freelancerName || 'Freelancer'} ({booking.category || 'Specialist'})
                    </Text>
                    <Text style={[styles.bookingDetails, isDisputed && { color: '#FF4C4C' }]}>
                      {isDisputed 
                        ? `Dispute Reason: ${booking.disputeReason || 'Under Admin Review'}`
                        : booking.latestNote 
                        ? `Latest Update: ${booking.latestNote}` 
                        : `Rate: ₱ ${booking.price || 0}`}
                    </Text>

                    {booking.status !== 'pending' && (
                      <View style={[styles.progressRow, { marginTop: 10 }]}>
                        <View style={styles.progressBarBg}>
                          <View style={[styles.progressBarFill, { width: `${progress}%`, backgroundColor: isDisputed ? '#FF4C4C' : COLORS.primary }]} />
                        </View>
                        <Text style={styles.progressText}>{progress}%</Text>
                      </View>
                    )}

                    {booking.rating ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                        {[1, 2, 3, 4, 5].map((s) => (
                          <FontAwesome
                            key={s}
                            name={s <= booking.rating ? 'star' : 'star-o'}
                            size={13}
                            color="#F4C77F"
                            style={{ marginRight: 3 }}
                          />
                        ))}
                        <Text style={{ color: COLORS.textSecondary, fontSize: 11, marginLeft: 5 }}>
                          You rated {booking.rating}/5
                        </Text>
                      </View>
                    ) : null}

                    <View style={styles.bookingBtnRow}>
                      <TouchableOpacity 
                        style={[styles.btnHalf, styles.btnDark]}
                        onPress={() => handleMessageFreelancer(booking)}
                      >
                        <Text style={styles.btnDarkText}>1-on-1 Chat</Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={[
                          styles.btnHalf,
                          isDisputed 
                            ? { backgroundColor: '#FF4C4C', marginLeft: 10 }
                            : isReadyForReview && booking.status !== 'completed' 
                            ? styles.btnWarning 
                            : styles.btnPrimary
                        ]}
                        onPress={() => navigation.navigate('ClientBookingDetail', { bookingId: booking.id })}
                      >
                        <Text style={[styles.btnPrimaryText, isDisputed && { color: '#FFF' }]}>
                          {isDisputed
                            ? 'Open Dispute Chat'
                            : booking.status === 'completed'
                            ? (booking.rating ? 'View Review' : 'Rate & Review')
                            : isReadyForReview
                            ? 'Review Work'
                            : 'Track Progress'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={{ alignItems: 'center', marginTop: 70 }}>
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