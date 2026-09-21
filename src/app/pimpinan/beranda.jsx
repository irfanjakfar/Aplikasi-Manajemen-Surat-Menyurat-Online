import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import { Alert, Modal, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { S } from '../../styles/theme';

export default function PimpinanBeranda() {
  const router = useRouter();
  const [dataSurat, setDataSurat] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [suratPilih, setSuratPilih] = useState(null);

  useEffect(() => { ambilDataSurat(); }, []);

  const ambilDataSurat = async () => {
    const { data, error } = await supabase
      .from('surat')
      .select('*')
      .eq('is_deleted', false)
      .order('id', { ascending: false });
    if (!error && data) setDataSurat(data);
    setRefreshing(false);
  };

  const onRefresh = () => { setRefreshing(true); ambilDataSurat(); };

  const bukaFile = async (dataBase64, namaFile) => {
    if (!dataBase64) return Alert.alert('Kosong', 'File belum dilampirkan.');
    try {
      const namaAman = namaFile ? namaFile.replace(/[^a-zA-Z0-9.]/g, '_') : 'Dokumen.pdf';
      const fileUri = FileSystem.documentDirectory + namaAman;
      await FileSystem.writeAsStringAsync(fileUri, dataBase64, { encoding: FileSystem.EncodingType.Base64 });
      await Sharing.shareAsync(fileUri);
    } catch (error) {
      Alert.alert('Error', 'Gagal memproses data dari database.');
    }
  };

  const setujuiSurat = async () => {
    try {
      await supabase.from('surat').update({ status: 'Disetujui Pimpinan' }).eq('id', suratPilih.id);
      Alert.alert('Sukses', 'Surat digital telah disetujui secara resmi!');
      setModalVisible(false);
      ambilDataSurat();
    } catch (error) {
      Alert.alert('Gagal', error.message);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('userRole');
    router.replace('/');
  };

  return (
    <ScrollView style={S.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFF" />}>
      <View style={S.headerRow}>
        <View>
          <Text style={S.headerTitle}>Panel Pimpinan</Text>
          <Text style={S.subHeader}>Review & ACC Dokumen</Text>
        </View>
        <TouchableOpacity style={S.logoutBtn} onPress={handleLogout}>
          <Text style={S.logoutText}>Keluar</Text>
        </TouchableOpacity>
      </View>

      <Text style={S.sectionTitle}>Menunggu Persetujuan Final</Text>
      {dataSurat.map((item, index) => (
        <TouchableOpacity
          key={index}
          style={S.suratCard}
          onPress={() => { setSuratPilih(item); setModalVisible(true); }}
        >
          <View style={S.cardHeader}>
            <Text style={S.nomorSurat}>{item.nomor_surat}</Text>
            <View style={[S.badge, { backgroundColor: item.status === 'Disetujui Pimpinan' ? '#28A745' : '#00BFFF' }]}>
              <Text style={S.badgeText}>{item.status}</Text>
            </View>
          </View>
          <Text style={S.textPutihBold}>{item.perihal}</Text>
          <Text style={S.ketKlikGreen}>🔍 Klik untuk preview PDF & ACC</Text>
        </TouchableOpacity>
      ))}

      <Modal visible={modalVisible} animationType="fade" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={S.modalBg}>
          <View style={S.modalContent}>
            <Text style={S.modalTitle}>Review Dokumen Resmi</Text>
            {suratPilih && (
              <View>
                <Text style={S.modalLabel}>Perihal Dokumen:</Text>
                <Text style={S.modalValue}>{suratPilih.perihal}</Text>
                <Text style={S.modalLabel}>File PDF Siap ACC:</Text>

                <TouchableOpacity
                  style={S.btnBukaFileBig}
                  onPress={() => bukaFile(suratPilih.file_pdf_uri, suratPilih.file_pdf_final)}
                >
                  <Text style={S.btnBukaFileBigText}>
                    👁️ Buka File PDF: {suratPilih.file_pdf_final || 'Belum ada'}
                  </Text>
                </TouchableOpacity>

                {suratPilih.status === 'Menunggu Pimpinan' ? (
                  <TouchableOpacity style={S.submitBtn} onPress={setujuiSurat}>
                    <Text style={S.submitText}>✅ ACC / Setujui Surat Ini</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={S.infoBiru}>Dokumen ini telah disetujui.</Text>
                )}
              </View>
            )}
            <TouchableOpacity style={S.btnClose} onPress={() => setModalVisible(false)}>
              <Text style={S.btnCloseText}>Tutup</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <View style={S.spacer40} />
    </ScrollView>
  );
}