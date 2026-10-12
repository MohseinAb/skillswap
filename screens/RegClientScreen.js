import React, { useState } from 'react';
import { Text, View, TextInput, TouchableOpacity, ScrollView, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker'; // <-- Import Image Picker
import { COLORS, styles } from '../styles';

import { auth, db } from '../firebaseConfig';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

export default function RegClientScreen({ navigation }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [city, setCity] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [idImageBase64, setIdImageBase64] = useState(null); // <-- State for the string

  // Image Picker Function
  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.3, // Keep quality low so the Base64 string doesn't get too large for Firestore
      base64: true, // <-- This tells Expo to generate the Base64 string
    });

    if (!result.canceled) {
      setIdImageBase64(result.assets[0].base64);
    }
  };

  const handleRegister = async () => {
    if (!email || !password || !fullName || !city) {
      Alert.alert("Error", "Please fill out all required fields.");
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Save to Firestore
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        fullName: fullName,
        email: email,
        city: city,
        companyName: companyName,
        idImage: idImageBase64, // <-- Save the long string directly to the database
        role: "client",
        createdAt: new Date(),
      });

      Alert.alert("Success", "Client account created!");
      navigation.navigate('Login');

   } catch (error) {
      // This will force the error to print in your terminal and browser console
      console.error("FIREBASE ERROR:", error.code, error.message);
      
      // This uses a standard web popup just in case React Native's Alert is failing
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
          <Text style={styles.headerTitle}>Client Sign Up</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={styles.scrollForm}>
          
          <TextInput style={styles.input} placeholder="Full Name" placeholderTextColor={COLORS.textSecondary} value={fullName} onChangeText={setFullName} />
          <TextInput style={styles.input} placeholder="Email Address" placeholderTextColor={COLORS.textSecondary} value={email} onChangeText={setEmail} autoCapitalize="none" />
          <TextInput style={styles.input} placeholder="Password" placeholderTextColor={COLORS.textSecondary} secureTextEntry value={password} onChangeText={setPassword} />
          <TextInput style={styles.input} placeholder="City / Neighborhood" placeholderTextColor={COLORS.textSecondary} value={city} onChangeText={setCity} />
          <TextInput style={styles.input} placeholder="Company / Brand Name (Optional)" placeholderTextColor={COLORS.textSecondary} value={companyName} onChangeText={setCompanyName} />
          
          <Text style={styles.label}>Upload Valid ID (For Trust & Safety)</Text>
          
          {/* Updated Upload Box to trigger image picker and show preview */}
          <TouchableOpacity 
            style={[styles.uploadBox, idImageBase64 && { padding: 0, overflow: 'hidden', borderWidth: 0 }]} 
            onPress={pickImage}
          >
            {idImageBase64 ? (
              <Image 
                source={{ uri: `data:image/jpeg;base64,${idImageBase64}` }} 
                style={{ width: '100%', height: 120, resizeMode: 'cover' }} 
              />
            ) : (
              <Text style={styles.uploadText}>↑ Tap to upload Image</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.primaryButton} onPress={handleRegister}>
            <Text style={styles.primaryButtonText}>Create Client Account</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}