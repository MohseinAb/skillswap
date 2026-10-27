import React, { useState, useEffect, useRef } from 'react';
import { 
  Text, View, TextInput, TouchableOpacity, ScrollView, 
  KeyboardAvoidingView, Platform, ActivityIndicator 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { COLORS, styles } from '../styles';
import OfferModal from '../components/OfferModal';
import { getBookingStage, peso, payoutSummary, PAYMENT_CONFIG } from '../services/paymentRules';
import { notify } from '../services/notify';

import { auth, db } from '../firebaseConfig';
import { 
  collection, doc, getDoc, addDoc, updateDoc, 
  query, orderBy, onSnapshot, serverTimestamp 
} from 'firebase/firestore';

export default function ChatScreen({ route, navigation }) {
  const { chatId, otherUserName } = route.params || {};
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [currentUserData, setCurrentUserData] = useState(null);
  const [chatData, setChatData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(null);
  const [offerModalVisible, setOfferModalVisible] = useState(false);
  const scrollViewRef = useRef();

  useEffect(() => {
    if (auth.currentUser) {
      getDoc(doc(db, 'users', auth.currentUser.uid)).then((snap) => {
        if (snap.exists()) setCurrentUserData(snap.data());
      });
    }

    if (!chatId) {
      setLoading(false);
      return;
    }

    // Listen to chat document metadata
    const unsubChat = onSnapshot(doc(db, 'chats', chatId), (docSnap) => {
      if (docSnap.exists()) {
        setChatData({ id: docSnap.id, ...docSnap.data() });
      }
    });

    // Listen to messages in real time
    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubMessages = onSnapshot(q, (snapshot) => {
      const loaded = [];
      snapshot.forEach((docSnap) => {
        loaded.push({ id: docSnap.id, ...docSnap.data() });
      });
      setMessages(loaded);
      setLoading(false);
    });

    return () => {
      unsubChat();
      unsubMessages();
    };
  }, [chatId]);

  // Live profile, so a payout method saved in Profile is picked up when you come back here.
  useEffect(() => {
    if (!auth.currentUser) return undefined;
    return onSnapshot(doc(db, 'users', auth.currentUser.uid), (snap) => {
      if (snap.exists()) setCurrentUserData(snap.data());
    });
  }, []);

  // Each booking has its own chat. Follow that booking so offers and payments show up live.
  useEffect(() => {
    if (!chatData?.bookingId) {
      setBooking(null);
      return undefined;
    }
    return onSnapshot(
      doc(db, 'bookings', chatData.bookingId),
      (snap) => setBooking(snap.exists() ? { id: snap.id, ...snap.data() } : null),
      () => setBooking(null)
    );
  }, [chatData?.bookingId]);

  const isAdmin = 
    (currentUserData?.role || currentUserData?.accountType || '').toLowerCase() === 'admin' ||
    auth.currentUser?.email?.toLowerCase() === 'admin@skillswap.ph';

  const handleSendMessage = async () => {
    if (!inputText.trim() || !auth.currentUser || !chatId) return;

    const cleanText = inputText.trim();
    setInputText('');

    try {
      const senderName = currentUserData?.fullName || currentUserData?.name || auth.currentUser.email?.split('@')[0] || 'User';

      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        text: cleanText,
        senderId: auth.currentUser.uid,
        senderName: senderName,
        senderRole: isAdmin ? 'ADMIN' : (currentUserData?.role || 'USER').toUpperCase(),
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: isAdmin ? `[ADMIN] ${cleanText}` : cleanText,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const displayOtherName = otherUserName || 
    (auth.currentUser?.uid === chatData?.clientId ? chatData?.freelancerName : chatData?.clientName) || 
    'User';

  // --- Booking context: negotiation, offers and payments ---
  const isFreelancerSide = !!booking && auth.currentUser?.uid === booking.freelancerId;
  const stage = getBookingStage(booking);

  const openBookingDetails = () => {
    if (!booking) {
      navigation.goBack();
      return;
    }
    navigation.navigate(isFreelancerSide ? 'BookingProgress' : 'ClientBookingDetail', { bookingId: booking.id });
  };

  const handleCreateOffer = () => {
    if (PAYMENT_CONFIG.REQUIRE_PAYOUT_METHOD && !payoutSummary(currentUserData?.paymentMethod)) {
      notify(
        'Set up your payout method first',
        'Add a GCash, Maya or bank account under Profile, then Payout Method, so SkillSwap knows where to send your earnings.'
      );
      navigation.navigate('FreelancerTabs', { screen: 'Profile' });
      return;
    }
    setOfferModalVisible(true);
  };

  const banner = (() => {
    if (!booking) return null;
    const total = booking.offer?.totalPrice;
    const down = booking.offer?.downpaymentAmount;
    const view = { action: 'View booking', onPress: openBookingDetails };
    switch (stage) {
      case 'negotiating':
      case 'legacy_pending':
        return isFreelancerSide
          ? { text: 'Agree on the details here, then send a custom offer.', action: 'Create offer', onPress: handleCreateOffer }
          : { text: 'Agree on the details here. The freelancer will send a custom offer.', ...view };
      case 'offer_sent':
        return isFreelancerSide
          ? { text: `Offer sent for ${peso(total)}. Waiting for the client.`, action: 'Edit offer', onPress: handleCreateOffer }
          : { text: `New offer for ${peso(total)}. Review it and accept the terms.`, action: 'Review offer', onPress: openBookingDetails };
      case 'awaiting_downpayment':
        return isFreelancerSide
          ? { text: `Offer accepted. Work starts when the ${peso(down)} downpayment is paid.`, ...view }
          : { text: `Offer accepted. Pay the ${peso(down)} downpayment to start the project.`, action: 'Pay downpayment', onPress: openBookingDetails };
      case 'delivered_locked':
        return isFreelancerSide
          ? { text: 'Final work submitted. It unlocks when the client pays the balance.', ...view }
          : { text: 'The final work is ready. Pay the remaining balance to unlock it.', action: 'Pay and unlock', onPress: openBookingDetails };
      case 'completed':
        return { text: 'Project completed and paid.', ...view };
      case 'disputed':
        return { text: 'A dispute is open. Payments are paused.', ...view };
      case 'declined':
      case 'cancelled':
        return { text: `This booking was ${stage}.`, action: null };
      default:
        return { text: 'Project in progress.', ...view };
    }
  })();

  return (
    <LinearGradient colors={[COLORS.bgTop, COLORS.bgBottom]} style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right', 'bottom']}>
        <KeyboardAvoidingView 
          style={{ flex: 1 }} 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Curved Top Chat Header */}
          <View style={styles.chatHeaderBg}>
            <View style={styles.chatHeaderLeft}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 5 }}>
                <Feather name="chevron-left" size={24} color={COLORS.primary} />
              </TouchableOpacity>
              
              <View style={styles.chatAvatarWrapper}>
                <View style={[styles.chatHeaderAvatar, { borderWidth: 1, borderColor: COLORS.primary }]}>
                  <Feather name="user" size={18} color={COLORS.primary} />
                </View>
                <View style={styles.onlineDot} />
              </View>

              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.chatHeaderName} numberOfLines={1}>
                    {displayOtherName.replace(/\s*\[ADMIN\]/gi, '')}
                  </Text>
                  {displayOtherName.includes('[ADMIN]') && (
                    <View style={{ backgroundColor: COLORS.primary, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, marginLeft: 6 }}>
                      <Text style={{ color: '#000', fontSize: 9, fontWeight: 'bold' }}>ADMIN</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.chatHeaderStatus} numberOfLines={1}>
                  {chatData?.projectTitle ? `Project: ${chatData.projectTitle}` : 'Online'}
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.detailsBtn} onPress={openBookingDetails}>
              <Text style={styles.detailsBtnText}>Details</Text>
            </TouchableOpacity>
          </View>

          {/* Booking banner: where this deal stands and what to do next */}
          {booking && banner ? (
            <View
              style={{
                marginHorizontal: 20,
                marginTop: 12,
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: COLORS.primaryDim,
                borderColor: COLORS.primaryLine,
                borderWidth: 1,
                borderRadius: 16,
                paddingVertical: 10,
                paddingHorizontal: 14,
              }}
            >
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>
                  {booking.serviceTitle || 'Booking'}
                </Text>
                <Text style={{ color: COLORS.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 2 }}>{banner.text}</Text>
              </View>
              {banner.action ? (
                <TouchableOpacity
                  onPress={banner.onPress}
                  style={{ backgroundColor: COLORS.primary, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 }}
                >
                  <Text style={{ color: COLORS.onPrimary, fontSize: 12, fontWeight: '800' }}>{banner.action}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          {/* Messages Scroll Area */}
          {loading ? (
            <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50, flex: 1 }} />
          ) : (
            <ScrollView
              ref={scrollViewRef}
              style={styles.chatArea}
              contentContainerStyle={{ paddingBottom: 20 }}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
            >
              <View style={styles.datePillWrapper}>
                <View style={styles.datePill}>
                  <Text style={styles.datePillText}>TODAY</Text>
                </View>
              </View>

              {messages.map((msg) => {
                if (msg.type === 'system') {
                  return (
                    <View key={msg.id} style={{ alignItems: 'center', marginBottom: 16 }}>
                      <View
                        style={{
                          backgroundColor: COLORS.primaryDim,
                          borderColor: COLORS.primaryLine,
                          borderWidth: 1,
                          borderRadius: 14,
                          paddingVertical: 8,
                          paddingHorizontal: 14,
                          maxWidth: '90%',
                        }}
                      >
                        <Text style={{ color: COLORS.text, fontSize: 12, lineHeight: 18, textAlign: 'center' }}>{msg.text}</Text>
                      </View>
                    </View>
                  );
                }
                const isSent = msg.senderId === auth.currentUser?.uid;
                const isMsgAdmin = msg.senderRole === 'ADMIN' || (msg.text && msg.text.startsWith('[ADMIN]'));
                const cleanMsgText = msg.text ? msg.text.replace(/^\[ADMIN\]\s*/i, '') : '';

                return (
                  <View
                    key={msg.id}
                    style={[styles.msgRow, isSent ? styles.msgRowSent : styles.msgRowReceived]}
                  >
                    {!isSent && (
                      <View style={[styles. bubble, styles.bubbleReceived, isMsgAdmin && { borderColor: COLORS.primary }]}>
                        {isMsgAdmin && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                            <View style={{ backgroundColor: COLORS.primary, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5 }}>
                              <Text style={{ color: '#000', fontSize: 9, fontWeight: 'bold' }}>ADMIN</Text>
                            </View>
                            <Text style={{ color: COLORS.primary, fontSize: 10, fontWeight: 'bold', marginLeft: 6 }}>
                              {msg.senderName?.replace(/\s*\[ADMIN\]/gi, '') || 'SkillSwap Admin'}
                            </Text>
                          </View>
                        )}
                        <Text style={styles.bubbleTextReceived}>{cleanMsgText}</Text>
                      </View>
                    )}

                    <Text style={styles.msgTimestamp}>{formatTime(msg.createdAt)}</Text>

                    {isSent && (
                      <View style={[styles.bubble, styles.bubbleSent]}>
                        {isMsgAdmin && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                            <View style={{ backgroundColor: '#000', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5 }}>
                              <Text style={{ color: COLORS.primary, fontSize: 9, fontWeight: 'bold' }}>ADMIN</Text>
                            </View>
                          </View>
                        )}
                        <Text style={styles.bubbleTextSent}>{cleanMsgText}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          )}

          {/* Bottom Message Input Bar */}
          <View style={styles.inputArea}>
            <TouchableOpacity style={styles.plusIconBtn}>
              <Feather name="plus" size={18} color={COLORS.primary} />
            </TouchableOpacity>

            <View style={styles.chatInputWrapper}>
              <TextInput
                style={styles.chatInput}
                placeholder={isAdmin ? "Message as Admin..." : "Type a message..."}
                placeholderTextColor={COLORS.textSecondary}
                value={inputText}
                onChangeText={setInputText}
                onSubmitEditing={handleSendMessage}
              />
            </View>

            <TouchableOpacity style={styles.sendBtn} onPress={handleSendMessage}>
              <Feather name="send" size={16} color="#000" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        <OfferModal
          visible={offerModalVisible}
          booking={booking}
          senderName={currentUserData?.fullName || currentUserData?.name || 'The freelancer'}
          onClose={() => setOfferModalVisible(false)}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}