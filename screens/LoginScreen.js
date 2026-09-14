import React from 'react';
import { Text, View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { COLORS, styles } from '../styles';

// The background graphic from the design
const BackgroundGraphic = () => (
  <View style={StyleSheet.absoluteFill}>
    <Svg height="100%" width="100%">
      {/* This draws the angled tech line across the top */}
      <Path 
        d="M 0 160 L 120 160 L 140 180 L 500 180" 
        stroke="rgba(132, 220, 198, 0.15)" 
        strokeWidth="1.5" 
        fill="none" 
      />
    </Svg>
  </View>
);

export default function LoginScreen({ navigation }) {
  return (
    <LinearGradient colors={[COLORS.bgTop, COLORS.bgBottom]} style={styles.container}>
      <BackgroundGraphic />
      
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.formContainer}>
          <Text style={styles.subtitle}>Authenticate to continue</Text>
          
          <TextInput style={styles.input} placeholder="Email Address" placeholderTextColor={COLORS.textSecondary} />
          <TextInput style={styles.input} placeholder="Password" placeholderTextColor={COLORS.textSecondary} secureTextEntry />
          <Text style={styles.forgotPassword}>Forgot Password?</Text>

          <TouchableOpacity style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Log In</Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => navigation.navigate('AccountType')}>
            <Text style={styles.linkText}>New user? Create Account</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}