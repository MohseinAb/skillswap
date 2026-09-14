import React, { useState } from 'react';
import { Text, View, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { Feather } from '@expo/vector-icons'; // <-- Added Vector Icons
import { COLORS, styles } from '../styles';

// Updated SVG: Y coordinates moved up slightly to avoid cards, X coordinate extended to 3000 for web width
const BackgroundGraphic = () => (
  <View style={StyleSheet.absoluteFill}>
    <Svg height="100%" width="100%">
      <Path 
        d="M 0 100 L 120 100 L 140 120 L 3000 120" 
        stroke="rgba(132, 220, 198, 0.15)" 
        strokeWidth="1.5" 
        fill="none" 
      />
    </Svg>
  </View>
);

export default function AccountTypeScreen({ navigation }) {
  const [accountType, setAccountType] = useState('freelancer');

  const handleContinue = () => {
    navigation.navigate(accountType === 'freelancer' ? 'RegFreelancer' : 'RegClient');
  };

  return (
    <LinearGradient colors={[COLORS.bgTop, COLORS.bgBottom]} style={styles.container}>
      <BackgroundGraphic />
      
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.formContainer}>
          <Text style={styles.headerText}>Join SkillSwap</Text>
          <Text style={styles.subtitle}>How would you like to use the platform?</Text>

          {/* Freelancer Card */}
          <TouchableOpacity 
            style={[styles.typeCard, accountType === 'freelancer' ? styles.typeCardActive : styles.typeCardInactive]} 
            onPress={() => setAccountType('freelancer')}
          >
            {/* Added Hammer Icon */}
            <View style={[styles.iconPlaceholder, { justifyContent: 'center', alignItems: 'center' }]}>
               <Feather name="tool" size={20} color={COLORS.primary} />
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.typeTitle}>I'm a Freelancer</Text>
              <Text style={styles.typeDesc}>I want to offer my services and find local clients.</Text>
            </View>
            <View style={[styles.radio, accountType === 'freelancer' && styles.radioActive]} />
          </TouchableOpacity>

          {/* Client Card */}
          <TouchableOpacity 
            style={[styles.typeCard, accountType === 'client' ? styles.typeCardActive : styles.typeCardInactive]} 
            onPress={() => setAccountType('client')}
          >
            {/* Added Briefcase Icon */}
            <View style={[styles.iconPlaceholder, { justifyContent: 'center', alignItems: 'center' }]}>
               <Feather name="briefcase" size={20} color={COLORS.primary} />
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.typeTitle}>I'm a Client</Text>
              <Text style={styles.typeDesc}>I need to hire local talent for my projects.</Text>
            </View>
            <View style={[styles.radio, accountType === 'client' && styles.radioActive]} />
          </TouchableOpacity>

          <View style={{ flex: 1 }} />

          <TouchableOpacity style={styles.primaryButton} onPress={handleContinue}>
            <Text style={styles.primaryButtonText}>Continue</Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.linkText}>Already have an account? Log In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}