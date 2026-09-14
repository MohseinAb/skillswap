import React from 'react';
import { Text, View, TextInput, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, styles } from '../styles';

export default function RegFreelancerScreen({ navigation }) {
  return (
    <LinearGradient colors={[COLORS.bgTop, COLORS.bgBottom]} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.backBtn}>◀</Text></TouchableOpacity>
          <Text style={styles.headerTitle}>Freelancer Sign Up</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={styles.scrollForm}>
          <TextInput style={styles.input} placeholder="Full Name" placeholderTextColor={COLORS.textSecondary} />
          <TextInput style={styles.input} placeholder="Email Address" placeholderTextColor={COLORS.textSecondary} />
          <TextInput style={styles.input} placeholder="Password" placeholderTextColor={COLORS.textSecondary} secureTextEntry />
          <TextInput style={styles.input} placeholder="City / Neighborhood" placeholderTextColor={COLORS.textSecondary} />
          <TextInput style={styles.input} placeholder="Primary Skill Category" placeholderTextColor={COLORS.textSecondary} />
          
          <Text style={styles.label}>Upload Valid ID (For Verification)</Text>
          <TouchableOpacity style={styles.uploadBox}>
            <Text style={styles.uploadText}>↑ Tap to upload Image or PDF</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Create Freelancer Account</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}