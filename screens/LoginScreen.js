import React, { useState } from 'react';
import { Text, View, TextInput, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { COLORS, styles } from '../styles';

// Firebase Imports
import { auth, db } from '../firebaseConfig';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

const BackgroundGraphic = () => (
  <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
    <Svg height="100%" width="100%">
      <Path d="M 0 160 L 120 160 L 140 180 L 3000 180" stroke="rgba(132, 220, 198, 0.15)" strokeWidth="1.5" fill="none" />
    </Svg>
  </View>
);

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter both email and password.");
      return;
    }

    try {
      // 1. Log the user in via Authentication
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // 2. Fetch their user document from Firestore to check their role
      const docSnap = await getDoc(doc(db, "users", user.uid));
      
      if (docSnap.exists()) {
        const userData = docSnap.data();
        
        // 3. Route them to the correct tab navigator based on role
        if (userData.role === 'freelancer') {
          navigation.navigate('FreelancerTabs');
        } else {
          navigation.navigate('ClientTabs');
        }
      } else {
        Alert.alert("Error", "User data not found in database.");
      }
      
    } catch (error) {
      console.error("Login Error:", error);
      Alert.alert("Login Failed", "Invalid email or password.");
    }
  };

  return (
    <LinearGradient colors={[COLORS.bgTop, COLORS.bgBottom]} style={styles.container}>
      <BackgroundGraphic />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.formContainer}>
          <Text style={styles.subtitle}>Authenticate to continue</Text>
          
          <TextInput 
            style={styles.input} 
            placeholder="Email Address" 
            placeholderTextColor={COLORS.textSecondary} 
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput 
            style={styles.input} 
            placeholder="Password" 
            placeholderTextColor={COLORS.textSecondary} 
            secureTextEntry 
            value={password}
            onChangeText={setPassword}
          />
          <Text style={styles.forgotPassword}>Forgot Password?</Text>

          <TouchableOpacity style={styles.primaryButton} onPress={handleLogin}>
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