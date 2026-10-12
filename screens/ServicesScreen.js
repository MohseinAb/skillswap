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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(collection(db, "services"), where("freelancerId", "==", auth.currentUser.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedServices = [];
      snapshot.forEach((doc) => {
        loadedServices.push({ id: doc.id, ...doc.data() });
      });
      setServices(loadedServices);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const toggleVisibility = async (serviceId, currentStatus) => {
    try {
      const serviceRef = doc(db, "services", serviceId);
      await updateDoc(serviceRef, { visible: !currentStatus });
    } catch (error) {
      console.error("Error toggling visibility:", error);
    }
  };

  return (
    <LinearGradient colors={[COLORS.bgTop, COLORS.bgBottom]} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>My Services</Text>
          <TouchableOpacity style={[styles.headerIconBtn, { borderColor: COLORS.primary, backgroundColor: 'rgba(132, 220, 198, 0.1)' }]}>
            <Feather name="plus" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} />
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            {services.length > 0 ? (
              services.map((service) => (
                <View key={service.id} style={styles.serviceCard}>
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
                        <Text style={styles.statText}>{service.activeBookings || 0} Active Booking</Text>
                      </View>
                      <View style={styles.statLine}>
                        <View style={styles.statDotCompleted} />
                        <Text style={styles.statText}>{service.completedBookings || 0} Completed</Text>
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
                </View>
              ))
            ) : (
              <View style={{ alignItems: 'center', marginTop: 50 }}>
                <Feather name="briefcase" size={40} color={COLORS.inputBorder} style={{ marginBottom: 15 }} />
                <Text style={styles.subtitle}>You haven't listed any services yet.</Text>
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}