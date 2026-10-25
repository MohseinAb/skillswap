import React, { useState, useEffect } from 'react';
import { 
  Text, View, TextInput, TouchableOpacity, ScrollView, 
  ActivityIndicator, Alert, Modal, Image 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, styles } from '../styles';

import { auth, db } from '../firebaseConfig';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';

export default function ServiceBookingsScreen({ route, navigation }) {
  const { service } = route.params;
  const [liveService, setLiveService] = useState(service);
  const [bookings, setBookings] = useState([]);
  const [showAllBookings, setShowAllBookings] = useState(false);
  const [loading, setLoading] = useState(true);

  // Portfolio Editor Modal State
  const [portfolioModalVisible, setPortfolioModalVisible] = useState(false);
  const [sampleLink, setSampleLink] = useState('');

  useEffect(() => {
    if (!auth.currentUser) return;

    // Live listener for this service document so portfolio updates immediately
    const unsubService = onSnapshot(doc(db, 'services', service.id), (docSnap) => {
      if (docSnap.exists()) {
        setLiveService({ id: docSnap.id, ...docSnap.data() });
      }
    });

    const q = query(
      collection(db, 'bookings'),
      where('freelancerId', '==', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const all = [];
      snapshot.forEach((d) => {
        all.push({ id: d.id, ...d.data() });
      });
      setBookings(all);
      setLoading(false);
    });

    return () => {
      unsubService();
      unsubscribe();
    };
  }, [service.id]);

  const handleAddLinkSample = async () => {
    if (!sampleLink.trim()) return;
    const current = Array.isArray(liveService.portfolio) ? liveService.portfolio : [];
    await updateDoc(doc(db, 'services', liveService.id), {
      portfolio: [...current, sampleLink.trim()]
    });
    setSampleLink('');
  };

  const handleAddPhotoSample = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.4,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      const asset = result.assets[0];
      const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
      const current = Array.isArray(liveService.portfolio) ? liveService.portfolio : [];
      await updateDoc(doc(db, 'services', liveService.id), {
        portfolio: [...current, uri]
      });
    }
  };

  const handleRemoveSample = async (idx) => {
    const current = Array.isArray(liveService.portfolio) ? liveService.portfolio : [];
    await updateDoc(doc(db, 'services', liveService.id), {
      portfolio: current.filter((_, i) => i !== idx)
    });
  };

  const filteredBookings = bookings.filter((b) => {
    if (showAllBookings) return true;
    return (
      b.serviceId === liveService.id ||
      (b.serviceTitle && b.serviceTitle.toLowerCase() === liveService.title?.toLowerCase()) ||
      (b.projectTitle && b.projectTitle.toLowerCase() === liveService.title?.toLowerCase()) ||
      (b.category && b.category.toLowerCase() === liveService.category?.toLowerCase())
    );
  });

  const pendingRequests = filteredBookings.filter(b => (b.status || 'pending').toLowerCase() === 'pending');
  const activeBookings = filteredBookings.filter(b => ['active', 'accepted', 'disputed'].includes((b.status || '').toLowerCase()) || b.disputeStatus === 'open');
  const completedBookings = filteredBookings.filter(b => (b.status || '').toLowerCase() === 'completed');

  const handleAccept = async (booking) => {
    try {
      await updateDoc(doc(db, 'bookings', booking.id), {
        status: 'active',
        serviceId: liveService.id,
        serviceTitle: liveService.title,
        price: booking.price || liveService.price || 0,
        progress: booking.progress || 0,
        latestNote: 'Booking accepted by freelancer. Project started!',
        updatedAt: serverTimestamp()
      });
      Alert.alert('Accepted!', 'Booking moved to Active Bookings. Tap it to update progress and notes.');
    } catch (error) {
      Alert.alert('Error', 'Could not accept booking.');
    }
  };

  const handleDecline = async (bookingId) => {
    Alert.alert('Decline Request', 'Are you sure you want to decline this booking request?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Decline',
        style: 'destructive',
        onPress: async () => {
          await updateDoc(doc(db, 'bookings', bookingId), {
            status: 'declined',
            updatedAt: serverTimestamp()
          });
        }
      }
    ]);
  };

  return (
    <LinearGradient colors={[COLORS.bgTop, COLORS.bgBottom]} style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        
        {/* Curved Header */}
        <View style={[styles.chatHeaderBg, { paddingVertical: 16, marginBottom: 15 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 5 }}>
            <Feather name="chevron-left" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginHorizontal: 10 }}>
            <Text style={{ color: COLORS.text, fontSize: 16, fontWeight: 'bold' }} numberOfLines={1}>
              {liveService.title}
            </Text>
            <Text style={{ color: COLORS.primary, fontSize: 11 }}>
              ₱ {liveService.price} / {liveService.rateType || 'Project'} • {liveService.category}
            </Text>
          </View>
          <TouchableOpacity 
            style={[styles.detailsBtn, { borderColor: COLORS.primary }]}
            onPress={() => setPortfolioModalVisible(true)}
          >
            <Text style={[styles.detailsBtnText, { color: COLORS.primary }]}>Edit Portfolio</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} />
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}>
            
            {/* Service Portfolio Banner */}
            <TouchableOpacity
              style={[styles.infoCard, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderColor: COLORS.primary }]}
              onPress={() => setPortfolioModalVisible(true)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Feather name="folder" size={20} color={COLORS.primary} style={{ marginRight: 12 }} />
                <View>
                  <Text style={{ color: COLORS.text, fontWeight: 'bold', fontSize: 13 }}>
                    Service Portfolio Samples ({(liveService.portfolio || []).length})
                  </Text>
                  <Text style={{ color: COLORS.textSecondary, fontSize: 11 }}>
                    Tap to upload photos or add Google Drive / project links
                  </Text>
                </View>
              </View>
              <Feather name="edit-2" size={16} color={COLORS.primary} />
            </TouchableOpacity>

            {/* 1. PENDING REQUESTS */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitleMain}>Pending Requests ({pendingRequests.length})</Text>
              <TouchableOpacity onPress={() => setShowAllBookings(!showAllBookings)}>
                <Text style={{ color: COLORS.primary, fontSize: 11 }}>
                  {showAllBookings ? 'Filter by This Service' : 'Show All My Bookings'}
                </Text>
              </TouchableOpacity>
            </View>

            {pendingRequests.length > 0 ? (
              pendingRequests.map((req) => (
                <View key={req.id} style={styles.requestCard}>
                  <View style={styles.requestTopRow}>
                    <View style={styles.requestClientInfo}>
                      <View style={styles.clientInitialAvatar}>
                        <Text style={styles.clientInitialText}>
                          {(req.clientName || 'C').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.requestClientName}>{req.clientName || 'Client'}</Text>
                        <Text style={styles.requestProjectTitle}>
                          {req.serviceTitle || req.projectTitle || liveService.title}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.requestPriceRight}>
                      <Text style={styles.requestPriceText}>₱ {req.price || liveService.price || 0}</Text>
                      <Text style={styles.requestLocationText}>{req.location || 'Local'}</Text>
                    </View>
                  </View>

                  <View style={styles.requestBtnRow}>
                    <TouchableOpacity style={styles.declineBtn} onPress={() => handleDecline(req.id)}>
                      <Text style={styles.declineBtnText}>Decline</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAccept(req)}>
                      <Text style={styles.acceptBtnText}>Accept Project</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
              <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 25 }}>
                No pending requests for this service.
              </Text>
            )}

            {/* 2. ACTIVE BOOKINGS */}
            <View style={[styles.sectionHeaderRow, { marginTop: 10 }]}>
              <Text style={styles.sectionTitleMain}>Active Bookings ({activeBookings.length})</Text>
              <Text style={styles.viewAllText}>Tap card to update progress</Text>
            </View>

            {activeBookings.length > 0 ? (
              activeBookings.map((booking) => (
                <TouchableOpacity
                  key={booking.id}
                  style={styles.activeProjectCard}
                  activeOpacity={0.8}
                  onPress={() => navigation.navigate('BookingProgress', { bookingId: booking.id })}
                >
                  <View style={styles.verticalAccent} />
                  <View style={styles.apContent}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={styles.apTitle}>{booking.serviceTitle || booking.projectTitle || liveService.title}</Text>
                      <Feather name="edit-3" size={15} color={COLORS.primary} />
                    </View>
                    <Text style={styles.apClient}>Client: {booking.clientName || 'Client'} • ₱ {booking.price || liveService.price}</Text>
                    
                    {booking.latestNote ? (
                      <Text style={{ color: COLORS.primary, fontSize: 11, marginBottom: 10 }} numberOfLines={2}>
                        Note: "{booking.latestNote}"
                      </Text>
                    ) : null}

                    <View style={styles.progressRow}>
                      <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: `${booking.progress || 0}%` }]} />
                      </View>
                      <Text style={styles.progressText}>{booking.progress || 0}%</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 25 }}>
                No active bookings right now.
              </Text>
            )}

            {/* 3. COMPLETED BOOKINGS */}
            <View style={[styles.sectionHeaderRow, { marginTop: 10 }]}>
              <Text style={styles.sectionTitleMain}>Completed ({completedBookings.length})</Text>
            </View>

            {completedBookings.length > 0 ? (
              completedBookings.map((booking) => (
                <TouchableOpacity
                  key={booking.id}
                  style={[styles.activeProjectCard, { opacity: 0.75 }]}
                  onPress={() => navigation.navigate('BookingProgress', { bookingId: booking.id })}
                >
                  <View style={[styles.verticalAccent, { backgroundColor: COLORS.textSecondary }]} />
                  <View style={styles.apContent}>
                    <Text style={styles.apTitle}>{booking.serviceTitle || booking.projectTitle || liveService.title}</Text>
                    <Text style={styles.apClient}>Client: {booking.clientName || 'Client'} • ₱ {booking.price || liveService.price}</Text>
                    <Text style={{ color: COLORS.primary, fontSize: 11 }}>✓ Completed (100%)</Text>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={{ color: COLORS.textSecondary, fontSize: 12 }}>
                No completed bookings yet.
              </Text>
            )}

          </ScrollView>
        )}

        {/* Modal to Edit Portfolio of This Specific Service */}
        <Modal visible={portfolioModalVisible} transparent animationType="slide">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 20 }}>
            <View style={{ backgroundColor: COLORS.cardInactiveBg, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: COLORS.inputBorder, maxHeight: '85%' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ color: COLORS.text, fontSize: 16, fontWeight: 'bold' }}>
                  Portfolio: {liveService.title}
                </Text>
                <TouchableOpacity onPress={() => setPortfolioModalVisible(false)}>
                  <Feather name="x" size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.label}>Add Google Drive / Project Link</Text>
                <View style={{ flexDirection: 'row', marginBottom: 12 }}>
                  <TextInput
                    style={[styles.input, { flex: 1, marginBottom: 0, marginRight: 8, paddingVertical: 12 }]}
                    placeholder="https://drive.google.com/..."
                    placeholderTextColor={COLORS.textSecondary}
                    value={sampleLink}
                    onChangeText={setSampleLink}
                  />
                  <TouchableOpacity
                    style={{ backgroundColor: COLORS.primary, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 12 }}
                    onPress={handleAddLinkSample}
                  >
                    <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 12 }}>Add</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[styles.uploadBox, { padding: 15, marginBottom: 15 }]}
                  onPress={handleAddPhotoSample}
                >
                  <Feather name="image" size={20} color={COLORS.primary} style={{ marginBottom: 6 }} />
                  <Text style={{ color: COLORS.primary, fontSize: 12, fontWeight: 'bold' }}>+ Upload Work Sample Photo</Text>
                </TouchableOpacity>

                <Text style={styles.label}>Uploaded Portfolio Samples ({(liveService.portfolio || []).length})</Text>
                {(liveService.portfolio || []).map((item, idx) => {
                  const isImg = item.startsWith('data:image') || /^https?:\/\/.+\.(jpg|jpeg|png|webp|gif)/i.test(item);
                  return (
                    <View key={idx} style={{ backgroundColor: COLORS.inputBg, padding: 10, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: COLORS.inputBorder }}>
                      {isImg && (
                        <Image source={{ uri: item }} style={{ width: '100%', height: 120, borderRadius: 8, marginBottom: 8 }} resizeMode="cover" />
                      )}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ color: COLORS.text, fontSize: 12, flex: 1, marginRight: 10 }} numberOfLines={1}>
                          {isImg ? `Portfolio Image #${idx + 1}` : item}
                        </Text>
                        <TouchableOpacity onPress={() => handleRemoveSample(idx)}>
                          <Feather name="trash-2" size={16} color="#FF4C4C" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}

                <TouchableOpacity style={styles.primaryButton} onPress={() => setPortfolioModalVisible(false)}>
                  <Text style={styles.primaryButtonText}>Done</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

      </SafeAreaView>
    </LinearGradient>
  );
}