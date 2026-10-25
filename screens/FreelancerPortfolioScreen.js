import React, { useState, useEffect } from 'react';
import { 
  Text, View, TouchableOpacity, ScrollView, 
  ActivityIndicator, Alert, Image, Linking, Modal 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, FontAwesome } from '@expo/vector-icons';
import { COLORS, styles } from '../styles';

import { auth, db } from '../firebaseConfig';
import { 
  doc, onSnapshot, getDoc, getDocs, 
  collection, query, where, addDoc, serverTimestamp 
} from 'firebase/firestore';

export default function FreelancerPortfolioScreen({ route, navigation }) {
  const { freelancerId, freelancerName } = route.params || {};
  const [freelancer, setFreelancer] = useState(null);
  const [services, setServices] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [selectedServiceFilter, setSelectedServiceFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [bookingServiceId, setBookingServiceId] = useState(null);

  // Fullscreen Image Viewer State
  const [previewImageUri, setPreviewImageUri] = useState(null);

  const isOwnProfile = auth.currentUser && auth.currentUser.uid === freelancerId;

  useEffect(() => {
    if (!freelancerId) return;

    const unsubUser = onSnapshot(doc(db, 'users', freelancerId), (docSnap) => {
      if (docSnap.exists()) {
        setFreelancer({ id: docSnap.id, ...docSnap.data() });
      }
    });

    const qServices = query(
      collection(db, 'services'),
      where('freelancerId', '==', freelancerId)
    );
    const unsubServices = onSnapshot(qServices, (snap) => {
      const srvList = [];
      snap.forEach((d) => {
        const data = d.data();
        if (data.visible !== false || isOwnProfile) {
          srvList.push({ id: d.id, ...data });
        }
      });
      setServices(srvList);
      setLoading(false);
    });

    const qBookings = query(
      collection(db, 'bookings'),
      where('freelancerId', '==', freelancerId)
    );
    const unsubBookings = onSnapshot(qBookings, (snap) => {
      const revList = [];
      snap.forEach((d) => {
        const bData = d.data();
        if (bData.rating || bData.reviewText) {
          revList.push({ id: d.id, ...bData });
        }
      });
      setReviews(revList);
    });

    return () => {
      unsubUser();
      unsubServices();
      unsubBookings();
    };
  }, [freelancerId]);

  const effectiveServices = services.length > 0 ? services : (freelancer ? [{
    id: `default_${freelancerId}`,
    title: freelancer.serviceTitle || freelancer.skills || 'General Freelance Service',
    category: freelancer.category || 'General Services',
    price: freelancer.rate || freelancer.price || 350,
    rateType: freelancer.rateType || 'Hour',
    description: freelancer.bio || 'Professional local freelance service.',
    portfolio: freelancer.portfolio || []
  }] : []);

  const displayedServices = selectedServiceFilter === 'ALL'
    ? effectiveServices
    : effectiveServices.filter((s) => s.id === selectedServiceFilter);

  const handleMessageFreelancer = async () => {
    if (!auth.currentUser || isOwnProfile) return;
    try {
      const qChats = query(
        collection(db, 'chats'),
        where('participants', 'array-contains', auth.currentUser.uid)
      );
      const snap = await getDocs(qChats);
      let chatId = null;

      snap.forEach((d) => {
        if (d.data().participants?.includes(freelancerId)) {
          chatId = d.id;
        }
      });

      const fName = freelancer?.fullName || freelancer?.name || freelancerName || 'Freelancer';

      if (!chatId) {
        const clientDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        const clientName = clientDoc.exists() ? (clientDoc.data().fullName || clientDoc.data().name) : 'Client';

        const newChat = await addDoc(collection(db, 'chats'), {
          participants: [auth.currentUser.uid, freelancerId],
          clientId: auth.currentUser.uid,
          clientName: clientName,
          freelancerId: freelancerId,
          freelancerName: fName,
          projectTitle: 'Portfolio Inquiry',
          lastMessage: 'Hi! I checked out your portfolio on SkillSwap.',
          updatedAt: serverTimestamp()
        });
        chatId = newChat.id;
      }

      navigation.navigate('Chat', { chatId, otherUserName: fName });
    } catch (error) {
      Alert.alert('Error', 'Could not open chat.');
    }
  };

  const handleBookSpecificService = async (service) => {
    if (!auth.currentUser) {
      Alert.alert('Login Required', 'Please log in to book this service.');
      return;
    }

    setBookingServiceId(service.id);
    try {
      const clientDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const clientData = clientDoc.exists() ? clientDoc.data() : {};
      const clientName = clientData.fullName || clientData.name || auth.currentUser.email.split('@')[0];
      const fName = freelancer?.fullName || freelancer?.name || freelancerName || 'Freelancer';

      await addDoc(collection(db, 'bookings'), {
        clientId: auth.currentUser.uid,
        clientName: clientName,
        freelancerId: freelancerId,
        freelancerName: fName,
        serviceId: service.id,
        serviceTitle: service.title,
        projectTitle: service.title,
        category: service.category || 'General',
        price: parseFloat(service.price || 0),
        rateType: service.rateType || 'Hour',
        location: freelancer?.location || freelancer?.address || 'Iligan City',
        status: 'pending',
        progress: 0,
        latestNote: 'Booking requested from Freelancer Portfolio.',
        progressNotes: [],
        createdAt: serverTimestamp()
      });

      Alert.alert(
        'Service Booked!',
        `Your request for "${service.title}" has been sent to ${fName}.`,
        [
          { text: 'Stay Here', style: 'cancel' },
          { text: 'Go to My Bookings', onPress: () => navigation.navigate('ClientTabs', { screen: 'Bookings' }) }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Could not complete booking.');
    } finally {
      setBookingServiceId(null);
    }
  };

  const displayName = freelancer?.fullName || freelancer?.name || freelancerName || 'Freelancer';
  const avatarUri = freelancer?.profileImage || freelancer?.avatar;
  const ratingValue = Number(freelancer?.rating || 5.0).toFixed(1);

  return (
    <LinearGradient colors={[COLORS.bgTop, COLORS.bgBottom]} style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        
        {/* Top Curved Header */}
        <View style={[styles.chatHeaderBg, { paddingVertical: 16, marginBottom: 10 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 5 }}>
            <Feather name="chevron-left" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={{ color: COLORS.text, fontSize: 16, fontWeight: 'bold' }}>
            {isOwnProfile ? 'Public Profile Preview' : 'Freelancer Portfolio'}
          </Text>
          {!isOwnProfile ? (
            <TouchableOpacity style={styles.detailsBtn} onPress={handleMessageFreelancer}>
              <Text style={[styles.detailsBtnText, { color: COLORS.primary }]}>Message</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 50 }} />
          )}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 60 }} />
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}>
            
            {/* Freelancer Profile Banner */}
            <View style={[styles.infoCard, { alignItems: 'center', paddingVertical: 20, marginBottom: 20 }]}>
              <TouchableOpacity
                activeOpacity={avatarUri ? 0.8 : 1}
                onPress={() => avatarUri && setPreviewImageUri(avatarUri)}
                style={[styles.profileAvatar, { borderWidth: 2, borderColor: COLORS.primary, marginBottom: 10 }]}
              >
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={{ width: 80, height: 80, borderRadius: 40 }} />
                ) : (
                  <Feather name="user" size={36} color={COLORS.primary} />
                )}
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: COLORS.text, fontSize: 19, fontWeight: 'bold' }}>{displayName}</Text>
                {freelancer?.verified && (
                  <View style={{ backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, marginLeft: 8 }}>
                    <Text style={{ color: '#000', fontSize: 10, fontWeight: 'bold' }}>✓ VERIFIED</Text>
                  </View>
                )}
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                <Feather name="map-pin" size={12} color={COLORS.primary} />
                <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginLeft: 4 }}>
                  {freelancer?.location || freelancer?.address || 'Iligan City'}
                </Text>
              </View>

              {/* Rating & Services Summary */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.inputBg, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 15, marginRight: 10 }}>
                  <FontAwesome name="star" size={14} color="#F4C77F" />
                  <Text style={{ color: COLORS.text, fontWeight: 'bold', fontSize: 12, marginLeft: 5 }}>
                    {ratingValue} ({reviews.length} Reviews)
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.inputBg, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 15 }}>
                  <Feather name="briefcase" size={13} color={COLORS.primary} />
                  <Text style={{ color: COLORS.text, fontWeight: 'bold', fontSize: 12, marginLeft: 5 }}>
                    {effectiveServices.length} {effectiveServices.length === 1 ? 'Service' : 'Services'}
                  </Text>
                </View>
              </View>

              {freelancer?.bio ? (
                <Text style={{ color: COLORS.textSecondary, fontSize: 12, textAlign: 'center', marginTop: 12, lineHeight: 18 }}>
                  {freelancer.bio}
                </Text>
              ) : null}

              {!isOwnProfile && (
                <TouchableOpacity 
                  style={[styles.btnDark, { width: '100%', paddingVertical: 12, borderRadius: 20, alignItems: 'center', marginTop: 15, marginRight: 0, flexDirection: 'row', justifyContent: 'center', borderColor: COLORS.primary }]}
                  onPress={handleMessageFreelancer}
                >
                  <Feather name="message-square" size={16} color={COLORS.primary} style={{ marginRight: 8 }} />
                  <Text style={[styles.btnDarkText, { color: COLORS.primary }]}>Message {displayName}</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Category / Service Selector Tabs */}
            <Text style={styles.sectionTitle}>PORTFOLIO BY SERVICE OFFERED</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 15 }}>
              <TouchableOpacity
                style={[
                  styles.filterPill,
                  { marginRight: 8, paddingVertical: 8 },
                  selectedServiceFilter === 'ALL' && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }
                ]}
                onPress={() => setSelectedServiceFilter('ALL')}
              >
                <Text style={{
                  color: selectedServiceFilter === 'ALL' ? '#000' : COLORS.text,
                  fontWeight: 'bold',
                  fontSize: 12
                }}>
                  All Services ({effectiveServices.length})
                </Text>
              </TouchableOpacity>

              {effectiveServices.map((srv) => (
                <TouchableOpacity
                  key={srv.id}
                  style={[
                    styles.filterPill,
                    { marginRight: 8, paddingVertical: 8 },
                    selectedServiceFilter === srv.id && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }
                  ]}
                  onPress={() => setSelectedServiceFilter(srv.id)}
                >
                  <Text style={{
                    color: selectedServiceFilter === srv.id ? '#000' : COLORS.text,
                    fontWeight: 'bold',
                    fontSize: 12
                  }}>
                    {srv.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Categorized Service & Portfolio Cards */}
            {displayedServices.map((service) => {
              const samples = Array.isArray(service.portfolio) ? service.portfolio : [];
              const imageSamples = samples.filter((s) => s.startsWith('data:image') || /^https?:\/\/.+\.(jpg|jpeg|png|webp|gif)/i.test(s));
              const linkSamples = samples.filter((s) => !s.startsWith('data:image') && !/^https?:\/\/.+\.(jpg|jpeg|png|webp|gif)/i.test(s));

              return (
                <View key={service.id} style={[styles.serviceCard, { marginBottom: 20 }]}>
                  <View style={styles.serviceTopRow}>
                    <View style={styles.serviceTitleRow}>
                      <View style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(132, 220, 198, 0.15)', paddingVertical: 3, paddingHorizontal: 10, borderRadius: 10, marginBottom: 6 }}>
                        <Text style={{ color: COLORS.primary, fontSize: 10, fontWeight: 'bold' }}>
                          {service.category || 'Service Category'}
                        </Text>
                      </View>
                      <Text style={[styles.serviceTitle, { fontSize: 16 }]}>{service.title}</Text>
                    </View>

                    <View style={styles.servicePriceRight}>
                      <Text style={[styles.servicePriceText, { color: COLORS.primary, fontSize: 16 }]}>
                        ₱ {service.price}
                      </Text>
                      <Text style={styles.serviceRateType}>/ {service.rateType || 'Project'}</Text>
                    </View>
                  </View>

                  {service.description ? (
                    <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 8, marginBottom: 15, lineHeight: 18 }}>
                      {service.description}
                    </Text>
                  ) : null}

                  {/* Portfolio Work Samples (Thumbnails + Links) */}
                  <View style={{ borderTopWidth: 1, borderTopColor: COLORS.inputBorder, paddingTop: 12, marginTop: 4 }}>
                    <Text style={{ color: COLORS.text, fontSize: 12, fontWeight: 'bold', marginBottom: 10 }}>
                      Portfolio & Work Samples ({samples.length})
                    </Text>

                    {samples.length > 0 ? (
                      <>
                        {/* Thumbnail Grid for Images */}
                        {imageSamples.length > 0 && (
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
                            {imageSamples.map((imgUri, idx) => (
                              <TouchableOpacity
                                key={idx}
                                activeOpacity={0.8}
                                onPress={() => setPreviewImageUri(imgUri)}
                                style={{
                                  width: 110,
                                  height: 110,
                                  borderRadius: 12,
                                  overflow: 'hidden',
                                  marginRight: 10,
                                  marginBottom: 10,
                                  borderWidth: 1,
                                  borderColor: COLORS.primary,
                                  backgroundColor: COLORS.inputBg,
                                  position: 'relative'
                                }}
                              >
                                <Image
                                  source={{ uri: imgUri }}
                                  style={{ width: '100%', height: '100%' }}
                                  resizeMode="cover"
                                />
                                <View style={{
                                  position: 'absolute',
                                  bottom: 6,
                                  right: 6,
                                  backgroundColor: 'rgba(0,0,0,0.65)',
                                  padding: 5,
                                  borderRadius: 8
                                }}>
                                  <Feather name="maximize-2" size={12} color={COLORS.primary} />
                                </View>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}

                        {/* Clickable Rows for Links / Text Samples */}
                        {linkSamples.map((sample, index) => {
                          const isWebLink = /^https?:\/\//i.test(sample) || sample.includes('drive.google.com') || sample.includes('github.com') || sample.includes('figma.com');
                          return (
                            <TouchableOpacity
                              key={index}
                              activeOpacity={isWebLink ? 0.7 : 1}
                              onPress={() => {
                                if (isWebLink) {
                                  const url = sample.startsWith('http') ? sample : `https://${sample}`;
                                  Linking.openURL(url).catch(() => {});
                                }
                              }}
                              style={{
                                backgroundColor: COLORS.inputBg,
                                borderWidth: 1,
                                borderColor: COLORS.inputBorder,
                                borderRadius: 12,
                                padding: 12,
                                marginBottom: 8,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                              }}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(132, 220, 198, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                                  <Feather name={isWebLink ? 'link' : 'folder'} size={14} color={COLORS.primary} />
                                </View>
                                <Text style={{ color: COLORS.text, fontSize: 13, flex: 1 }} numberOfLines={1}>
                                  {sample}
                                </Text>
                              </View>
                              {isWebLink && <Feather name="external-link" size={14} color={COLORS.primary} />}
                            </TouchableOpacity>
                          );
                        })}
                      </>
                    ) : (
                      <View style={{ backgroundColor: COLORS.inputBg, borderRadius: 10, padding: 12, alignItems: 'center' }}>
                        <Text style={{ color: COLORS.textSecondary, fontSize: 11 }}>
                          No portfolio samples uploaded for this service yet.
                        </Text>
                      </View>
                    )}
                  </View>

                  {!isOwnProfile && (
                    <TouchableOpacity
                      style={[styles.bookBtn, { marginTop: 12 }]}
                      onPress={() => handleBookSpecificService(service)}
                      disabled={bookingServiceId === service.id}
                    >
                      {bookingServiceId === service.id ? (
                        <ActivityIndicator color="#000" size="small" />
                      ) : (
                        <Text style={styles.bookBtnText}>Book "{service.title}"</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}

            {/* Client Reviews Section */}
            <Text style={[styles.sectionTitle, { marginTop: 10 }]}>CLIENT REVIEWS ({reviews.length})</Text>
            {reviews.length > 0 ? (
              reviews.map((rev) => (
                <View key={rev.id} style={[styles.infoCard, { marginBottom: 10 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={{ color: COLORS.text, fontWeight: 'bold', fontSize: 13 }}>
                      {rev.clientName || 'Client'}
                    </Text>
                    <View style={{ flexDirection: 'row' }}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <FontAwesome
                          key={s}
                          name={s <= (rev.rating || 5) ? 'star' : 'star-o'}
                          size={12}
                          color="#F4C77F"
                          style={{ marginLeft: 2 }}
                        />
                      ))}
                    </View>
                  </View>
                  <Text style={{ color: COLORS.primary, fontSize: 11, marginBottom: 4 }}>
                    Service: {rev.serviceTitle || rev.projectTitle || 'Service'}
                  </Text>
                  {rev.reviewText ? (
                    <Text style={{ color: COLORS.textSecondary, fontSize: 12, lineHeight: 17 }}>
                      "{rev.reviewText}"
                    </Text>
                  ) : null}
                </View>
              ))
            ) : (
              <View style={styles.infoCard}>
                <Text style={{ color: COLORS.textSecondary, fontSize: 12 }}>
                  No client reviews yet.
                </Text>
              </View>
            )}

          </ScrollView>
        )}

        {/* Full-Resolution Image Lightbox Modal */}
        <Modal visible={previewImageUri !== null} transparent animationType="fade">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <TouchableOpacity
              onPress={() => setPreviewImageUri(null)}
              style={{
                position: 'absolute',
                top: 40,
                right: 25,
                zIndex: 10,
                backgroundColor: COLORS.cardInactiveBg,
                width: 40,
                height: 40,
                borderRadius: 20,
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: COLORS.primary
              }}
            >
              <Feather name="x" size={22} color={COLORS.primary} />
            </TouchableOpacity>

            {previewImageUri && (
              <Image
                source={{ uri: previewImageUri }}
                style={{ width: '100%', height: '80%', borderRadius: 12 }}
                resizeMode="contain"
              />
            )}
          </View>
        </Modal>

      </SafeAreaView>
    </LinearGradient>
  );
}