import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginStyles as styles } from '../styles/theme';

export default function Login() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    const user = username.trim().toLowerCase();
    const pass = password.trim();

    if (!user || !pass) {
      return Alert.alert('Gagal', 'Username & Password wajib diisi!');
    }

    const roleMap = {
      staf: '/staf/beranda',
      tu: '/tu/beranda',
      pimpinan: '/pimpinan/beranda',
    };

    if (roleMap[user] && pass === '123') {
      await AsyncStorage.setItem('userRole', user);
      router.replace(roleMap[user]);
    } else {
      Alert.alert('Gagal', 'Username / Password salah!\nGunakan: staf / tu / pimpinan\nPassword: 123');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>E-SURAT SMK</Text>
      <Text style={styles.subtitle}>Sistem Manajemen Dokumen Terpadu</Text>

      <View style={styles.formBox}>
        <Text style={styles.label}>Username (staf / tu / pimpinan)</Text>
        <TextInput
          style={styles.input}
          placeholder="Ketik role..."
          placeholderTextColor="#777"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />

        <Text style={styles.label}>Password (123)</Text>
        <TextInput
          style={styles.input}
          placeholder="Ketik password..."
          placeholderTextColor="#777"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={styles.button} onPress={handleLogin}>
          <Text style={styles.buttonText}>MASUK</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}