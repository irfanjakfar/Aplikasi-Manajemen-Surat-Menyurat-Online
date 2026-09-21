import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import { Alert, Modal, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { S } from '../../styles/theme';

export default function StafBeranda() {
  const router = useRouter();
  const [kategori, setKategori] = useState('');
  const [perihal, setPerihal] = useState('');
  const [filesMentah, setFilesMentah] = useState([]);
  const [noSuratOtomatis, setNoSuratOtomatis] = useState('SR/2026/10/001');
  const [dataSurat, setDataSurat] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [suratPilih, setSuratPilih] = useState(null);
  const [loading, setLoading] = useState(false);

  const [modalFileVisible, setModalFileVisible] = useState(false);
  const [listFileTampil, setListFileTampil] = useState([]);

  useEffect(() => { ambilDataSurat(); }, []);

  const ambilDataSurat = async () => {
    const { data, error } = await supabase
      .from('surat')
      .select('*')
      .eq('is_deleted', false)
      .order('id', { ascending: false });

    if (!error && data) {
      setDataSurat(data);
      const idTertinggi = data.length > 0 ? Math.max(...data.map(s => s.id)) : 0;
      const nomorBerikut = idTertinggi + 1;
      setNoSuratOtomatis(`SR/2026/10/${String(nomorBerikut).padStart(3, '0')}`);
    }
    setRefreshing(false);
  };

  const onRefresh = () => { setRefreshing(true); ambilDataSurat(); };

  const hitungUkuranTotal = (list) => {
    return list.reduce((total, f) => total + (f.dataBase64.length * 3) / 4, 0);
  };

  const ambilFoto = async () => {
    try {
      const izin = await ImagePicker.requestCameraPermissionsAsync();
      if (!izin.granted) return Alert.alert('Izin Ditolak', 'Aplikasi butuh izin kamera.');

      const hasil = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.4,
        base64: true,
      });

      if (hasil.canceled) return;

      const asset = hasil.assets && hasil.assets[0];
      if (!asset || !asset.base64) return Alert.alert('Gagal', 'Foto tidak bisa diproses.');

      const ukuranBaru = (asset.base64.length * 3) / 4;
      const ukuranTotal = hitungUkuranTotal(filesMentah) + ukuranBaru;
      if (ukuranTotal > 4 * 1024 * 1024) {
        return Alert.alert('Gagal', 'Total foto melebihi 4MB. Hapus beberapa dulu.');
      }

      const namaFile = `Foto_${Date.now()}.jpg`;
      setFilesMentah([...filesMentah, { nama: namaFile, dataBase64: asset.base64 }]);
      Alert.alert('Berhasil', `Foto ke-${filesMentah.length + 1} ditambahkan.`);
    } catch (error) {
      Alert.alert('Gagal Ambil Foto', error.message);
    }
  };

  const pilihDariGaleri = async () => {
    try {
      const izin = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!izin.granted) return Alert.alert('Izin Ditolak', 'Aplikasi butuh izin galeri.');

      const hasil = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.4,
        base64: true,
        allowsMultipleSelection: true,
        selectionLimit: 10,
      });

      if (hasil.canceled) return;

      const fotoBaru = hasil.assets
        .filter(a => a.base64)
        .map((a, i) => ({
          nama: `Galeri_${Date.now()}_${i + 1}.jpg`,
          dataBase64: a.base64,
        }));

      if (fotoBaru.length === 0) return Alert.alert('Gagal', 'Tidak ada foto yang bisa dibaca.');

      const gabungan = [...filesMentah, ...fotoBaru];
      const ukuranTotal = hitungUkuranTotal(gabungan);
      if (ukuranTotal > 4 * 1024 * 1024) {
        return Alert.alert('Gagal', 'Total foto melebihi 4MB. Kurangi jumlah fotonya.');
      }

      setFilesMentah(gabungan);
      Alert.alert('Berhasil', `${fotoBaru.length} foto ditambahkan. Total: ${gabungan.length} foto.`);
    } catch (error) {
      Alert.alert('Gagal Ambil Foto', error.message);
    }
  };

  const tampilkanMenuUpload = () => {
    Alert.alert(
      'Tambah Foto Dokumen',
      `Total foto saat ini: ${filesMentah.length}\nMaksimal 4MB semua foto digabung.`,
      [
        { text: '📷 Kamera', onPress: ambilFoto },
        { text: '🖼️ Galeri', onPress: pilihDariGaleri },
        { text: 'Batal', style: 'cancel' },
      ]
    );
  };

  const hapusFotoLokal = (index) => {
    Alert.alert('Hapus Foto', `Hapus foto ke-${index + 1}?`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: () => setFilesMentah(filesMentah.filter((_, i) => i !== index)),
      },
    ]);
  };

  const handleSimpan = async () => {
    if (loading) return;
    if (!kategori || !perihal || filesMentah.length === 0) {
      return Alert.alert('Gagal', 'Semua form & minimal 1 foto wajib diisi!');
    }

    setLoading(true);
    try {
      const dataJson = JSON.stringify(filesMentah.map(f => ({
        nama: f.nama,
        data: f.dataBase64,
      })));

      const namaGabungan = filesMentah.map(f => f.nama).join(', ');

      const { data, error } = await supabase.from('surat').insert([{
        kategori: kategori.trim(),
        perihal: perihal.trim(),
        nomor_surat: noSuratOtomatis,
        status: 'Menunggu TU',
        file_mentah: namaGabungan,
        file_mentah_uri: dataJson,
        is_deleted: false,
      }]).select('id');

      if (error) {
        Alert.alert('Gagal Kirim', `Error: ${error.message}`);
        setLoading(false);
        return;
      }

      console.log('✅ Sukses! ID:', data?.[0]?.id);
      Alert.alert('Berhasil', `${filesMentah.length} foto tersimpan di Database!`);

      setKategori('');
      setPerihal('');
      setFilesMentah([]);
      ambilDataSurat();
    } catch (error) {
      Alert.alert('Gagal Kirim', error.message);
    } finally {
      setLoading(false);
    }
  };

  const bukaFile = async (rawData, namaFile) => {
    if (!rawData) return Alert.alert('Kosong', 'File belum tersedia.');

    try {
      let listFile = [];
      try {
        const parsed = JSON.parse(rawData);
        if (Array.isArray(parsed)) listFile = parsed;
        else listFile = [{ nama: namaFile || 'Dokumen.pdf', data: rawData }];
      } catch {
        listFile = [{ nama: namaFile || 'Dokumen.pdf', data: rawData }];
      }

      if (listFile.length === 0) return Alert.alert('Kosong', 'Tidak ada file.');

      if (listFile.length === 1) {
        const f = listFile[0];
        const namaAman = (f.nama || 'Dokumen.jpg').replace(/[^a-zA-Z0-9.]/g, '_');
        const fileUri = FileSystem.documentDirectory + namaAman;
        await FileSystem.writeAsStringAsync(fileUri, f.data, { encoding: FileSystem.EncodingType.Base64 });
        await Sharing.shareAsync(fileUri);
        return;
      }

      setListFileTampil(listFile);
      setModalFileVisible(true);
    } catch (error) {
      Alert.alert('Error', 'Gagal memproses data.');
    }
  };

  const shareSatuFile = async (file) => {
    try {
      setModalFileVisible(false);
      const namaAman = (file.nama || 'Dokumen.jpg').replace(/[^a-zA-Z0-9.]/g, '_');
      const fileUri = FileSystem.documentDirectory + namaAman;
      await FileSystem.writeAsStringAsync(fileUri, file.data, { encoding: FileSystem.EncodingType.Base64 });
      await Sharing.shareAsync(fileUri);
    } catch (error) {
      Alert.alert('Error', 'Gagal membuka file.');
    }
  };

  const gabungKePDF = async (listFile) => {
    try {
      const fotoList = listFile.filter(f => f.data && f.data.length > 100);

      if (fotoList.length === 0) {
        return Alert.alert('Gagal', 'Tidak ada foto yang bisa digabung.');
      }

      Alert.alert('Memproses', `Menggabungkan ${fotoList.length} foto menjadi 1 PDF...`);

      const htmlContent = `
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              @page { margin: 10px; }
              body { margin: 0; padding: 0; font-family: sans-serif; }
              .page { page-break-after: always; text-align: center; padding: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 95vh; }
              .page:last-child { page-break-after: auto; }
              .label { font-size: 11px; color: #666; margin-bottom: 8px; font-weight: bold; }
              img { max-width: 100%; max-height: 90vh; object-fit: contain; border: 1px solid #ddd; }
            </style>
          </head>
          <body>
            ${fotoList.map((f, i) => `
              <div class="page">
                <div class="label">📄 ${f.nama || `Halaman ${i + 1}`}</div>
                <img src="data:image/jpeg;base64,${f.data}" />
              </div>
            `).join('')}
          </body>
        </html>
      `;

      const { base64 } = await Print.printToFileAsync({
        html: htmlContent,
        base64: true
      });

      if (!base64) {
        return Alert.alert('Gagal', 'PDF tidak bisa diproses (base64 kosong).');
      }

      const namaFile = `Gabungan_${Date.now()}.pdf`;
      const fileUri = FileSystem.documentDirectory + namaFile;
      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: FileSystem.EncodingType.Base64
      });

      setModalFileVisible(false);

      Alert.alert(
        '✅ Berhasil',
        `${fotoList.length} foto sudah digabung menjadi 1 PDF.`,
        [
          {
            text: 'Bagikan PDF',
            onPress: async () => {
              try {
                await Sharing.shareAsync(fileUri, {
                  mimeType: 'application/pdf',
                  dialogTitle: 'Simpan / Kirim PDF',
                  UTI: 'com.adobe.pdf',
                });
              } catch (err) {
                Alert.alert('Gagal Share', err.message);
              }
            },
          },
          { text: 'Tutup', style: 'cancel' },
        ]
      );
    } catch (error) {
      Alert.alert('Gagal Gabung PDF', error.message);
    }
  };

  const hapusSurat = (surat) => {
    if (surat.status !== 'Menunggu TU') {
      return Alert.alert(
        'Tidak Bisa Dihapus',
        `Surat dengan status "${surat.status}" sudah diproses dan tidak bisa dihapus.`
      );
    }

    Alert.alert(
      '🗑️ Hapus Data Surat',
      `Yakin mau hapus "${surat.perihal}"?\n\nData akan disembunyikan dari daftar.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('surat')
              .update({ is_deleted: true })
              .eq('id', surat.id);

            if (error) {
              Alert.alert('Gagal Hapus', error.message);
              return;
            }
            Alert.alert('Berhasil', 'Data surat disembunyikan dari daftar.');
            setModalVisible(false);
            ambilDataSurat();
          },
        },
      ]
    );
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('userRole');
    router.replace('/');
  };

  return (
    <ScrollView style={S.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFF" />}>
      <View style={S.headerRow}>
        <View>
          <Text style={S.headerTitle}>Panel Staf</Text>
          <Text style={S.subHeader}>Upload Ke Database</Text>
        </View>
        <TouchableOpacity style={S.logoutBtn} onPress={handleLogout}>
          <Text style={S.logoutText}>Keluar</Text>
        </TouchableOpacity>
      </View>

      <View style={S.cardForm}>
        <Text style={S.sectionTitle}>+ Kirim Dokumen Digitalisasi</Text>
        <Text style={S.infoNomor}>Nomor Urut: {noSuratOtomatis}</Text>
        <TextInput style={S.input} placeholder="Kategori (Contoh: KTP, Ijazah)" placeholderTextColor="#777" value={kategori} onChangeText={setKategori} />
        <TextInput style={S.input} placeholder="Perihal dokumen..." placeholderTextColor="#777" value={perihal} onChangeText={setPerihal} />

        <TouchableOpacity style={S.btnUpload} onPress={tampilkanMenuUpload}>
          <Text style={S.btnUploadText}>
            {filesMentah.length === 0
              ? '📷 Tambah Foto (Max 4MB total)'
              : `📁 ${filesMentah.length} foto siap dikirim — Tambah lagi?`}
          </Text>
        </TouchableOpacity>

        {filesMentah.length > 0 && (
          <View style={S.listFileBox}>
            {filesMentah.map((f, i) => (
              <View key={i} style={S.fileItemContainer}>
                <Text style={S.fileItemText} numberOfLines={1}>
                  📄 {i + 1}. {f.nama}
                </Text>
                <TouchableOpacity onPress={() => hapusFotoLokal(i)}>
                  <Text style={S.fileItemDelete}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[S.submitBtn, loading && { opacity: 0.6 }]}
          onPress={handleSimpan}
          disabled={loading}
        >
          <Text style={S.submitText}>{loading ? 'MENGIRIM...' : 'KIRIM KE TU'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={S.sectionTitle}>Status Dokumen Anda</Text>
      {dataSurat.map((item, index) => (
        <TouchableOpacity key={index} style={S.suratCard} onPress={() => { setSuratPilih(item); setModalVisible(true); }}>
          <View style={S.cardHeader}>
            <Text style={S.nomorSurat}>{item.nomor_surat}</Text>
            <View style={[S.badge, { backgroundColor: item.status === 'Disetujui Pimpinan' ? '#28A745' : '#FFC107' }]}>
              <Text style={S.badgeText}>{item.status}</Text>
            </View>
          </View>
          <Text style={S.textPutihBold}>{item.perihal}</Text>
          <Text style={S.ketKlik}>🔍 Klik untuk lihat preview / download</Text>
        </TouchableOpacity>
      ))}

      <Modal visible={modalVisible} animationType="fade" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={S.modalBg}>
          <View style={S.modalContent}>
            <Text style={S.modalTitle}>Detail Dokumen</Text>
            {suratPilih && (
              <View>
                <Text style={S.modalLabel}>Nomor Surat:</Text>
                <Text style={S.modalValue}>{suratPilih.nomor_surat}</Text>
                <Text style={S.modalLabel}>File Asli Anda:</Text>
                <Text style={S.modalValue} numberOfLines={2}>📁 {suratPilih.file_mentah}</Text>
                <Text style={S.modalLabel}>Status:</Text>
                <Text style={[S.modalValue, S.textAccentBlue]}>{suratPilih.status}</Text>

                <TouchableOpacity
                  style={[S.submitBtnBlue, S.mt10]}
                  onPress={() => bukaFile(suratPilih.file_mentah_uri, suratPilih.file_mentah)}
                >
                  <Text style={S.submitText}>👁️ Lihat File Mentah Saya</Text>
                </TouchableOpacity>

                {suratPilih.status === 'Disetujui Pimpinan' && (
                  <TouchableOpacity
                    style={[S.submitBtn, S.mt10]}
                    onPress={() => bukaFile(suratPilih.file_pdf_uri, suratPilih.file_pdf_final)}
                  >
                    <Text style={S.submitText}>⬇️ Download PDF Resmi</Text>
                  </TouchableOpacity>
                )}

                {suratPilih.status === 'Menunggu TU' && (
                  <TouchableOpacity
                    style={[S.mt15, S.btnDanger]}
                    onPress={() => hapusSurat(suratPilih)}
                  >
                    <Text style={S.btnDangerText}>🗑️ Hapus Data Ini</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            <TouchableOpacity style={S.btnClose} onPress={() => setModalVisible(false)}>
              <Text style={S.btnCloseText}>Tutup</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={modalFileVisible} animationType="slide" transparent onRequestClose={() => setModalFileVisible(false)}>
        <View style={S.modalBg}>
          <View style={S.modalContentTall}>
            <Text style={S.modalTitle}>📎 {listFileTampil.length} File Tersedia</Text>
            <Text style={[S.modalLabel, S.textCenter, { marginBottom: 15 }]}>
              Pilih 1 file, atau gabung semua jadi 1 PDF:
            </Text>

            <ScrollView style={S.scrollMax}>
              {listFileTampil.map((file, i) => (
                <TouchableOpacity key={i} style={S.fileListItem} onPress={() => shareSatuFile(file)}>
                  <Text style={S.fileListText} numberOfLines={1}>
                    📄 {i + 1}. {file.nama || `File ${i + 1}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[S.btnFullGreen, S.mt15]}
              onPress={() => gabungKePDF(listFileTampil)}
            >
              <Text style={S.btnFullGreenText}>
                📥 Download Semua ({listFileTampil.length} foto → 1 PDF)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[S.btnCloseStrong, S.btnFullWidth, S.mt10]}
              onPress={() => setModalFileVisible(false)}
            >
              <Text style={S.btnCloseText}>Tutup</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={S.spacer40} />
    </ScrollView>
  );
}