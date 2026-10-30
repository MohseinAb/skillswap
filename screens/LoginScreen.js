import React, { useState } from 'react';
import { Text, View, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, styles } from '../styles';

import { auth, db } from '../firebaseConfig';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { notify, confirmAction } from '../services/notify';
import { checkAccountAccess, routeForRole, offerVerificationResend } from '../services/session';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      notify('Missing fields', 'Please enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      let userCredential;
      try {
        userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
      } catch (signInErr) {
        // Auto-provision the default Admin account on first login if using admin@skillswap.ph
        if (cleanEmail === 'admin@skillswap.ph' && password === 'admin123') {
          userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
          await setDoc(doc(db, 'users', userCredential.user.uid), {
            fullName: 'System Administrator',
            email: cleanEmail,
            role: 'admin',
            accountType: 'admin',
            createdAt: serverTimestamp()
          });
        } else {
          throw signInErr;
        }
      }

      const uid = userCredential.user.uid;
      const userDoc = await getDoc(doc(db, 'users', uid));
      const userData = userDoc.exists() ? userDoc.data() : {};

      const user = userCredential.user;
      const access = await checkAccountAccess({
        userData,
        email: cleanEmail,
        reloadUser: () => user.reload(),
        isEmailVerified: () => !!(auth.currentUser || user).emailVerified,
      });

      if (!access.allowed && access.reason === 'suspended') {
        notify('Account suspended', 'Your account has been suspended by an administrator.');
        await signOut(auth); // otherwise the app would reopen straight into this account next time
        setLoading(false);
        return;
      }

      if (!access.allowed) {
        // New accounts must open the link we emailed them first. Offer to send it again,
        // then sign out so nobody stays half logged in.
        await offerVerificationResend({
          user,
          email: cleanEmail,
          confirm: confirmAction,
          notifyFn: notify,
          sendVerification: sendEmailVerification,
        });
        await signOut(auth);
        setLoading(false);
        return;
      }

      navigation.replace(routeForRole(access.role));
    } catch (error) {
      console.error('Login error:', error);
      notify('Login failed', 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={[COLORS.bgTop, COLORS.bgBottom]} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.formContainer}>
          <Text style={styles.headerText}>Welcome Back</Text>
          <Text style={styles.subtitle}>Log in to your SkillSwap account</Text>

          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder="name@example.com"
            placeholderTextColor={COLORS.textSecondary}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={COLORS.textSecondary}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.primaryButtonText}>Log In</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('AccountType')}>
            <Text style={styles.linkText}>
              Don't have an account? <Text style={{ color: COLORS.primary, fontWeight: 'bold' }}>Sign Up</Text>
            </Text>
          </TouchableOpacity>

          {/* Quick Demo Admin Fill for Presentation */}
          <TouchableOpacity
            style={{ marginTop: 30, alignItems: 'center' }}
            onPress={() => {
              setEmail('admin@skillswap.ph');
              setPassword('admin123');
            }}
          >
            <Text style={{ color: COLORS.textSecondary, fontSize: 11 }}>
              Admin Demo Login: <Text style={{ color: COLORS.primary }}>admin@skillswap.ph</Text> (Tap to Autofill)
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}