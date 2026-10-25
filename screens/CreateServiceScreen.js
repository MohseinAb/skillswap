import React, { useState } from 'react';
import { 
  Text, View, TextInput, TouchableOpacity, ScrollView, 
  Switch, Alert, ActivityIndicator, Modal 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { COLORS, styles } from '../styles';

import { auth, db } from '../firebaseConfig';
import { collection, addDoc, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

const CATEGORIES = [
  'Web Development',
  'Mobile App Dev',
  'Systems Arch',
  'Graphic Design',
  'UI/UX Design',
  'Tutoring',
  'Photography',
  'Video Editing',
  'General Services'
];

export default function CreateServiceScreen({ navigation }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Web Development');
  const [price, setPrice] = useState('');
  const [rateType, setRateType] = useState('Hour'); // 'Hour' or 'Project'
  const [description, setDescription] = useState('');
  const [visible, setVisible] = useState(true);
  
  // Portfolio work samples
  const [portfolioItems, setPortfolioItems] = useState([]);
  const [sampleModalVisible, setSampleModalVisible] = useState(false);
  const [sampleInput, setSampleInput] = useState('');
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAddSample = () => {
    if (!sampleInput.trim()) return;
    if (portfolioItems.length >= 5) {
      Alert.alert('Limit Reached', 'You can upload up to 5 work samples.');
      return;
    }
    setPortfolioItems([...portfolioItems, sampleInput.trim()]);
    setSampleInput('');
    setSampleModalVisible(false);
  };

  const handleRemoveSample = (index) => {
    setPortfolioItems(portfolioItems.filter((_, i) => i !== index));
  };

  const handlePublish = async () => {
    if (!title.trim() || !price.trim() || !description.trim()) {
      Alert.alert('Missing Fields', 'Please fill in the service title, price, and description.');
      return;
    }

    if (!auth.currentUser) return;
    setLoading(true);

    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const userData = userDoc.exists() ? userDoc.data() : {};
      const freelancerName = userData.fullName || userData.name || auth.currentUser.email.split('@')[0];

      const numericPrice = parseFloat(price.replace(/[^0-9.]/g, '')) || 0;

      // 1. Add service to "services" collection
      await addDoc(collection(db, 'services'), {
        freelancerId: auth.currentUser.uid,
        freelancerName: freelancerName,
        title: title.trim(),
        category: category,
        price: numericPrice,
        rateType: rateType,
        description: description.trim(),
        portfolio: portfolioItems,
        visible: visible,
        activeBookings: 0,
        completedBookings: 0,
        createdAt: serverTimestamp()
      });

      // 2. Also sync primary service info to the freelancer's user profile for client search
      await setDoc(doc(db, 'users', auth.currentUser.uid), {
        serviceTitle: title.trim(),
        category: category,
        rate: numericPrice,
        price: numericPrice,
        rateType: rateType,
        bio: description.trim()
      }, { merge: true });

      Alert.alert('Success', 'Your service listing has been published!');
      navigation.goBack();
    } catch (error) {
      console.error('Error publishing service:', error);
      Alert.alert('Error', 'Failed to publish listing. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={[COLORS.bgTop, COLORS.bgBottom]} style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        
        {/* Curved Header matching Figma */}
        <View style={[styles.chatHeaderBg, { paddingVertical: 18, marginBottom: 10 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 5 }}>
            <Feather name="chevron-left" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={{ color: COLORS.text, fontSize: 16, fontWeight: 'bold' }}>Create Listing</Text>
          <View style={{ width: 34 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}>
          
          <Text style={styles.label}>Service Title</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Full-Stack Django Development"
            placeholderTextColor={COLORS.textSecondary}
            value={title}
            onChangeText={setTitle}
          />

          <Text style={styles.label}>Category</Text>
          <TouchableOpacity 
            style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
            onPress={() => setCategoryModalVisible(true)}
          >
            <Text style={{ color: COLORS.text, fontSize: 14 }}>{category}</Text>
            <Feather name="chevron-down" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <Text style={styles.label}>Pricing Rate (₱)</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
            <View style={[styles.input, { flex: 1, marginBottom: 0, marginRight: 10, flexDirection: 'row', alignItems: 'center', paddingVertical: 0 }]}>
              <Text style={{ color: COLORS.text, fontWeight: 'bold', marginRight: 8 }}>₱</Text>
              <TextInput
                style={{ flex: 1, color: COLORS.text, fontSize: 14, paddingVertical: 18 }}
                placeholder="500"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="numeric"
                value={price}
                onChangeText={setPrice}
              />
            </View>

            <TouchableOpacity 
              style={[styles.input, { width: 120, marginBottom: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
              onPress={() => setRateType(rateType === 'Hour' ? 'Project' : 'Hour')}
            >
              <Text style={{ color: COLORS.text, fontSize: 13 }}>/ {rateType}</Text>
              <Feather name="repeat" size={14} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Project Description</Text>
          <TextInput
            style={[styles.input, { height: 110, textAlignVertical: 'top' }]}
            placeholder="Describe what clients get when they book this service. Include any requirements..."
            placeholderTextColor={COLORS.textSecondary}
            multiline
            value={description}
            onChangeText={setDescription}
          />

          <Text style={styles.label}>Portfolio Images / Work Samples</Text>
          <TouchableOpacity 
            style={[styles.uploadBox, { marginBottom: 15 }]}
            onPress={() => setSampleModalVisible(true)}
          >
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(132, 220, 198, 0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 8 }}>
              <Feather name="plus" size={18} color={COLORS.primary} />
            </View>
            <Text style={styles.uploadText}>Tap to add up to 5 work samples ({portfolioItems.length}/5)</Text>
          </TouchableOpacity>

          {portfolioItems.map((item, idx) => (
            <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.cardInactiveBg, padding: 12, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: COLORS.inputBorder }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Feather name="Briefcase" size={14} color={COLORS.primary} />
                <Text style={{ color: COLORS.text, fontSize: 12, marginLeft: 8 }} numberOfLines={1}>{item}</Text>
              </View>
              <TouchableOpacity onPress={() => handleRemoveSample(idx)}>
                <Feather name="x" size={16} color="#FF4C4C" />
              </TouchableOpacity>
            </View>
          ))}

          <View style={[styles.serviceCard, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }]}>
            <View>
              <Text style={{ color: COLORS.text, fontWeight: 'bold', fontSize: 13 }}>Available for Booking Now</Text>
              <Text style={{ color: COLORS.textSecondary, fontSize: 11, marginTop: 2 }}>Clients can immediately see & book this service</Text>
            </View>
            <Switch
              value={visible}
              onValueChange={setVisible}
              trackColor={{ false: COLORS.inputBg, true: 'rgba(132, 220, 198, 0.3)' }}
              thumbColor={visible ? COLORS.primary : COLORS.textSecondary}
            />
          </View>

          <TouchableOpacity 
            style={[styles.primaryButton, { marginTop: 15 }]} 
            onPress={handlePublish}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.primaryButtonText}>Publish Listing</Text>
            )}
          </TouchableOpacity>

        </ScrollView>

        {/* Category Picker Modal */}
        <Modal visible={categoryModalVisible} transparent animationType="fade">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 25 }}>
            <View style={{ backgroundColor: COLORS.cardInactiveBg, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: COLORS.inputBorder }}>
              <Text style={{ color: COLORS.text, fontWeight: 'bold', fontSize: 16, marginBottom: 15 }}>Select Category</Text>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.inputBorder, flexDirection: 'row', justifyContent: 'space-between' }}
                  onPress={() => { setCategory(cat); setCategoryModalVisible(false); }}
                >
                  <Text style={{ color: category === cat ? COLORS.primary : COLORS.text, fontSize: 14 }}>{cat}</Text>
                  {category === cat && <Feather name="check" size={16} color={COLORS.primary} />}
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={{ marginTop: 15, alignItems: 'center' }} onPress={() => setCategoryModalVisible(false)}>
                <Text style={{ color: COLORS.textSecondary }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Portfolio Sample Modal */}
        <Modal visible={sampleModalVisible} transparent animationType="fade">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 25 }}>
            <View style={{ backgroundColor: COLORS.cardInactiveBg, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: COLORS.inputBorder }}>
              <Text style={{ color: COLORS.text, fontWeight: 'bold', fontSize: 16, marginBottom: 8 }}>Add Work Sample</Text>
              <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 15 }}>Enter a project title, link, or work sample description:</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. E-Commerce Web App / github.com/my-work"
                placeholderTextColor={COLORS.textSecondary}
                value={sampleInput}
                onChangeText={setSampleInput}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <TouchableOpacity style={[styles.declineBtn, { marginTop: 0 }]} onPress={() => setSampleModalVisible(false)}>
                  <Text style={styles.declineBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.acceptBtn, { marginTop: 0 }]} onPress={handleAddSample}>
                  <Text style={styles.acceptBtnText}>Add Sample</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

      </SafeAreaView>
    </LinearGradient>
  );
}