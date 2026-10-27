import React, { useState, useEffect } from 'react';
import { Text, View, TouchableOpacity, ScrollView, ActivityIndicator, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { COLORS, styles } from '../styles';
import { notify, confirmAction } from '../services/notify';
import { isNegotiated, getBookingStage, stageLabel, payoutSummary } from '../services/paymentRules';
import { ensureBookingChat } from '../services/bookingFlow';

import { auth, db } from '../firebaseConfig';
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

export default function FreelancerHomeScreen({ navigation }) {
  const [userData, setUserData] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    const unsubUser = onSnapshot(doc(db, 'users', auth.currentUser.uid), (snap) => {
      if (snap.exists()) setUserData(snap.data());
    });

    const q = query(
      collection(db, 'bookings'),
      where('freelancerId', '==', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allBookings = [];
      snapshot.forEach((docSnap) => {
        allBookings.push({ id: docSnap.id, ...docSnap.data() });
      });
      setBookings(allBookings);
      setLoading(false);
    });

    return () => {
      unsubUser();
      unsubscribe();
    };
  }, []);

  const pendingRequests = bookings.filter(b => (b.status || 'pending').toLowerCase() === 'pending');
  const activeProjects = bookings.filter(b => 
    ['active', 'accepted', 'disputed'].includes((b.status || '').toLowerCase()) || b.disputeStatus === 'open'
  );
  const completedProjects = bookings.filter(b => (b.status || '').toLowerCase() === 'completed');

  // Bookings made with the offer flow count what the client actually paid (updated by the payments
  // server). Older bookings have no payment data, so they keep using their price.
  const paidOrPrice = (b) => (isNegotiated(b) ? parseFloat(b.amountPaid) || 0 : parseFloat(b.price) || 0);
  const totalEarnings = completedProjects.reduce((sum, b) => sum + paidOrPrice(b), 0);
  const pendingEscrow = activeProjects.reduce((sum, b) => sum + paidOrPrice(b), 0);

  // Requests are no longer accepted in one tap. Open the booking's chat, agree on the details,
  // then send a custom offer (Create offer button in the chat).
  const handleOpenRequestChat = async (req) => {
    try {
      const chatId = await ensureBookingChat(req);
      navigation.navigate('Chat', { chatId, otherUserName: req.clientName || 'Client' });
    } catch (error) {
      notify('Could not open the chat', 'Please try again in a moment.');
    }
  };

  const requestActionLabel = (req) => {
    const stage = getBookingStage(req);
    if (stage === 'offer_sent') return 'Edit offer in chat';
    if (stage === 'awaiting_downpayment') return 'Open chat';
    return 'Chat and send offer';
  };

  const handleDeclineProject = async (reqId) => {
    const ok = await confirmAction('Decline booking', 'Are you sure you want to decline this project request?', 'Decline', true);
    if (!ok) return;
    try {
      await updateDoc(doc(db, 'bookings', reqId), {
        status: 'declined',
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error declining project:', error);
      notify('Error', 'Could not decline the booking. Please try again.');
    }
  };

  const displayName = userData?.fullName || userData?.name || auth.currentUser?.email?.split('@')[0] || 'Freelancer';
  const avatarUri = userData?.profileImage || userData?.avatar || userData?.photoURL;
  const isAdmin = (userData?.role || userData?.accountType || '').toLowerCase() === 'admin';

  return (
    <LinearGradient colors={[COLORS.bgTop, COLORS.bgBottom]} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        
        {/* Modernized Floating Header */}
        <View style={[styles.pageHeader, { paddingBottom: 15 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <TouchableOpacity 
              style={{
                width: 50, height: 50, borderRadius: 25, 
                backgroundColor: COLORS.inputBg, justifyContent: 'center', alignItems: 'center',
                borderWidth: 2, borderColor: COLORS.primary, marginRight: 15
              }} 
              onPress={() => navigation.navigate('Profile')}
            >
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={{ width: '100%', height: '100%', borderRadius: 25 }} />
              ) : (
                <Feather name="user" size={24} color={COLORS.primary} />
              )}
            </TouchableOpacity>
            
            <View>
              <Text style={{ color: COLORS.textSecondary, fontSize: 13, letterSpacing: 0.5 }}>Welcome back,</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.5 }}>
                  {displayName}
                </Text>
                {isAdmin && (
                  <View style={{ backgroundColor: COLORS.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 8 }}>
                    <Text style={{ color: '#000', fontSize: 9, fontWeight: 'bold' }}>ADMIN</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          <TouchableOpacity 
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.inputBg, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.inputBorder }} 
            onPress={() => navigation.navigate('Services')}
          >
            <Feather name="bell" size={20} color={COLORS.textSecondary} />
            {pendingRequests.length > 0 && (
              <View style={{ position: 'absolute', top: 12, right: 12, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF4C4C' }} />
            )}
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} />
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
            
            {userData && !isAdmin && !payoutSummary(userData.paymentMethod) && (
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.warningDim, borderColor: COLORS.warningLine, borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 16 }}
                onPress={() => navigation.navigate('Profile')}
                activeOpacity={0.85}
              >
                <Feather name="alert-circle" size={18} color={COLORS.warning} style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: COLORS.text, fontSize: 14, fontWeight: '700' }}>Set up your payout method</Text>
                  <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 2 }}>
                    You need one before you can send offers and get paid.
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            )}

            {/* Modern Glow Earnings Card */}
            <View style={styles.earningsCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ color: '#000', fontSize: 13, fontWeight: '700', opacity: 0.8, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Total Earnings
                </Text>
                <Feather name="trending-up" size={18} color="#000" />
              </View>
              
              <Text style={{ color: '#000', fontSize: 40, fontWeight: '900', letterSpacing: -1 }}>
                <Text style={{ fontSize: 24 }}>₱</Text>{totalEarnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
              
              <View style={{ backgroundColor: 'rgba(0,0,0,0.1)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, marginTop: 20, flexDirection: 'row', alignItems: 'center' }}>
                <Feather name="clock" size={14} color="#000" style={{ marginRight: 8 }} />
                <Text style={{ color: '#000', fontSize: 13, fontWeight: '600' }}>
                  Pending: ₱ {pendingEscrow.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 15, marginTop: 10 }}>
              <Text style={styles.sectionTitleMain}>New Requests ({pendingRequests.length})</Text>
            </View>

            {pendingRequests.length > 0 ? (
              pendingRequests.map((req) => (
                <View key={req.id} style={styles.bookingCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', flex: 1, alignItems: 'center' }}>
                      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(132, 220, 198, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                        <Text style={{ color: COLORS.primary, fontSize: 18, fontWeight: 'bold' }}>
                          {(req.clientName || 'C').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: COLORS.text, fontSize: 16, fontWeight: 'bold' }}>{req.clientName || 'Client'}</Text>
                        <Text style={{ color: COLORS.textSecondary, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
                          {req.serviceTitle || req.projectTitle || req.category || 'Service Booking'}
                        </Text>
                        <Text style={{ color: COLORS.warning, fontSize: 12, fontWeight: '700', marginTop: 4 }}>
                          {stageLabel(getBookingStage(req), 'freelancer')}
                        </Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: COLORS.primary, fontSize: 18, fontWeight: 'bold' }}>₱ {req.price || 0}</Text>
                      <Text style={{ color: COLORS.textSecondary, fontSize: 11, marginTop: 4 }}>{req.location || 'Local'}</Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <TouchableOpacity 
                      style={[styles.btnDark, styles.btnHalf, { marginRight: 10 }]}
                      onPress={() => handleDeclineProject(req.id)}
                    >
                      <Text style={styles.btnDarkText}>Decline</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.btnPrimary, styles.btnHalf]}
                      onPress={() => handleOpenRequestChat(req)}
                    >
                      <Text style={styles.btnPrimaryText}>{requestActionLabel(req)}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
              <View style={{ alignItems: 'center', marginTop: 10, marginBottom: 30 }}>
                <Text style={{ color: COLORS.textSecondary, fontSize: 13 }}>No new booking requests right now.</Text>
              </View>
            )}

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 15, marginTop: 10 }}>
              <Text style={styles.sectionTitleMain}>Active Pipeline ({activeProjects.length})</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Services')}>
                <Text style={{ color: COLORS.primary, fontSize: 13, fontWeight: '600' }}>View All</Text>
              </TouchableOpacity>
            </View>

            {activeProjects.length > 0 ? (
              activeProjects.map((project) => {
                const isDisputed = (project.status || '').toLowerCase() === 'disputed' || project.disputeStatus === 'open';
                return (
                  <TouchableOpacity
                    key={project.id}
                    style={[styles.activeProjectCard, isDisputed && { borderColor: '#FF4C4C' }]}
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate('BookingProgress', { bookingId: project.id })}
                  >
                    <View style={[styles.verticalAccent, isDisputed && { backgroundColor: '#FF4C4C' }, { width: 8 }]} />
                    <View style={styles.apContent}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <Text style={{ color: COLORS.text, fontSize: 16, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                          {project.serviceTitle || project.projectTitle || project.category || 'Active Project'}
                        </Text>
                        {isDisputed ? (
                          <View style={{ backgroundColor: 'rgba(255, 76, 76, 0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255, 76, 76, 0.4)' }}>
                            <Text style={{ color: '#FF4C4C', fontSize: 9, fontWeight: 'bold' }}>⚠️ DISPUTE</Text>
                          </View>
                        ) : (
                          <Feather name="chevron-right" size={18} color={COLORS.textSecondary} />
                        )}
                      </View>
                      
                      <Text style={{ color: COLORS.textSecondary, fontSize: 13, marginBottom: 12 }}>
                        Client: {project.clientName || 'Client'}
                      </Text>
                      
                      {isDisputed ? (
                        <Text style={{ color: '#FF4C4C', fontSize: 12, marginBottom: 12, fontWeight: '600' }} numberOfLines={1}>
                          Action Required: Tap to join 3-way chat
                        </Text>
                      ) : project.latestNote ? (
                        <Text style={{ color: COLORS.primary, fontSize: 12, marginBottom: 12 }} numberOfLines={1}>
                          Latest Update: {project.latestNote}
                        </Text>
                      ) : null}

                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={styles.progressBarBg}>
                          <View style={[styles.progressBarFill, { width: `${project.progress || 0}%`, backgroundColor: isDisputed ? '#FF4C4C' : COLORS.primary }]} />
                        </View>
                        <Text style={{ color: isDisputed ? '#FF4C4C' : COLORS.primary, fontWeight: '800', fontSize: 12, width: 35, textAlign: 'right' }}>
                          {project.progress || 0}%
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={{ alignItems: 'center', marginTop: 10 }}>
                <Text style={{ color: COLORS.textSecondary, fontSize: 13 }}>No active projects.</Text>
              </View>
            )}

          </ScrollView>
        )}

      </SafeAreaView>
    </LinearGradient>
  );
}