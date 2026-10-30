import React, { useState, useEffect } from 'react';
import { 
  Text, View, TextInput, TouchableOpacity, ScrollView, 
  ActivityIndicator, Alert, Image, Modal 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { COLORS, styles } from '../styles';
import { usePushRegistration, unregisterPush, notifyUsers } from '../services/notifications';
import { messages as pushMessages } from '../services/pushMessages';
import { isNegotiated } from '../services/paymentRules';

import { auth, db } from '../firebaseConfig';
import { 
  collection, onSnapshot, doc, updateDoc, deleteDoc, 
  query, where, getDocs, addDoc, arrayUnion, serverTimestamp 
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';

export default function AdminDashboardScreen({ navigation }) {
  // Admins get push notifications too (new disputes, dispute chat messages).
  usePushRegistration();

  const [activeTab, setActiveTab] = useState('Analytics');
  const [users, setUsers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [services, setServices] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [userSearch, setUserSearch] = useState('');
  const [resolutionModal, setResolutionModal] = useState(null);
  const [adminNote, setAdminNote] = useState('');

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setUsers(list);
    });

    const unsubBookings = onSnapshot(collection(db, 'bookings'), (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setBookings(list);
      setLoading(false);
    });

    const unsubServices = onSnapshot(collection(db, 'services'), (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setServices(list);
    });

    const unsubDisputes = onSnapshot(collection(db, 'disputes'), (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setDisputes(list);
    });

    return () => {
      unsubUsers();
      unsubBookings();
      unsubServices();
      unsubDisputes();
    };
  }, []);

  const freelancers = users.filter((u) => (u.role || u.accountType || '').toLowerCase() === 'freelancer');
  const clients = users.filter((u) => (u.role || u.accountType || '').toLowerCase() === 'client');
  const unverifiedFreelancers = freelancers.filter((f) => !f.verified);

  const completedBookings = bookings.filter((b) => (b.status || '').toLowerCase() === 'completed');
  const activeBookings = bookings.filter((b) => ['active', 'accepted', 'disputed'].includes((b.status || '').toLowerCase()));
  const pendingBookings = bookings.filter((b) => (b.status || 'pending').toLowerCase() === 'pending');
  const disputedBookings = bookings.filter((b) => (b.status || '').toLowerCase() === 'disputed' || b.disputeStatus === 'open');

  // Offer-flow bookings count the money that was actually paid; older bookings keep using their price.
  const paidOrPrice = (b) => (isNegotiated(b) ? parseFloat(b.amountPaid) || 0 : parseFloat(b.price) || 0);
  const totalVolume = completedBookings.reduce((sum, b) => sum + paidOrPrice(b), 0);
  const activeEscrowVolume = activeBookings.reduce((sum, b) => sum + paidOrPrice(b), 0);

  const categoryCounts = {};
  bookings.forEach((b) => {
    const cat = b.category || b.serviceTitle || 'General';
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });

  // Direct 1-on-1 Message any user as Admin [ADMIN]
  const handleAdminMessageUser = async (targetUser) => {
    if (!auth.currentUser) return;
    try {
      const qChats = query(
        collection(db, 'chats'),
        where('participants', 'array-contains', auth.currentUser.uid)
      );
      const snap = await getDocs(qChats);
      let chatId = null;

      snap.forEach((d) => {
        if (d.data().participants?.includes(targetUser.id)) {
          chatId = d.id;
        }
      });

      const targetName = targetUser.fullName || targetUser.name || targetUser.email?.split('@')[0] || 'User';

      if (!chatId) {
        const newChat = await addDoc(collection(db, 'chats'), {
          participants: [auth.currentUser.uid, targetUser.id],
          clientId: auth.currentUser.uid,
          clientName: 'SkillSwap Admin [ADMIN]',
          freelancerId: targetUser.id,
          freelancerName: targetName,
          projectTitle: 'Official Admin Support',
          lastMessage: 'Admin started a conversation',
          updatedAt: serverTimestamp()
        });
        chatId = newChat.id;
      }

      navigation.navigate('Chat', {
        chatId,
        otherUserName: targetName
      });
    } catch (error) {
      Alert.alert('Error', 'Could not open chat with user.');
    }
  };

  const handleToggleVerify = async (freelancer) => {
    try {
      const newStatus = !freelancer.verified;
      await updateDoc(doc(db, 'users', freelancer.id), {
        verified: newStatus,
        verifiedAt: serverTimestamp()
      });
      Alert.alert(
        newStatus ? 'Freelancer Verified' : 'Verification Removed',
        `${freelancer.fullName || freelancer.name || 'Freelancer'} is now ${newStatus ? 'Verified ✓' : 'Unverified'}.`
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to update verification status.');
    }
  };

  const handleToggleSuspendUser = async (user) => {
    try {
      const isSuspended = !user.suspended;
      await updateDoc(doc(db, 'users', user.id), {
        suspended: isSuspended,
        updatedAt: serverTimestamp()
      });
      Alert.alert(
        isSuspended ? 'Account Suspended' : 'Account Activated',
        `${user.fullName || user.email} has been ${isSuspended ? 'suspended' : 'reactivated'}.`
      );
    } catch (error) {
      Alert.alert('Error', 'Could not update user status.');
    }
  };

  const handleChangeRole = async (user, newRole) => {
    try {
      await updateDoc(doc(db, 'users', user.id), {
        role: newRole,
        accountType: newRole
      });
      Alert.alert('Role Updated', `${user.fullName || user.email} is now set to ${newRole.toUpperCase()}.`);
    } catch (error) {
      Alert.alert('Error', 'Could not update user role.');
    }
  };

  const handleDeleteUser = (user) => {
    Alert.alert(
      'Remove User',
      `Are you sure you want to remove ${user.fullName || user.email} from the platform?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'users', user.id));
            } catch (err) {
              Alert.alert('Error', 'Failed to delete user.');
            }
          }
        }
      ]
    );
  };

  const handleResolveDispute = async (outcomeStatus) => {
    if (!resolutionModal) return;
    try {
      const noteText = adminNote.trim() || `Resolved by Admin as ${outcomeStatus.toUpperCase()}.`;
      const targetBookingId = resolutionModal.bookingId || resolutionModal.id;

      const resolutionMsg = {
        id: Date.now().toString(),
        senderId: auth.currentUser?.uid,
        senderName: 'SkillSwap Admin [ADMIN]',
        senderRole: 'ADMIN',
        text: `✓ DISPUTE RESOLVED (${outcomeStatus.toUpperCase()}): ${noteText}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      if (targetBookingId) {
        await updateDoc(doc(db, 'bookings', targetBookingId), {
          status: outcomeStatus,
          disputeStatus: 'resolved',
          adminResolution: noteText,
          latestNote: `[ADMIN RESOLUTION]: ${noteText}`,
          disputeMessages: arrayUnion(resolutionMsg),
          updatedAt: serverTimestamp()
        });
      }

      if (!resolutionModal.isBookingDoc && resolutionModal.id) {
        await updateDoc(doc(db, 'disputes', resolutionModal.id), {
          status: 'resolved',
          outcome: outcomeStatus,
          adminResolution: noteText,
          resolvedAt: serverTimestamp()
        });
      }

      // Push: tell the client and the freelancer how it was resolved.
      const linked = bookings.find((b) => b.id === targetBookingId) || resolutionModal;
      notifyUsers([linked.clientId, linked.freelancerId], (uid) =>
        pushMessages.disputeResolved({
          outcome: outcomeStatus,
          serviceTitle: linked.serviceTitle || linked.projectTitle,
          bookingId: targetBookingId,
          forRole: uid === linked.freelancerId ? 'freelancer' : 'client',
        })
      );

      setAdminNote('');
      setResolutionModal(null);
      Alert.alert('Dispute Resolved', `The booking has been marked as ${outcomeStatus.toUpperCase()}.`);
    } catch (error) {
      Alert.alert('Error', 'Could not resolve dispute.');
    }
  };

  const handleLogout = async () => {
    await unregisterPush();
    await signOut(auth);
    navigation.replace('Login');
  };

  const combinedDisputes = [
    ...disputes.map((d) => ({ ...d, isBookingDoc: false })),
    ...disputedBookings
      .filter((b) => !disputes.some((d) => d.bookingId === b.id))
      .map((b) => ({
        id: b.id,
        bookingId: b.id,
        isBookingDoc: true,
        serviceTitle: b.serviceTitle || b.projectTitle,
        clientName: b.clientName,
        freelancerName: b.freelancerName,
        price: b.price,
        reason: b.disputeReason || 'Client requested admin dispute review.',
        status: b.disputeStatus || 'open',
        adminResolution: b.adminResolution || null
      }))
  ];

  const openDisputesCount = combinedDisputes.filter((d) => (d.status || 'open') !== 'resolved').length;

  return (
    <LinearGradient colors={[COLORS.bgTop, COLORS.bgBottom]} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        
        {/* Top Admin Header */}
        <View style={styles.pageHeader}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ backgroundColor: COLORS.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginRight: 8 }}>
                <Text style={{ color: '#000', fontSize: 10, fontWeight: 'bold' }}>ADMIN</Text>
              </View>
              <Text style={styles.pageTitle}>SkillSwap Console</Text>
            </View>
            <Text style={{ color: COLORS.textSecondary, fontSize: 11, marginTop: 2 }}>
              Verify Freelancers, Message Users, Inspect Disputes & Browse App
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {/* Let Admin freely interact with the main App with their [ADMIN] badge */}
            <TouchableOpacity 
              style={{
                backgroundColor: 'rgba(132, 220, 198, 0.15)',
                borderWidth: 1,
                borderColor: COLORS.primary,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 16,
                marginRight: 8,
                flexDirection: 'row',
                alignItems: 'center'
              }}
              onPress={() => navigation.navigate('ClientTabs')}
            >
              <Feather name="compass" size={14} color={COLORS.primary} style={{ marginRight: 5 }} />
              <Text style={{ color: COLORS.primary, fontSize: 11, fontWeight: 'bold' }}>Browse App</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.headerIconBtn, { borderColor: '#FF4C4C' }]}
              onPress={handleLogout}
            >
              <Feather name="log-out" size={16} color="#FF4C4C" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Admin Navigation Tabs */}
        <View style={styles.tabRow}>
          {[
            { key: 'Analytics', label: 'Analytics', icon: 'bar-chart-2' },
            { key: 'Verify', label: `Verify (${unverifiedFreelancers.length})`, icon: 'check-circle' },
            { key: 'Users', label: `Users (${users.length})`, icon: 'users' },
            { key: 'Disputes', label: `Disputes (${openDisputesCount})`, icon: 'alert-triangle' }
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabBtn, { marginRight: 18, flexDirection: 'row', alignItems: 'center' }]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Feather
                name={tab.icon}
                size={13}
                color={activeTab === tab.key ? COLORS.primary : COLORS.textSecondary}
                style={{ marginRight: 5 }}
              />
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                {tab.label}
              </Text>
              {activeTab === tab.key && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 60 }} />
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
            
            {/* TAB 1: BOOKING ANALYTICS */}
            {activeTab === 'Analytics' && (
              <View>
                <View style={styles.earningsCard}>
                  <Text style={styles.earningsLabel}>Total Completed Booking Volume (GMV)</Text>
                  <Text style={styles.earningsAmount}>
                    ₱ {totalVolume.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                  <View style={styles.escrowRow}>
                    <Text style={styles.escrowText}>
                      Active Projects Pipeline: ₱ {activeEscrowVolume.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} • {services.length} Listed Services
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 15 }}>
                  <View style={[styles.infoCard, { width: '48%', marginBottom: 12 }]}>
                    <Text style={styles.infoLabel}>TOTAL BOOKINGS</Text>
                    <Text style={{ color: COLORS.primary, fontSize: 22, fontWeight: 'bold', marginTop: 4 }}>
                      {bookings.length}
                    </Text>
                    <Text style={{ color: COLORS.textSecondary, fontSize: 11, marginTop: 2 }}>
                      {completedBookings.length} Completed • {activeBookings.length} Active
                    </Text>
                  </View>

                  <View style={[styles.infoCard, { width: '48%', marginBottom: 12 }]}>
                    <Text style={styles.infoLabel}>REGISTERED USERS</Text>
                    <Text style={{ color: COLORS.text, fontSize: 22, fontWeight: 'bold', marginTop: 4 }}>
                      {users.length}
                    </Text>
                    <Text style={{ color: COLORS.textSecondary, fontSize: 11, marginTop: 2 }}>
                      {freelancers.length} Freelancers • {clients.length} Clients
                    </Text>
                  </View>

                  <View style={[styles.infoCard, { width: '48%', marginBottom: 12 }]}>
                    <Text style={styles.infoLabel}>VERIFIED FREELANCERS</Text>
                    <Text style={{ color: COLORS.primary, fontSize: 22, fontWeight: 'bold', marginTop: 4 }}>
                      {freelancers.length - unverifiedFreelancers.length} / {freelancers.length}
                    </Text>
                    <Text style={{ color: '#F4C77F', fontSize: 11, marginTop: 2 }}>
                      {unverifiedFreelancers.length} Awaiting Verification
                    </Text>
                  </View>

                  <View style={[styles.infoCard, { width: '48%', marginBottom: 12 }]}>
                    <Text style={styles.infoLabel}>OPEN DISPUTES</Text>
                    <Text style={{ color: openDisputesCount > 0 ? '#FF4C4C' : COLORS.primary, fontSize: 22, fontWeight: 'bold', marginTop: 4 }}>
                      {openDisputesCount}
                    </Text>
                    <Text style={{ color: COLORS.textSecondary, fontSize: 11, marginTop: 2 }}>
                      {combinedDisputes.length} Total Logged
                    </Text>
                  </View>
                </View>

                <Text style={styles.sectionTitle}>BOOKING STATUS BREAKDOWN</Text>
                <View style={[styles.infoCard, { marginBottom: 20 }]}>
                  {[
                    { label: 'Completed Bookings', count: completedBookings.length, color: COLORS.primary },
                    { label: 'Active In-Progress', count: activeBookings.length, color: '#58B4FF' },
                    { label: 'Pending Approval', count: pendingBookings.length, color: '#F4C77F' },
                    { label: 'Disputed / Under Review', count: openDisputesCount, color: '#FF4C4C' }
                  ].map((row) => {
                    const pct = bookings.length > 0 ? Math.round((row.count / bookings.length) * 100) : 0;
                    return (
                      <View key={row.label} style={{ marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                          <Text style={{ color: COLORS.text, fontSize: 12 }}>{row.label}</Text>
                          <Text style={{ color: row.color, fontWeight: 'bold', fontSize: 12 }}>
                            {row.count} ({pct}%)
                          </Text>
                        </View>
                        <View style={styles.progressBarBg}>
                          <View style={[styles.progressBarFill, { width: `${pct}%`, backgroundColor: row.color }]} />
                        </View>
                      </View>
                    );
                  })}
                </View>

                <Text style={styles.sectionTitle}>BOOKINGS BY SERVICE CATEGORY</Text>
                <View style={styles.infoCard}>
                  {Object.keys(categoryCounts).length > 0 ? (
                    Object.entries(categoryCounts).map(([cat, count]) => (
                      <View key={cat} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.inputBorder }}>
                        <Text style={{ color: COLORS.text, fontSize: 13 }}>{cat}</Text>
                        <Text style={{ color: COLORS.primary, fontWeight: 'bold', fontSize: 13 }}>
                          {count} {count === 1 ? 'Booking' : 'Bookings'}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={{ color: COLORS.textSecondary, fontSize: 12 }}>No bookings recorded yet.</Text>
                  )}
                </View>
              </View>
            )}

            {/* TAB 2: VERIFY FREELANCERS */}
            {activeTab === 'Verify' && (
              <View>
                <Text style={styles.sectionTitle}>
                  FREELANCER VERIFICATION QUEUE ({freelancers.length})
                </Text>

                {freelancers.length > 0 ? (
                  freelancers.map((f) => {
                    const fName = f.fullName || f.name || f.email?.split('@')[0] || 'Freelancer';
                    const fServices = services.filter((s) => s.freelancerId === f.id);

                    return (
                      <View
                        key={f.id}
                        style={[
                          styles.freelancerCard,
                          !f.verified && { borderColor: '#F4C77F' }
                        ]}
                      >
                        <View style={styles.fcTopRow}>
                          <View style={styles.fcLeftInfo}>
                            <View style={[styles.fcAvatar, { borderWidth: 1, borderColor: f.verified ? COLORS.primary : '#F4C77F' }]}>
                              {f.profileImage || f.avatar ? (
                                <Image source={{ uri: f.profileImage || f.avatar }} style={{ width: 45, height: 45, borderRadius: 22.5 }} />
                              ) : (
                                <Feather name="user" size={20} color={COLORS.primary} />
                              )}
                            </View>
                            <View style={styles.fcNameRole}>
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={styles.fcName}>{fName}</Text>
                                {f.verified && (
                                  <View style={{ backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1, marginLeft: 6 }}>
                                    <Text style={{ color: '#000', fontSize: 9, fontWeight: 'bold' }}>✓ VERIFIED</Text>
                                  </View>
                                )}
                              </View>
                              <Text style={styles.fcRole}>{f.email}</Text>
                              <Text style={{ color: COLORS.textSecondary, fontSize: 11, marginTop: 2 }}>
                                Location: {f.location || f.address || 'Iligan City'} • {fServices.length} Services Listed
                              </Text>
                            </View>
                          </View>

                          <TouchableOpacity
                            style={{ padding: 8, borderRadius: 12, borderWidth: 1, borderColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' }}
                            onPress={() => handleAdminMessageUser(f)}
                          >
                            <Feather name="message-circle" size={16} color={COLORS.primary} />
                          </TouchableOpacity>
                        </View>

                        <View style={styles.bookingBtnRow}>
                          <TouchableOpacity
                            style={[styles.btnHalf, styles.btnDark]}
                            onPress={() => navigation.navigate('FreelancerPortfolio', {
                              freelancerId: f.id,
                              freelancerName: fName
                            })}
                          >
                            <Text style={styles.btnDarkText}>Inspect Portfolio</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.btnHalf,
                              f.verified ? { backgroundColor: '#1A3328', marginLeft: 10 } : styles.btnPrimary
                            ]}
                            onPress={() => handleToggleVerify(f)}
                          >
                            <Text style={{ color: f.verified ? '#FF4C4C' : '#000', fontWeight: 'bold', fontSize: 12 }}>
                              {f.verified ? 'Revoke Verification' : '✓ Approve & Verify'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <Text style={{ color: COLORS.textSecondary, fontSize: 12 }}>No freelancers registered yet.</Text>
                )}
              </View>
            )}

            {/* TAB 3: MANAGE USERS (With Direct Admin Message Button) */}
            {activeTab === 'Users' && (
              <View>
                <View style={styles.searchContainer}>
                  <Feather name="search" size={18} color={COLORS.textSecondary} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search users by name, email, or role..."
                    placeholderTextColor={COLORS.textSecondary}
                    value={userSearch}
                    onChangeText={setUserSearch}
                  />
                </View>

                {users
                  .filter((u) => {
                    const q = userSearch.toLowerCase().trim();
                    if (!q) return true;
                    return (
                      (u.fullName || u.name || '').toLowerCase().includes(q) ||
                      (u.email || '').toLowerCase().includes(q) ||
                      (u.role || u.accountType || '').toLowerCase().includes(q)
                    );
                  })
                  .map((u) => {
                    const uName = u.fullName || u.name || u.email?.split('@')[0] || 'User';
                    const uRole = (u.role || u.accountType || 'client').toLowerCase();

                    return (
                      <View key={u.id} style={[styles.serviceCard, u.suspended && { borderColor: '#FF4C4C', opacity: 0.8 }]}>
                        <View style={styles.serviceTopRow}>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Text style={styles.serviceTitle}>{uName}</Text>
                              {uRole === 'admin' && (
                                <View style={{ backgroundColor: COLORS.primary, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1, marginLeft: 6 }}>
                                  <Text style={{ color: '#000', fontSize: 9, fontWeight: 'bold' }}>ADMIN</Text>
                                </View>
                              )}
                              {u.verified && (
                                <Feather name="check-circle" size={14} color={COLORS.primary} style={{ marginLeft: 6 }} />
                              )}
                              {u.suspended && (
                                <View style={{ backgroundColor: '#FF4C4C', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1, marginLeft: 6 }}>
                                  <Text style={{ color: '#FFF', fontSize: 9, fontWeight: 'bold' }}>SUSPENDED</Text>
                                </View>
                              )}
                            </View>
                            <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 2 }}>{u.email}</Text>
                            <Text style={{ color: COLORS.primary, fontSize: 11, marginTop: 4, fontWeight: 'bold' }}>
                              ROLE: {uRole.toUpperCase()}
                            </Text>
                          </View>

                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <TouchableOpacity 
                              onPress={() => handleAdminMessageUser(u)} 
                              style={{ padding: 8, marginRight: 6, borderRadius: 10, borderWidth: 1, borderColor: COLORS.primary }}
                            >
                              <Feather name="message-circle" size={15} color={COLORS.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleDeleteUser(u)} style={{ padding: 6 }}>
                              <Feather name="trash-2" size={16} color="#FF4C4C" />
                            </TouchableOpacity>
                          </View>
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.inputBorder }}>
                          <View style={{ flexDirection: 'row' }}>
                            {['client', 'freelancer', 'admin'].map((r) => (
                              <TouchableOpacity
                                key={r}
                                onPress={() => handleChangeRole(u, r)}
                                style={{
                                  paddingVertical: 5,
                                  paddingHorizontal: 10,
                                  borderRadius: 10,
                                  marginRight: 6,
                                  borderWidth: 1,
                                  borderColor: uRole === r ? COLORS.primary : COLORS.inputBorder,
                                  backgroundColor: uRole === r ? COLORS.primary : COLORS.inputBg
                                }}
                              >
                                <Text style={{ color: uRole === r ? '#000' : COLORS.textSecondary, fontSize: 10, fontWeight: 'bold' }}>
                                  {r.toUpperCase()}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>

                          <TouchableOpacity
                            onPress={() => handleToggleSuspendUser(u)}
                            style={{
                              paddingVertical: 6,
                              paddingHorizontal: 12,
                              borderRadius: 12,
                              borderWidth: 1,
                              borderColor: u.suspended ? COLORS.primary : '#FF4C4C'
                            }}
                          >
                            <Text style={{ color: u.suspended ? COLORS.primary : '#FF4C4C', fontSize: 11, fontWeight: 'bold' }}>
                              {u.suspended ? 'Activate' : 'Suspend'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
              </View>
            )}

            {/* TAB 4: HANDLE DISPUTES (Shows Booking Progress + Opens 3-Way Group Chat) */}
            {activeTab === 'Disputes' && (
              <View>
                <Text style={styles.sectionTitle}>
                  BOOKING DISPUTES & ESCALATIONS ({combinedDisputes.length})
                </Text>

                {combinedDisputes.length > 0 ? (
                  combinedDisputes.map((d) => {
                    const isResolved = (d.status || '').toLowerCase() === 'resolved';
                    const targetBookingId = d.bookingId || d.id;
                    const linkedBooking = bookings.find((b) => b.id === targetBookingId);
                    const bProgress = linkedBooking?.progress || 0;
                    const notesCount = linkedBooking?.progressNotes?.length || 0;
                    const chatCount = linkedBooking?.disputeMessages?.length || 0;

                    return (
                      <View
                        key={d.id}
                        style={[
                          styles.bookingCard,
                          { borderColor: isResolved ? COLORS.inputBorder : '#FF4C4C' }
                        ]}
                      >
                        <View style={styles.bookingTopRow}>
                          <View style={[styles.statusPill, { borderColor: isResolved ? COLORS.primary : '#FF4C4C' }]}>
                            <Text style={[styles.statusText, { color: isResolved ? COLORS.primary : '#FF4C4C' }]}>
                              {isResolved ? '✓ RESOLVED' : '● OPEN DISPUTE'}
                            </Text>
                          </View>
                          <Text style={{ color: COLORS.primary, fontWeight: 'bold', fontSize: 13 }}>
                            ₱ {d.price || linkedBooking?.price || 0}
                          </Text>
                        </View>

                        <Text style={styles.bookingTitle}>{d.serviceTitle || 'Disputed Service Booking'}</Text>
                        <Text style={styles.bookingDetails}>
                          Client: {d.clientName || 'Client'} • Freelancer: {d.freelancerName || 'Freelancer'}
                        </Text>

                        {/* Booking Progress Summary Inside Dispute Card */}
                        <View style={{ marginTop: 10, marginBottom: 6 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text style={{ color: COLORS.textSecondary, fontSize: 11 }}>
                              Reported Progress: {bProgress}% ({notesCount} Milestone Updates • {chatCount} Group Messages)
                            </Text>
                            <Text style={{ color: COLORS.primary, fontSize: 11, fontWeight: 'bold' }}>{bProgress}%</Text>
                          </View>
                          <View style={styles.progressBarBg}>
                            <View style={[styles.progressBarFill, { width: `${bProgress}%` }]} />
                          </View>
                        </View>

                        <View style={{ backgroundColor: COLORS.inputBg, padding: 12, borderRadius: 10, marginTop: 8, borderWidth: 1, borderColor: COLORS.inputBorder }}>
                          <Text style={{ color: '#F4C77F', fontSize: 11, fontWeight: 'bold', marginBottom: 4 }}>
                            Dispute Reason / Issue:
                          </Text>
                          <Text style={{ color: COLORS.text, fontSize: 12, lineHeight: 18 }}>
                            {d.reason}
                          </Text>
                          {linkedBooking?.latestNote && (
                            <Text style={{ color: COLORS.textSecondary, fontSize: 11, marginTop: 6 }}>
                              Latest Freelancer Note: "{linkedBooking.latestNote}"
                            </Text>
                          )}
                        </View>

                        {d.adminResolution && (
                          <View style={{ backgroundColor: 'rgba(132, 220, 198, 0.1)', padding: 10, borderRadius: 10, marginTop: 8 }}>
                            <Text style={{ color: COLORS.primary, fontSize: 11, fontWeight: 'bold' }}>
                              Admin Decision: {d.adminResolution}
                            </Text>
                          </View>
                        )}

                        <View style={styles.bookingBtnRow}>
                          <TouchableOpacity
                            style={[styles.btnHalf, styles.btnDark, { borderColor: COLORS.primary }]}
                            onPress={() => navigation.navigate('ClientBookingDetail', { bookingId: targetBookingId })}
                          >
                            <Text style={[styles.btnDarkText, { color: COLORS.primary }]}>
                              Progress & Group Chat ({chatCount})
                            </Text>
                          </TouchableOpacity>

                          {!isResolved && (
                            <TouchableOpacity
                              style={[styles.btnHalf, styles.btnPrimary]}
                              onPress={() => {
                                setAdminNote('');
                                setResolutionModal(d);
                              }}
                            >
                              <Text style={styles.btnPrimaryText}>Resolve Dispute</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <View style={{ alignItems: 'center', marginTop: 50 }}>
                    <Feather name="shield" size={40} color={COLORS.primary} style={{ marginBottom: 12 }} />
                    <Text style={styles.subtitle}>No active disputes! All bookings are running smoothly.</Text>
                  </View>
                )}
              </View>
            )}

          </ScrollView>
        )}

        {/* Dispute Resolution Modal */}
        <Modal visible={resolutionModal !== null} transparent animationType="fade">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 20 }}>
            <View style={{ backgroundColor: COLORS.cardInactiveBg, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: COLORS.inputBorder }}>
              <Text style={{ color: COLORS.text, fontSize: 17, fontWeight: 'bold', marginBottom: 6 }}>
                Resolve Booking Dispute
              </Text>
              <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 15 }}>
                {resolutionModal?.serviceTitle} • Client: {resolutionModal?.clientName} vs. {resolutionModal?.freelancerName}
              </Text>

              <Text style={styles.label}>Official Admin Resolution Note</Text>
              <TextInput
                style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
                placeholder="Write the resolution decision visible to both Client and Freelancer in the group chat..."
                placeholderTextColor={COLORS.textSecondary}
                multiline
                value={adminNote}
                onChangeText={setAdminNote}
              />

              <TouchableOpacity
                style={[styles.primaryButton, { marginTop: 5, paddingVertical: 14 }]}
                onPress={() => handleResolveDispute('completed')}
              >
                <Text style={styles.primaryButtonText}>Approve Work & Complete Booking</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.logoutBtn, { marginTop: 10, paddingVertical: 14 }]}
                onPress={() => handleResolveDispute('cancelled')}
              >
                <Text style={styles.logoutText}>Cancel Booking in Favor of Client</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ marginTop: 15, alignItems: 'center' }}
                onPress={() => setResolutionModal(null)}
              >
                <Text style={{ color: COLORS.textSecondary, fontSize: 13 }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

      </SafeAreaView>
    </LinearGradient>
  );
}