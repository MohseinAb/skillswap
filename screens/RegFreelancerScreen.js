import React, { useState } from 'react';
import { Text, View, TextInput, TouchableOpacity, ScrollView, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, styles } from '../styles';

import { auth, db } from '../firebaseConfig';
import { createUserWithEmailAndPassword, sendEmailVerification, signOut } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { notify } from '../services/notify';
import { completeRegistration } from '../services/session';

export default function RegFreelancerScreen({ navigation }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [city, setCity] = useState('');
  const [skill, setSkill] = useState('');
  const [idImageBase64, setIdImageBase64] = useState(null);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.3, 
      base64: true,
    });

    if (!result.canceled) {
      setIdImageBase64(result.assets[0].base64);
    }
  };

  const handleRegister = async () => {
    if (!email || !password || !fullName || !city || !skill) {
      Alert.alert("Error", "Please fill out all required fields.");
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        fullName: fullName,
        email: email,
        city: city,
        primarySkill: skill,
        idImage: idImageBase64, 
        role: "freelancer",
        createdAt: new Date(),
        emailVerificationRequired: true,
      });

      // The account exists, but it can only be used once the emailed link has been opened.
      const { emailSent } = await completeRegistration({
        user,
        sendVerification: sendEmailVerification,
        signOutUser: () => signOut(auth),
      });
      notify(
        emailSent ? 'Check your email' : 'Account created',
        emailSent
          ? `We sent a verification link to ${email}. Open it, then log in. Check your spam folder if you do not see it.`
          : 'Your account was created, but the verification email could not be sent. Try to log in and choose "Send again".'
      );
      navigation.navigate('Login');

    } catch (error) {
      console.error("Registration Error:", error);
      alert("Registration Failed: " + error.message);
    }
  };

  return (
    <LinearGradient colors={[COLORS.bgTop, COLORS.bgBottom]} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backBtn}>◀</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Freelancer Sign Up</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={styles.scrollForm}>
          
          <TextInput style={styles.input} placeholder="Full Name" placeholderTextColor={COLORS.textSecondary} value={fullName} onChangeText={setFullName} />
          <TextInput style={styles.input} placeholder="Email Address" placeholderTextColor={COLORS.textSecondary} value={email} onChangeText={setEmail} autoCapitalize="none" />
          <TextInput style={styles.input} placeholder="Password" placeholderTextColor={COLORS.textSecondary} secureTextEntry value={password} onChangeText={setPassword} />
          <TextInput style={styles.input} placeholder="City / Neighborhood" placeholderTextColor={COLORS.textSecondary} value={city} onChangeText={setCity} />
          <TextInput style={styles.input} placeholder="Primary Skill Category" placeholderTextColor={COLORS.textSecondary} value={skill} onChangeText={setSkill} />
          
          <Text style={styles.label}>Upload Valid ID (For Verification)</Text>
          <TouchableOpacity 
            style={[styles.uploadBox, idImageBase64 && { padding: 0, overflow: 'hidden', borderWidth: 0 }]} 
            onPress={pickImage}
          >
            {idImageBase64 ? (
              <Image source={{ uri: `data:image/jpeg;base64,${idImageBase64}` }} style={{ width: '100%', height: 120, resizeMode: 'cover' }} />
            ) : (
              <Text style={styles.uploadText}>↑ Tap to upload Image</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.primaryButton} onPress={handleRegister}>
            <Text style={styles.primaryButtonText}>Create Freelancer Account</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}