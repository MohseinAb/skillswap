import React, { useState, useEffect } from 'react';
import { 
  Text, View, TextInput, TouchableOpacity, ScrollView, 
  Image, Alert, Modal, ActivityIndicator, Linking 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, styles } from '../styles';
import { notify } from '../services/notify';
import { validatePayoutForm, payoutSummary } from '../services/paymentRules';
import { registerForPush, unregisterPush, getPushStatus } from '../services/notifications';

import { auth, db } from '../firebaseConfig';
import { 
  doc, onSnapshot, updateDoc, collection, query, where 
} from 'firebase/firestore';
import { 
  updatePassword, EmailAuthProvider, reauthenticateWithCredential, signOut 
} from 'firebase/auth';

export default function ProfileScreen({ navigation }) {
  const [userData, setUserData] = useState(null);

  // Push notification status for this phone (refreshed whenever the screen is shown)
  const [pushStatus, setPushStatus] = useState({ supported: true, granted: false, canAskAgain: true, registered: false });
  const refreshPushStatus = () => getPushStatus().then(setPushStatus).catch(() => {});
  useEffect(() => {
    refreshPushStatus();
    return navigation.addListener('focus', refreshPushStatus);
  }, []);
  const [services, setServices] = useState([]);

  // Edit Account Info Modal State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUri, setAvatarUri] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Change Password Modal State
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // Manage Service Portfolio Modal State
  const [portfolioModalVisible, setPortfolioModalVisible] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState(null);
  const [newSampleLink, setNewSampleLink] = useState('');
  const [savingPortfolio, setSavingPortfolio] = useState(false);

  // Help & Support & Lightbox Modals
  const [helpModalVisible, setHelpModalVisible] = useState(false);
  const [previewImageUri, setPreviewImageUri] = useState(null);

  // --- UPGRADED: Payment Setup Modal State ---
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentType, setPaymentType] = useState('GCash');
  const [paymentName, setPaymentName] = useState('');
  const [paymentNumber, setPaymentNumber] = useState('');
  const [paymentBankName, setPaymentBankName] = useState('');
  const [paymentQR, setPaymentQR] = useState(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    const unsubUser = onSnapshot(doc(db, 'users', auth.currentUser.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserData(data);
        setFullName(data.fullName || data.name || '');
        setPhone(data.phone || data.contactNumber || '');
        setLocation(data.location || data.address || '');
        setBio(data.bio || '');
        setAvatarUri(data.profileImage || data.avatar || '');
        
        // Load existing payment info
        if (data.paymentMethod) {
          setPaymentType(data.paymentMethod.type || 'GCash');
          setPaymentName(data.paymentMethod.name || '');
          setPaymentNumber(data.paymentMethod.number || '');
          setPaymentBankName(data.paymentMethod.bankName || '');
          setPaymentQR(data.paymentMethod.qrCode || null);
        }
      }
    });

    const qServices = query(
      collection(db, 'services'),
      where('freelancerId', '==', auth.currentUser.uid)
    );
    const unsubServices = onSnapshot(qServices, (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setServices(list);
      if (list.length > 0 && !selectedServiceId) {
        setSelectedServiceId(list[0].id);
      }
    });

    return () => {
      unsubUser();
      unsubServices();
    };
  }, []);

  const role = (userData?.role || userData?.accountType || '').toLowerCase();
  const isFreelancer = role === 'freelancer';
  const payoutLine = payoutSummary(userData?.paymentMethod);

  const pushLabel = !pushStatus.supported
    ? 'Only available in the mobile app'
    : pushStatus.granted && pushStatus.registered
    ? 'On for this phone'
    : pushStatus.granted
    ? 'Allowed, but not set up. Tap to retry.'
    : pushStatus.canAskAgain
    ? 'Off. Tap to turn on.'
    : 'Blocked in phone settings. Tap to open them.';

  const handlePushRow = async () => {
    if (!pushStatus.supported) {
      notify('Not available here', 'Push notifications work in the installed mobile app, not in the browser.');
      return;
    }
    if (pushStatus.granted && pushStatus.registered) {
      notify('Notifications are on', 'This phone gets alerts for messages, bookings, offers, payments and progress updates.');
      return;
    }
    if (!pushStatus.granted && !pushStatus.canAskAgain) {
      Linking.openSettings();
      return;
    }
    const result = await registerForPush();
    await refreshPushStatus();
    if (result.status === 'granted') {
      notify('Notifications are on', 'This phone will now get alerts.');
    } else if (result.status === 'no-project-id') {
      notify('This build cannot do push yet', 'The app has no EAS project id. Run "eas init", then rebuild the app.');
    } else if (result.status === 'denied') {
      notify('Permission needed', 'Allow notifications for SkillSwap to receive alerts.');
    } else {
      notify('Could not turn notifications on', result.error || 'Please try again.');
    }
  };
  const isAdmin = role === 'admin' || auth.currentUser?.email?.toLowerCase() === 'admin@skillswap.ph';
  const selectedService = services.find((s) => s.id === selectedServiceId) || services[0];

  const handlePickProfilePhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.4,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setAvatarUri(uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Could not select image.');
    }
  };

  const handleSaveProfile = async () => {
    if (!auth.currentUser) return;
    setSavingProfile(true);
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        fullName: fullName.trim(),
        name: fullName.trim(),
        phone: phone.trim(),
        contactNumber: phone.trim(),
        location: location.trim(),
        address: location.trim(),
        bio: bio.trim(),
        profileImage: avatarUri,
        avatar: avatarUri,
      });
      setEditModalVisible(false);
      Alert.alert('Saved!', 'Your account details have been updated.');
    } catch (error) {
      Alert.alert('Error', 'Could not update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  // --- NEW: Upload QR Code for E-Wallets ---
  const handlePickQR = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setPaymentQR(uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Could not select QR Code.');
    }
  };

  // --- Save payout details (validated, GCash/Maya numbers are normalised to 09XXXXXXXXX) ---
  const handleSavePayment = async () => {
    if (!auth.currentUser) return;
    const check = validatePayoutForm({
      type: paymentType,
      name: paymentName,
      number: paymentNumber,
      bankName: paymentBankName,
    });
    if (!check.ok) {
      notify('Check your payout details', check.error);
      return;
    }
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        paymentMethod: {
          type: paymentType,
          name: check.name,
          number: check.number,
          bankName: check.bankName,
          qrCode: paymentQR,
          updatedAt: new Date().toISOString()
        }
      });
      setPaymentName(check.name);
      setPaymentNumber(check.number);
      setShowPaymentModal(false);
      notify('Payout method saved', 'SkillSwap will send your earnings here once a project is completed and paid.');
    } catch (error) {
      notify('Error', 'Failed to save payment details.');
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Missing Fields', 'Please fill in all password fields.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Weak Password', 'New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'New password and confirmation do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      const user = auth.currentUser;
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordModalVisible(false);
      Alert.alert('Success', 'Your password has been changed!');
    } catch (error) {
      Alert.alert('Error', 'Current password is incorrect or session expired.');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleAddPortfolioLink = async () => {
    if (!selectedService || !newSampleLink.trim()) return;
    setSavingPortfolio(true);
    try {
      const currentPortfolio = Array.isArray(selectedService.portfolio) ? selectedService.portfolio : [];
      const updated = [...currentPortfolio, newSampleLink.trim()];
      await updateDoc(doc(db, 'services', selectedService.id), {
        portfolio: updated
      });
      setNewSampleLink('');
    } catch (error) {
      Alert.alert('Error', 'Failed to add portfolio sample.');
    } finally {
      setSavingPortfolio(false);
    }
  };

  const handleAddPortfolioPhoto = async () => {
    if (!selectedService) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.4,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setSavingPortfolio(true);
        const asset = result.assets[0];
        const photoData = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;

        const currentPortfolio = Array.isArray(selectedService.portfolio) ? selectedService.portfolio : [];
        await updateDoc(doc(db, 'services', selectedService.id), {
          portfolio: [...currentPortfolio, photoData]
        });
        setSavingPortfolio(false);
      }
    } catch (error) {
      setSavingPortfolio(false);
      Alert.alert('Error', 'Failed to upload portfolio photo.');
    }
  };

  const handleRemovePortfolioSample = async (index) => {
    if (!selectedService) return;
    try {
      const currentPortfolio = Array.isArray(selectedService.portfolio) ? selectedService.portfolio : [];
      const updated = currentPortfolio.filter((_, i) => i !== index);
      await updateDoc(doc(db, 'services', selectedService.id), {
        portfolio: updated
      });
    } catch (error) {
      Alert.alert('Error', 'Could not remove item.');
    }
  };

  const handleLogout = async () => {
    try {
      await unregisterPush(); // stop this phone receiving this account's notifications
      await signOut(auth);
      navigation.replace('Login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const displayName = userData?.fullName || userData?.name || auth.currentUser?.email?.split('@')[0] || 'User';

  return (
    <LinearGradient colors={[COLORS.bgTop, COLORS.bgBottom]} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
          
          <Text style={[styles.headerText, { marginTop: 10 }]}>My Profile</Text>

          <View style={styles.profileAvatarContainer}>
            <TouchableOpacity style={[styles.profileAvatar, { position: 'relative' }]} onPress={() => setEditModalVisible(true)}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={{ width: '100%', height: '100%', borderRadius: 48 }} />
              ) : (
                <Feather name="user" size={40} color={COLORS.primary} />
              )}
              <View style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: COLORS.primary, width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.bgTop }}>
                <Feather name="edit-2" size={12} color="#000" />
              </View>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
              <Text style={[styles.profileName, { marginTop: 0 }]}>{displayName}</Text>
              {userData?.verified && (
                <View style={{ backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, marginLeft: 8 }}>
                  <Text style={{ color: '#000', fontSize: 9, fontWeight: 'bold' }}>✓ VERIFIED</Text>
                </View>
              )}
              {isAdmin && (
                <View style={{ backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, marginLeft: 8 }}>
                  <Text style={{ color: '#000', fontSize: 9, fontWeight: 'bold' }}>ADMIN</Text>
                </View>
              )}
            </View>
            <Text style={styles.profileRole}>
              {isAdmin ? 'SYSTEM ADMINISTRATOR' : isFreelancer ? 'FREELANCER ACCOUNT' : 'CLIENT ACCOUNT'}
            </Text>

            {isFreelancer && (
              <View style={{ flexDirection: 'row', marginTop: 15 }}>
                <TouchableOpacity style={{ backgroundColor: 'rgba(0, 229, 136, 0.1)', borderWidth: 1.5, borderColor: COLORS.primary, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20, flexDirection: 'row', alignItems: 'center', marginRight: 10 }} onPress={() => navigation.navigate('FreelancerPortfolio', { freelancerId: auth.currentUser.uid, freelancerName: displayName })}>
                  <Feather name="eye" size={14} color={COLORS.primary} style={{ marginRight: 6 }} />
                  <Text style={{ color: COLORS.primary, fontSize: 12, fontWeight: '800' }}>View Public Profile</Text>
                </TouchableOpacity>

                <TouchableOpacity style={{ backgroundColor: COLORS.primary, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20, flexDirection: 'row', alignItems: 'center' }} onPress={() => setPortfolioModalVisible(true)}>
                  <Feather name="folder-plus" size={14} color="#000" style={{ marginRight: 6 }} />
                  <Text style={{ color: '#000', fontSize: 12, fontWeight: '800' }}>Edit Service Portfolios</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 8 }}>
            <Text style={[styles.sectionTitle, { marginTop: 0, marginBottom: 0 }]}>ACCOUNT INFO</Text>
            <TouchableOpacity onPress={() => setEditModalVisible(true)} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Feather name="edit-3" size={13} color={COLORS.primary} />
              <Text style={{ color: COLORS.primary, fontSize: 12, fontWeight: '800', marginLeft: 4 }}>Edit Details</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Full Name</Text>
            <Text style={styles.infoValue}>{displayName}</Text>
            <Text style={styles.infoLabel}>Email Address</Text>
            <Text style={styles.infoValue}>{auth.currentUser?.email}</Text>
            <Text style={styles.infoLabel}>Contact Number</Text>
            <Text style={styles.infoValue}>{phone || 'Not set (Tap Edit Details)'}</Text>
            <Text style={styles.infoLabel}>Location</Text>
            <Text style={[styles.infoValue, !isFreelancer && { marginBottom: 0 }]}>{location || 'Iligan City'}</Text>
            {isFreelancer && (
              <>
                <Text style={styles.infoLabel}>Freelancer Bio</Text>
                <Text style={[styles.infoValue, { marginBottom: 0 }]}>{bio || 'No bio added yet.'}</Text>
              </>
            )}
          </View>

          <Text style={styles.sectionTitle}>PAYMENT & PREFERENCES</Text>
          <View style={[styles.infoCard, { paddingVertical: 5 }]}>
            {isFreelancer && (
              <TouchableOpacity style={styles.listItem} onPress={() => setPortfolioModalVisible(true)}>
                <View style={styles.listLeft}><Feather name="briefcase" size={18} color={COLORS.primary} /><Text style={styles.listText}>Manage Service Portfolios ({services.length})</Text></View>
                <Feather name="chevron-right" size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            )}
            
            <TouchableOpacity style={styles.listItem} onPress={handlePushRow}>
              <View style={styles.listLeft}>
                <Feather name="bell" size={18} color={COLORS.primary} />
                <View>
                  <Text style={styles.listText}>Push notifications</Text>
                  <Text style={[styles.listText, { fontSize: 12, fontWeight: '500', marginTop: 2, color: pushStatus.granted && pushStatus.registered ? COLORS.textSecondary : COLORS.warning }]}>
                    {pushLabel}
                  </Text>
                </View>
              </View>
              <Feather name="chevron-right" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>

            {isFreelancer && (
              <TouchableOpacity style={styles.listItem} onPress={() => setShowPaymentModal(true)}>
                <View style={styles.listLeft}>
                  <Feather name="credit-card" size={18} color={COLORS.primary} />
                  <View>
                    <Text style={styles.listText}>Payment Methods</Text>
                    <Text style={[styles.listText, { fontSize: 12, fontWeight: '500', marginTop: 2, color: payoutLine ? COLORS.textSecondary : COLORS.warning }]}>
                      {payoutLine || 'Not set. Add one to send offers and get paid.'}
                    </Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.listItem} onPress={() => setPasswordModalVisible(true)}>
              <View style={styles.listLeft}><Feather name="lock" size={18} color={COLORS.primary} /><Text style={styles.listText}>Security & Password</Text></View>
              <Feather name="chevron-right" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>

            {isAdmin && (
              <TouchableOpacity style={styles.listItem} onPress={() => navigation.navigate('AdminDashboard')}>
                <View style={styles.listLeft}><Feather name="shield" size={18} color={COLORS.primary} /><Text style={styles.listText}>Open Admin Console</Text></View>
                <Feather name="chevron-right" size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            )}

            <TouchableOpacity style={[styles.listItem, { borderBottomWidth: 0 }]} onPress={() => setHelpModalVisible(true)}>
              <View style={styles.listLeft}><Feather name="help-circle" size={18} color={COLORS.primary} /><Text style={styles.listText}>Help & Support</Text></View>
              <Feather name="chevron-right" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Feather name="log-out" size={18} color="#FF4C4C" />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* MODAL 1: EDIT ACCOUNT DETAILS */}
        <Modal visible={editModalVisible} transparent animationType="slide">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 20 }}>
            <View style={{ backgroundColor: COLORS.cardInactiveBg, borderRadius: 24, padding: 20, borderWidth: 1.5, borderColor: COLORS.inputBorder, maxHeight: '90%' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                <Text style={{ color: COLORS.text, fontSize: 18, fontWeight: '900' }}>Edit Account Details</Text>
                <TouchableOpacity onPress={() => setEditModalVisible(false)}><Feather name="x" size={24} color={COLORS.textSecondary} /></TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ alignItems: 'center', marginBottom: 20 }}>
                  <TouchableOpacity onPress={handlePickProfilePhoto} style={{ alignItems: 'center' }}>
                    <View style={[styles.profileAvatar, { width: 80, height: 80, borderRadius: 40 }]}>
                      {avatarUri ? <Image source={{ uri: avatarUri }} style={{ width: '100%', height: '100%', borderRadius: 40 }} /> : <Feather name="camera" size={28} color={COLORS.primary} />}
                    </View>
                    <Text style={{ color: COLORS.primary, fontSize: 12, marginTop: 10, fontWeight: '800' }}>Change Photo</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.label}>Full Name</Text><TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="Enter your full name" placeholderTextColor={COLORS.textSecondary}/>
                <Text style={styles.label}>Contact Number</Text><TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+63 912 345 6789" placeholderTextColor={COLORS.textSecondary} keyboardType="phone-pad"/>
                <Text style={styles.label}>Location / Barangay</Text><TextInput style={styles.input} value={location} onChangeText={setLocation} placeholder="e.g. Tibanga, Iligan City" placeholderTextColor={COLORS.textSecondary}/>
                {isFreelancer && (<><Text style={styles.label}>Bio / About Me</Text><TextInput style={[styles.input, { height: 100, textAlignVertical: 'top' }]} value={bio} onChangeText={setBio} multiline placeholder="Tell clients about your skills and experience..." placeholderTextColor={COLORS.textSecondary}/></>)}
                <TouchableOpacity style={styles.primaryButton} onPress={handleSaveProfile} disabled={savingProfile}>
                  {savingProfile ? <ActivityIndicator color="#000" /> : <Text style={styles.primaryButtonText}>Save Changes</Text>}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* MODAL 2: SECURITY & PASSWORD */}
        <Modal visible={passwordModalVisible} transparent animationType="fade">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 20 }}>
            <View style={{ backgroundColor: COLORS.cardInactiveBg, borderRadius: 24, padding: 24, borderWidth: 1.5, borderColor: COLORS.inputBorder }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}><Text style={{ color: COLORS.text, fontSize: 18, fontWeight: '900' }}>Change Password</Text><TouchableOpacity onPress={() => setPasswordModalVisible(false)}><Feather name="x" size={24} color={COLORS.textSecondary} /></TouchableOpacity></View>
              <Text style={styles.label}>Current Password</Text><TextInput style={styles.input} secureTextEntry value={currentPassword} onChangeText={setCurrentPassword} placeholder="Enter current password" placeholderTextColor={COLORS.textSecondary}/>
              <Text style={styles.label}>New Password</Text><TextInput style={styles.input} secureTextEntry value={newPassword} onChangeText={setNewPassword} placeholder="At least 6 characters" placeholderTextColor={COLORS.textSecondary}/>
              <Text style={styles.label}>Confirm New Password</Text><TextInput style={styles.input} secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Re-enter new password" placeholderTextColor={COLORS.textSecondary}/>
              <TouchableOpacity style={styles.primaryButton} onPress={handleChangePassword} disabled={savingPassword}>
                {savingPassword ? <ActivityIndicator color="#000" /> : <Text style={styles.primaryButtonText}>Update Password</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* MODAL 3: PAYMENT SETUP MODAL (MULTI-METHOD & QR) */}
        <Modal visible={showPaymentModal} transparent animationType="slide">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: COLORS.cardInactiveBg, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, borderWidth: 1.5, borderColor: COLORS.primary, maxHeight: '90%' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Text style={{ color: COLORS.text, fontSize: 18, fontWeight: '900' }}>Setup Payout Method</Text>
                <TouchableOpacity onPress={() => setShowPaymentModal(false)}><Feather name="x" size={24} color={COLORS.textSecondary} /></TouchableOpacity>
              </View>
              
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={{ color: COLORS.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 16 }}>
                  This is where SkillSwap sends your earnings once a project is completed and paid.
                </Text>
                <Text style={styles.label}>Select Payout Type</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                  {['GCash', 'Maya', 'Bank Transfer'].map((type) => (
                    <TouchableOpacity
                      key={type}
                      onPress={() => { setPaymentType(type); setPaymentQR(null); }}
                      style={[
                        styles.filterPill,
                        { marginRight: 10, paddingVertical: 12, paddingHorizontal: 20 },
                        paymentType === type && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }
                      ]}
                    >
                      <Text style={{ color: paymentType === type ? '#000' : COLORS.text, fontWeight: '800', fontSize: 13 }}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {paymentType === 'Bank Transfer' && (
                  <>
                    <Text style={styles.label}>Bank Name</Text>
                    <TextInput style={styles.input} placeholder="e.g. BDO, BPI, UnionBank" placeholderTextColor={COLORS.textSecondary} value={paymentBankName} onChangeText={setPaymentBankName} />
                  </>
                )}

                <Text style={styles.label}>Account Name</Text>
                <TextInput style={styles.input} placeholder="e.g. Juan Dela Cruz" placeholderTextColor={COLORS.textSecondary} value={paymentName} onChangeText={setPaymentName} />

                <Text style={styles.label}>{paymentType === 'Bank Transfer' ? 'Bank Account Number' : `${paymentType} Mobile Number`}</Text>
                <TextInput style={styles.input} placeholder={paymentType === 'Bank Transfer' ? "e.g. 001234567890" : "e.g. 09123456789"} placeholderTextColor={COLORS.textSecondary} keyboardType={paymentType === 'Bank Transfer' ? "default" : "phone-pad"} value={paymentNumber} onChangeText={setPaymentNumber} />

                {(paymentType === 'GCash' || paymentType === 'Maya') && (
                  <>
                    <Text style={styles.label}>Upload QR Code (Optional)</Text>
                    {paymentQR ? (
                      <View style={{ marginBottom: 20, alignItems: 'center' }}>
                        <Image source={{ uri: paymentQR }} style={{ width: 150, height: 150, borderRadius: 16, marginBottom: 10, borderWidth: 2, borderColor: COLORS.primary }} resizeMode="contain" />
                        <TouchableOpacity onPress={() => setPaymentQR(null)} style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Feather name="trash-2" size={14} color="#FF4C4C" />
                          <Text style={{ color: '#FF4C4C', fontSize: 12, fontWeight: '700', marginLeft: 6 }}>Remove QR Code</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity style={[styles.uploadBox, { padding: 20, marginBottom: 20 }]} onPress={handlePickQR}>
                        <Feather name="image" size={24} color={COLORS.primary} style={{ marginBottom: 8 }} />
                        <Text style={{ color: COLORS.primary, fontSize: 12, fontWeight: '800' }}>+ Upload {paymentType} QR Code</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}

                <TouchableOpacity style={styles.primaryButton} onPress={handleSavePayment}>
                  <Text style={styles.primaryButtonText}>Save Details</Text>
                </TouchableOpacity>
                <View style={{ height: 20 }} />
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* MODAL 4: FREELANCER SERVICE PORTFOLIO EDITOR */}
        <Modal visible={portfolioModalVisible} transparent animationType="slide">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 20 }}>
            <View style={{ backgroundColor: COLORS.cardInactiveBg, borderRadius: 24, padding: 20, borderWidth: 1.5, borderColor: COLORS.inputBorder, maxHeight: '90%' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}><Text style={{ color: COLORS.text, fontSize: 18, fontWeight: '900' }}>Edit Service Portfolios</Text><TouchableOpacity onPress={() => setPortfolioModalVisible(false)}><Feather name="x" size={24} color={COLORS.textSecondary} /></TouchableOpacity></View>
              {services.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 30 }}><Text style={{ color: COLORS.textSecondary, fontSize: 13, marginBottom: 15, textAlign: 'center' }}>You haven't created any services yet.</Text><TouchableOpacity style={styles.primaryButton} onPress={() => { setPortfolioModalVisible(false); navigation.navigate('CreateService'); }}><Text style={styles.primaryButtonText}>+ Create a Service</Text></TouchableOpacity></View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false}>
                  <Text style={styles.label}>Select Service to Edit:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 15 }}>
                    {services.map((srv) => (<TouchableOpacity key={srv.id} onPress={() => setSelectedServiceId(srv.id)} style={[ styles.filterPill, { marginRight: 8, paddingVertical: 10 }, selectedService?.id === srv.id && { backgroundColor: COLORS.primary, borderColor: COLORS.primary } ]}><Text style={{ color: selectedService?.id === srv.id ? '#000' : COLORS.text, fontWeight: '800', fontSize: 12 }}>{srv.title}</Text></TouchableOpacity>))}
                  </ScrollView>
                  {selectedService && (
                    <>
                      <Text style={styles.label}>Add Link (Drive, GitHub, Figma)</Text>
                      <View style={{ flexDirection: 'row', marginBottom: 12 }}><TextInput style={[styles.input, { flex: 1, marginBottom: 0, marginRight: 8, paddingVertical: 14 }]} placeholder="https://..." placeholderTextColor={COLORS.textSecondary} value={newSampleLink} onChangeText={setNewSampleLink} /><TouchableOpacity style={{ backgroundColor: COLORS.primary, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 16 }} onPress={handleAddPortfolioLink} disabled={savingPortfolio}><Text style={{ color: '#000', fontWeight: '900', fontSize: 12 }}>Add</Text></TouchableOpacity></View>
                      <TouchableOpacity style={[styles.uploadBox, { padding: 20, marginBottom: 20 }]} onPress={handleAddPortfolioPhoto} disabled={savingPortfolio}><Feather name="image" size={24} color={COLORS.primary} style={{ marginBottom: 8 }} /><Text style={{ color: COLORS.primary, fontSize: 12, fontWeight: '800' }}>+ Upload Photo</Text></TouchableOpacity>
                      <Text style={styles.label}>Current Items ({(selectedService.portfolio || []).length})</Text>
                      {(selectedService.portfolio || []).length > 0 ? (
                        selectedService.portfolio.map((item, idx) => {
                          const isImg = item.startsWith('data:image') || /^https?:\/\/.+\.(jpg|jpeg|png|webp|gif)/i.test(item);
                          return (
                            <View key={idx} style={{ backgroundColor: COLORS.inputBg, borderRadius: 16, padding: 12, marginBottom: 10, borderWidth: 1.5, borderColor: COLORS.inputBorder, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                {isImg ? <TouchableOpacity onPress={() => setPreviewImageUri(item)}><Image source={{ uri: item }} style={{ width: 50, height: 50, borderRadius: 10, marginRight: 12, borderWidth: 1, borderColor: COLORS.primary }} resizeMode="cover" /></TouchableOpacity> : <View style={{ width: 50, height: 50, borderRadius: 10, backgroundColor: 'rgba(0, 229, 136, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}><Feather name="link" size={20} color={COLORS.primary} /></View>}
                                <Text style={{ color: COLORS.text, fontSize: 13, flex: 1, marginRight: 10, fontWeight: '600' }} numberOfLines={1}>{isImg ? `Image #${idx + 1} (Tap to enlarge)` : item}</Text>
                              </View>
                              <TouchableOpacity onPress={() => handleRemovePortfolioSample(idx)} style={{ padding: 8 }}><Feather name="trash-2" size={18} color="#FF4C4C" /></TouchableOpacity>
                            </View>
                          );
                        })
                      ) : <Text style={{ color: COLORS.textSecondary, fontSize: 13, marginBottom: 15 }}>No items added.</Text>}
                    </>
                  )}
                  <TouchableOpacity style={[styles.primaryButton, { marginTop: 10 }]} onPress={() => { setPortfolioModalVisible(false); navigation.navigate('FreelancerPortfolio', { freelancerId: auth.currentUser.uid, freelancerName: displayName }); }}><Text style={styles.primaryButtonText}>View Public Portfolio Screen</Text></TouchableOpacity>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>

        {/* MODAL 5: HELP & SUPPORT */}
        <Modal visible={helpModalVisible} transparent animationType="fade">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 25 }}>
            <View style={{ backgroundColor: COLORS.cardInactiveBg, borderRadius: 24, padding: 24, borderWidth: 1.5, borderColor: COLORS.inputBorder }}>
              <Text style={{ color: COLORS.text, fontSize: 18, fontWeight: '900', marginBottom: 15 }}>SkillSwap Support</Text>
              <Text style={{ color: COLORS.textSecondary, fontSize: 14, lineHeight: 22, marginBottom: 20 }}>Need assistance?{'\n\n'}<Text style={{ color: COLORS.text, fontWeight: 'bold' }}>Email:</Text> support@skillswap.ph{'\n'}<Text style={{ color: COLORS.text, fontWeight: 'bold' }}>Hotline:</Text> +63 (063) 221-SKILL{'\n'}<Text style={{ color: COLORS.text, fontWeight: 'bold' }}>Location:</Text> Iligan City, Philippines</Text>
              <TouchableOpacity style={styles.primaryButton} onPress={() => setHelpModalVisible(false)}><Text style={styles.primaryButtonText}>Close</Text></TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Lightbox Modal */}
        <Modal visible={previewImageUri !== null} transparent animationType="fade">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <TouchableOpacity onPress={() => setPreviewImageUri(null)} style={{ position: 'absolute', top: 40, right: 25, zIndex: 10, backgroundColor: COLORS.inputBg, width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.primary }}><Feather name="x" size={24} color={COLORS.primary} /></TouchableOpacity>
            {previewImageUri && <Image source={{ uri: previewImageUri }} style={{ width: '100%', height: '80%', borderRadius: 16 }} resizeMode="contain" />}
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}