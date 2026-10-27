import React, { useState, useEffect } from 'react';
import { 
  Text, View, TextInput, TouchableOpacity, ScrollView, 
  ActivityIndicator, Alert, Modal, Image 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, FontAwesome } from '@expo/vector-icons';
import { COLORS, styles } from '../styles';
import { startNegotiation } from '../services/bookingFlow';
import { notify } from '../services/notify';

import { auth, db } from '../firebaseConfig';
import { 
  collection, query, where, onSnapshot, addDoc, 
  getDocs, doc, getDoc, serverTimestamp 
} from 'firebase/firestore';

const CATEGORIES = [
  'All',
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

const LOCATIONS = [
  'All',
  'Uptown, Iligan City',
  'Market Area, Iligan',
  'Tibanga, Iligan',
  'Poblacion, Iligan',
  'Remote / Online'
];

const PRICE_FILTERS = [
  { label: 'All Prices', value: 'ALL' },
  { label: 'Under ₱500', value: 'UNDER_500' },
  { label: '₱500 – ₱2,000', value: '500_2000' },
  { label: 'Above ₱2,000', value: 'ABOVE_2000' },
  { label: 'Price: Low to High', value: 'LOW_HIGH' },
  { label: 'Price: High to Low', value: 'HIGH_LOW' }
];

export default function SearchScreen({ navigation }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedLocation, setSelectedLocation] = useState('All');
  const [selectedPrice, setSelectedPrice] = useState(PRICE_FILTERS[0]);

  // Modal visibility states
  const [activeFilterModal, setActiveFilterModal] = useState(null);
  const [bookingLoadingId, setBookingLoadingId] = useState(null);

  useEffect(() => {
    let servicesData = [];
    let freelancersMap = {};

    const qUsers = query(collection(db, 'users'));
    const unsubUsers = onSnapshot(qUsers, (userSnap) => {
      const usersList = [];
      freelancersMap = {};

      userSnap.forEach((docSnap) => {
        const data = docSnap.data();
        const role = (data.role || data.accountType || '').toLowerCase();
        if (role === 'freelancer') {
          freelancersMap[docSnap.id] = { id: docSnap.id, ...data };
          usersList.push({ id: docSnap.id, ...data });
        }
      });

      mergeAndSetListings(servicesData, usersList, freelancersMap);
    });

    const qServices = query(collection(db, 'services'));
    const unsubServices = onSnapshot(qServices, (serviceSnap) => {
      servicesData = [];
      serviceSnap.forEach((docSnap) => {
        const sData = docSnap.data();
        if (sData.visible !== false) {
          servicesData.push({ id: docSnap.id, ...sData });
        }
      });

      const usersList = Object.values(freelancersMap);
      mergeAndSetListings(servicesData, usersList, freelancersMap);
      setLoading(false);
    });

    return () => {
      unsubUsers();
      unsubServices();
    };
  }, []);

  const mergeAndSetListings = (servicesData, usersList, freelancersMap) => {
    const combined = [];
    const freelancersWithServices = new Set();

    servicesData.forEach((service) => {
      const owner = freelancersMap[service.freelancerId] || {};
      freelancersWithServices.add(service.freelancerId);

      combined.push({
        id: service.id,
        serviceId: service.id,
        freelancerId: service.freelancerId,
        freelancerName: service.freelancerName || owner.fullName || owner.name || 'Freelancer',
        title: service.title || 'Freelance Service',
        category: service.category || owner.category || 'General Services',
        location: service.location || owner.location || owner.address || 'Iligan City',
        price: parseFloat(service.price || owner.rate || owner.price || 500),
        rateType: service.rateType || owner.rateType || 'hr',
        rating: owner.rating || service.rating || 5.0,
        reviewCount: owner.reviewCount || 0,
        avatar: owner.profileImage || owner.avatar || null,
        description: service.description || owner.bio || ''
      });
    });

    usersList.forEach((user) => {
      if (!freelancersWithServices.has(user.id)) {
        combined.push({
          id: `user_${user.id}`,
          serviceId: null,
          freelancerId: user.id,
          freelancerName: user.fullName || user.name || user.email?.split('@')[0] || 'Freelancer',
          title: user.serviceTitle || user.skills || user.category || 'Freelancer',
          category: user.category || user.skills || 'General Services',
          location: user.location || user.address || 'Iligan City',
          price: parseFloat(user.rate || user.price || 350),
          rateType: user.rateType || 'hr',
          rating: user.rating || 5.0,
          reviewCount: user.reviewCount || 0,
          avatar: user.profileImage || user.avatar || null,
          description: user.bio || ''
        });
      }
    });

    setListings(combined);
    setLoading(false);
  };

  const getFilteredListings = () => {
    let result = listings.filter((item) => {
      if (auth.currentUser && item.freelancerId === auth.currentUser.uid) return false;

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.freelancerName.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.location.toLowerCase().includes(q);

      const matchesCategory =
        selectedCategory === 'All' ||
        item.category.toLowerCase().includes(selectedCategory.toLowerCase()) ||
        item.title.toLowerCase().includes(selectedCategory.toLowerCase());

      const matchesLocation =
        selectedLocation === 'All' ||
        item.location.toLowerCase().includes(selectedLocation.split(',')[0].toLowerCase());

      let matchesPrice = true;
      if (selectedPrice.value === 'UNDER_500') matchesPrice = item.price < 500;
      else if (selectedPrice.value === '500_2000') matchesPrice = item.price >= 500 && item.price <= 2000;
      else if (selectedPrice.value === 'ABOVE_2000') matchesPrice = item.price > 2000;

      return matchesSearch && matchesCategory && matchesLocation && matchesPrice;
    });

    if (selectedPrice.value === 'LOW_HIGH') {
      result.sort((a, b) => a.price - b.price);
    } else if (selectedPrice.value === 'HIGH_LOW') {
      result.sort((a, b) => b.price - a.price);
    }

    return result;
  };

  // Booking now opens a chat: the client and freelancer agree on scope and price there,
  // then the freelancer sends a custom offer (see services/bookingFlow.js).
  const handleBookService = async (item) => {
    if (!auth.currentUser) {
      notify('Login required', 'Please log in to book a service.');
      return;
    }

    setBookingLoadingId(item.id);
    try {
      const { chatId } = await startNegotiation({
        serviceId: item.serviceId || item.id,
        serviceTitle: item.title,
        category: item.category,
        price: item.price,
        rateType: item.rateType,
        location: item.location,
        freelancerId: item.freelancerId,
        freelancerName: item.freelancerName,
      });
      navigation.navigate('Chat', { chatId, otherUserName: item.freelancerName });
    } catch (error) {
      console.error('Error booking service:', error);
      notify('Could not start the booking', error.message || 'Please try again.');
    } finally {
      setBookingLoadingId(null);
    }
  };

  const filteredListings = getFilteredListings();

  return (
    <LinearGradient colors={[COLORS.bgTop, COLORS.bgBottom]} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        
        {/* Top Centered Brand Header */}
        <View style={styles.searchHeaderRow}>
          <Text style={{ color: COLORS.text, fontSize: 16, fontWeight: 'bold', letterSpacing: 2 }}>
            SKILLSWAP
          </Text>
          <TouchableOpacity 
            style={styles.searchProfileIcon}
            onPress={() => navigation.navigate('Profile')}
          >
            <Feather name="user" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* Search Input Bar */}
        <View style={styles.searchContainer}>
          <Feather name="search" size={18} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search Freelancers or Skills..."
            placeholderTextColor={COLORS.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Feather name="x" size={16} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* 3 Filter Pills */}
        <View style={styles.filterRow}>
          <TouchableOpacity 
            style={[styles.filterPill, selectedCategory !== 'All' && { borderColor: COLORS.primary }]}
            onPress={() => setActiveFilterModal('category')}
          >
            <Text style={[styles.filterText, selectedCategory !== 'All' && { color: COLORS.primary }]} numberOfLines={1}>
              {selectedCategory === 'All' ? 'Category' : selectedCategory}
            </Text>
            <Feather name="chevron-down" size={12} color={selectedCategory !== 'All' ? COLORS.primary : COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.filterPill, selectedLocation !== 'All' && { borderColor: COLORS.primary }]}
            onPress={() => setActiveFilterModal('location')}
          >
            <Text style={[styles.filterText, selectedLocation !== 'All' && { color: COLORS.primary }]} numberOfLines={1}>
              {selectedLocation === 'All' ? 'Location' : selectedLocation.split(',')[0]}
            </Text>
            <Feather name="chevron-down" size={12} color={selectedLocation !== 'All' ? COLORS.primary : COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.filterPill, selectedPrice.value !== 'ALL' && { borderColor: COLORS.primary }]}
            onPress={() => setActiveFilterModal('price')}
          >
            <Text style={[styles.filterText, selectedPrice.value !== 'ALL' && { color: COLORS.primary }]} numberOfLines={1}>
              {selectedPrice.value === 'ALL' ? 'Price' : selectedPrice.label}
            </Text>
            <Feather name="chevron-down" size={12} color={selectedPrice.value !== 'ALL' ? COLORS.primary : COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Freelancer / Service Cards List */}
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} />
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
            {filteredListings.length > 0 ? (
              filteredListings.map((item) => (
                <View key={item.id} style={styles.freelancerCard}>
                  
                  {/* Tapping the Freelancer's Profile/Name opens their Categorized Portfolio */}
                  <TouchableOpacity 
                    style={styles.fcTopRow}
                    activeOpacity={0.75}
                    onPress={() => navigation.navigate('FreelancerPortfolio', { 
                      freelancerId: item.freelancerId, 
                      freelancerName: item.freelancerName 
                    })}
                  >
                    <View style={styles.fcLeftInfo}>
                      <View style={[styles.fcAvatar, { borderWidth: 1, borderColor: COLORS.primary }]}>
                        {item.avatar ? (
                          <Image source={{ uri: item.avatar }} style={{ width: 45, height: 45, borderRadius: 22.5 }} />
                        ) : (
                          <Feather name="user" size={22} color={COLORS.primary} />
                        )}
                      </View>
                      <View style={styles.fcNameRole}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={[styles.fcName, { textDecorationLine: 'underline' }]}>
                            {item.freelancerName}
                          </Text>
                          <Feather name="external-link" size={12} color={COLORS.primary} style={{ marginLeft: 6 }} />
                        </View>
                        <Text style={styles.fcRole}>{item.title} • {item.category}</Text>
                        <View style={styles.fcLocationRow}>
                          <Feather name="map-pin" size={10} color={COLORS.primary} />
                          <Text style={styles.fcLocationText}>{item.location}</Text>
                        </View>
                        <Text style={{ color: COLORS.primary, fontSize: 10, marginTop: 4 }}>
                          Tap profile to view portfolio & services →
                        </Text>
                      </View>
                    </View>

                    <View style={styles.fcRightInfo}>
                      <View style={styles.fcRatingRow}>
                        <FontAwesome name="star" size={14} color={COLORS.primary} />
                        <Text style={styles.fcRatingText}>
                          {Number(item.rating || 5.0).toFixed(1)}
                        </Text>
                      </View>
                      <Text style={styles.fcPrice}>
                        ₱{item.price}/{item.rateType?.toLowerCase() === 'project' ? 'project' : 'hr'}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.bookBtn}
                    onPress={() => handleBookService(item)}
                    disabled={bookingLoadingId === item.id}
                  >
                    {bookingLoadingId === item.id ? (
                      <ActivityIndicator color="#000" size="small" />
                    ) : (
                      <Text style={styles.bookBtnText}>Book now and chat</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ))
            ) : (
              <View style={{ alignItems: 'center', marginTop: 60 }}>
                <Feather name="search" size={40} color={COLORS.inputBorder} style={{ marginBottom: 12 }} />
                <Text style={styles.subtitle}>No matching freelancers or services found.</Text>
                <TouchableOpacity 
                  onPress={() => {
                    setSearchQuery('');
                    setSelectedCategory('All');
                    setSelectedLocation('All');
                    setSelectedPrice(PRICE_FILTERS[0]);
                  }}
                >
                  <Text style={{ color: COLORS.primary, fontSize: 13, fontWeight: 'bold' }}>Reset All Filters</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        )}

        {/* Filter Selection Modal */}
        <Modal visible={activeFilterModal !== null} transparent animationType="fade">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 25 }}>
            <View style={{ backgroundColor: COLORS.cardInactiveBg, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: COLORS.inputBorder }}>
              
              {activeFilterModal === 'category' && (
                <>
                  <Text style={{ color: COLORS.text, fontWeight: 'bold', fontSize: 16, marginBottom: 15 }}>Filter by Category</Text>
                  {CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={{ paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: COLORS.inputBorder, flexDirection: 'row', justifyContent: 'space-between' }}
                      onPress={() => { setSelectedCategory(cat); setActiveFilterModal(null); }}
                    >
                      <Text style={{ color: selectedCategory === cat ? COLORS.primary : COLORS.text, fontSize: 14 }}>{cat}</Text>
                      {selectedCategory === cat && <Feather name="check" size={16} color={COLORS.primary} />}
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {activeFilterModal === 'location' && (
                <>
                  <Text style={{ color: COLORS.text, fontWeight: 'bold', fontSize: 16, marginBottom: 15 }}>Filter by Location</Text>
                  {LOCATIONS.map((loc) => (
                    <TouchableOpacity
                      key={loc}
                      style={{ paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: COLORS.inputBorder, flexDirection: 'row', justifyContent: 'space-between' }}
                      onPress={() => { setSelectedLocation(loc); setActiveFilterModal(null); }}
                    >
                      <Text style={{ color: selectedLocation === loc ? COLORS.primary : COLORS.text, fontSize: 14 }}>{loc}</Text>
                      {selectedLocation === loc && <Feather name="check" size={16} color={COLORS.primary} />}
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {activeFilterModal === 'price' && (
                <>
                  <Text style={{ color: COLORS.text, fontWeight: 'bold', fontSize: 16, marginBottom: 15 }}>Filter by Price</Text>
                  {PRICE_FILTERS.map((p) => (
                    <TouchableOpacity
                      key={p.value}
                      style={{ paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: COLORS.inputBorder, flexDirection: 'row', justifyContent: 'space-between' }}
                      onPress={() => { setSelectedPrice(p); setActiveFilterModal(null); }}
                    >
                      <Text style={{ color: selectedPrice.value === p.value ? COLORS.primary : COLORS.text, fontSize: 14 }}>{p.label}</Text>
                      {selectedPrice.value === p.value && <Feather name="check" size={16} color={COLORS.primary} />}
                    </TouchableOpacity>
                  ))}
                </>
              )}

              <TouchableOpacity style={{ marginTop: 15, alignItems: 'center' }} onPress={() => setActiveFilterModal(null)}>
                <Text style={{ color: COLORS.textSecondary }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

      </SafeAreaView>
    </LinearGradient>
  );
}