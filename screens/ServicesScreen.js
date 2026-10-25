import React, { useState, useEffect } from 'react';
import { Text, View, TouchableOpacity, ScrollView, Switch, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { COLORS, styles } from '../styles';

import { auth, db } from '../firebaseConfig';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';

export default function ServicesScreen({ navigation }) {
  const [services, setServices] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    // 1. Listen to freelancer's services
    const qServices = query(collection(db, "services"), where("freelancerId", "==", auth.currentUser.uid));
    const unsubServices = onSnapshot(qServices, (snapshot) => {
      const loadedServices = [];
      snapshot.forEach((doc) => {
        loadedServices.push({ id: doc.id, ...doc.data() });
      });
      setServices(loadedServices);
      setLoading(false);
    });

    // 2. Listen to freelancer's bookings to calculate live counts per service
    const qBookings = query(collection(db, "bookings"), where("freelancerId", "==", auth.currentUser.uid));
    const unsubBookings = onSnapshot(qBookings, (snapshot) => {
      const loadedBookings = [];
      snapshot.forEach((doc) => {
        loadedBookings.push({ id: doc.id, ...doc.data() });
      });
      setBookings(loadedBookings);
    });

    return () => {
      unsubServices();
      unsubBookings();
    };
  }, []);

  const toggleVisibility = async (serviceId, currentStatus) => {
    try {
      const serviceRef = doc(db, "services", serviceId);
      await updateDoc(serviceRef, { visible: !currentStatus });
    } catch (error) {
      console.error("Error toggling visibility:", error);
    }
  };

  // Helper to match bookings to a specific service
  const getServiceStats = (service) => {
    const matched = bookings.filter(b => 
      b.serviceId === service.id || 
      (b.serviceTitle && b.serviceTitle.toLowerCase() === service.title?.toLowerCase()) ||
      (b.projectTitle && b.projectTitle.toLowerCase() === service.title?.toLowerCase()) ||
      (b.category && b.category.toLowerCase() === service.category?.toLowerCase())
    );
    const active = matched.filter(b => ['active', 'accepted'].includes((b.status || '').toLowerCase())).length;
    const pending = matched.filter(b => (b.status || 'pending').toLowerCase() === 'pending').length;
    const completed = matched.filter(b => (b.status || '').toLowerCase() === 'completed').length;
    return { active, pending, completed };
  };

  return (
    <LinearGradient colors={[COLORS.bgTop, COLORS.bgBottom]} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>My Services</Text>
          <TouchableOpacity 
            style={[styles.headerIconBtn, { backgroundColor: COLORS.primary, borderColor: COLORS.primary, borderRadius: 12, width: 42, height: 34 }]}
            onPress={() => navigation.navigate('CreateService')}
          >
            <Feather name="plus" size={20} color="#000" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} />
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
            {services.length > 0 ? (
              services.map((service) => {
                const stats = getServiceStats(service);
                return (
                  <TouchableOpacity 
                    key={service.id} 
                    style={[styles.serviceCard, !service.visible && { opacity: 0.6, borderStyle: 'dashed' }]}
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate('ServiceBookings', { service })}
                  >
                    <View style={styles.serviceTopRow}>
                      <View style={styles.serviceTitleRow}>
                        <Text style={styles.serviceTitle}>{service.title}</Text>
                        <Text style={styles.serviceCategory}>Category: {service.category}</Text>
                      </View>
                      <View style={styles.servicePriceRight}>
                        <Text style={styles.servicePriceText}>₱ {service.price}</Text>
                        <Text style={styles.serviceRateType}>/ {service.rateType || 'Project'}</Text>
                      </View>
                    </View>

                    <View style={styles.serviceStatsRow}>
                      <View style={styles.serviceStatCol}>
                        <View style={styles.statLine}>
                          <View style={styles.statDot} />
                          <Text style={styles.statText}>
                            {stats.active} Active Bookings {stats.pending > 0 ? `(${stats.pending} New Request)` : ''}
                          </Text>
                        </View>
                        <View style={styles.statLine}>
                          <View style={[styles.statDotCompleted, { backgroundColor: COLORS.primary }]} />
                          <Text style={styles.statText}>{stats.completed} Completed</Text>
                        </View>
                      </View>
                      
                      <View style={styles.visibilityToggle}>
                        <Text style={styles.visibilityText}>{service.visible ? 'Visible' : 'Hidden'}</Text>
                        <Switch 
                          value={service.visible} 
                          onValueChange={() => toggleVisibility(service.id, service.visible)} 
                          trackColor={{ false: COLORS.inputBg, true: 'rgba(132, 220, 198, 0.3)' }}
                          thumbColor={service.visible ? COLORS.primary : COLORS.textSecondary}
                        />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={{ alignItems: 'center', marginTop: 80 }}>
                <Feather name="briefcase" size={40} color={COLORS.inputBorder} style={{ marginBottom: 15 }} />
                <Text style={styles.subtitle}>You haven't listed any services yet.</Text>
                <TouchableOpacity 
                  style={[styles.primaryButton, { width: 220, marginTop: 0 }]}
                  onPress={() => navigation.navigate('CreateService')}
                >
                  <Text style={styles.primaryButtonText}>+ Create First Service</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}