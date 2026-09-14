import React from 'react';
import { Text, View, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, styles } from '../styles';


export default function RegClientScreen({ navigation }) {
  return (
    <LinearGradient colors={[COLORS.bgTop, COLORS.bgBottom]} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.backBtn}>◀</Text></TouchableOpacity>
          <Text style={styles.headerTitle}>Client Sign Up</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={styles.scrollForm}>
          <TextInput style={styles.input} placeholder="Full Name" placeholderTextColor={COLORS.textSecondary} />
          <TextInput style={styles.input} placeholder="Email Address" placeholderTextColor={COLORS.textSecondary} />
          <TextInput style={styles.input} placeholder="Password" placeholderTextColor={COLORS.textSecondary} secureTextEntry />
          <TextInput style={styles.input} placeholder="City / Neighborhood" placeholderTextColor={COLORS.textSecondary} />
          <TextInput style={styles.input} placeholder="Company / Brand Name (Optional)" placeholderTextColor={COLORS.textSecondary} />
          
          <Text style={styles.label}>Upload Valid ID (For Trust & Safety)</Text>
          <TouchableOpacity style={styles.uploadBox}>
            <Text style={styles.uploadText}>↑ Tap to upload Image or PDF</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Create Client Account</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}