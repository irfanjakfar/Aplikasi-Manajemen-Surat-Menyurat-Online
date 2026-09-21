import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { File as FSFile } from 'expo-file-system';
import * as Print from 'expo-print';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import { Alert, Modal, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { supabase } from '../../lib/supabase';
import { S } from '../../styles/theme';

export default function TuBeranda() {
  const router = useRouter();
  const [dataSurat, setDataSurat] = useState([]);
  const [monetisasi, setMonetisasi] = useState({
    paket: '',
    kuota_maksimal: 50,
    kuota_terpakai: 0,
    subscription_aktif: false,
    nama_subscription: null,
    harga_subscription: null,
    tanggal_expired: null,
  });
  const [suratDiproses, setSuratDiproses] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalBayar, setModalBayar] = useState(false);
  const [modalLangganan, setModalLangganan] = useState(false);
  const [stepBayar, setStepBayar] = useState(1);
  const [stepLangganan, setStepLangganan] = useState(1);
  const [pesanan, setPesanan] = useState(null);
  const [pesananLangganan, setPesananLangganan] = useState(null);
  const [suratPilih, setSuratPilih] = useState(null);
  const [filePdfFinal, setFilePdfFinal] = useState(null);
  const [loading, setLoading] = useState(false);

  const [modalFileVisible, setModalFileVisible] = useState(false);
  const [listFileTampil, setListFileTampil] = useState([]);

  useEffect(() => { ambilData(); }, []);

  const cekLanggananAktifDari = (data) => {
    if (!data) return false;
    if (!data.subscription_aktif) return false;
    if (!data.tanggal_expired) return false;
    return new Date(data.tanggal_expired) > new Date();
  };

  const cekLanggananAktif = () => cekLanggananAktifDari(monetisasi);

  const sisaHariLangganan = () => {
    if (!monetisasi.tanggal_expired) return 0;
    const diff = new Date(monetisasi.tanggal_expired) - new Date();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const ambilData = async () => {
    const { data: dSurat } = await supabase
      .from('surat')
      .select('*')
      .eq('is_deleted', false)
      .order('id', { ascending: false });
    if (dSurat) setDataSurat(dSurat);

    const { data: dProses } = await supabase
      .from('surat')
      .select('id, nomor_surat, perihal, status, diproses_pada')
      .eq('is_deleted', false)
      .in('status', ['Menunggu Pimpinan', 'Disetujui Pimpinan'])
      .order('id', { ascending: false });

    const { data: dUang } = await supabase
      .from('monetisasi')
      .select('*')
      .eq('id', 1)
      .single();

    if (dProses && dUang) {
      setSuratDiproses(dProses);

      const langgananAktifSekarang = cekLanggananAktifDari(dUang);
      const jumlahTerpakai = langgananAktifSekarang ? 0 : dProses.length;

      setMonetisasi({ ...dUang, kuota_terpakai: jumlahTerpakai });

      if (dUang.kuota_terpakai !== jumlahTerpakai) {
        await supabase
          .from('monetisasi')
          .update({ kuota_terpakai: jumlahTerpakai })
          .eq('id', 1);
      }
    } else if (dUang) {
      setMonetisasi(dUang);
    }

    setRefreshing(false);
  };

  const onRefresh = () => { setRefreshing(true); ambilData(); };

  const bukaFile = async (rawData, namaFile) => {
    if (!rawData) return Alert.alert('Kosong', 'File belum dilampirkan.');
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
      if (fotoList.length === 0) return Alert.alert('Gagal', 'Tidak ada foto yang bisa digabung.');

      Alert.alert('Memproses', `Menggabungkan ${fotoList.length} foto jadi 1 PDF...`);

      const htmlContent = `
        <html><head><meta charset="utf-8"><style>
          @page { margin: 10px; }
          body { margin: 0; padding: 0; font-family: sans-serif; }
          .page { page-break-after: always; text-align: center; padding: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 95vh; }
          .page:last-child { page-break-after: auto; }
          .label { font-size: 11px; color: #666; margin-bottom: 8px; font-weight: bold; }
          img { max-width: 100%; max-height: 90vh; object-fit: contain; border: 1px solid #ddd; }
        </style></head><body>
          ${fotoList.map((f, i) => `
            <div class="page">
              <div class="label">📄 ${f.nama || `Halaman ${i + 1}`}</div>
              <img src="data:image/jpeg;base64,${f.data}" />
            </div>
          `).join('')}
        </body></html>
      `;

      const { base64 } = await Print.printToFileAsync({ html: htmlContent, base64: true });
      if (!base64) return Alert.alert('Gagal', 'PDF tidak bisa diproses.');

      const namaFile = `Gabungan_${Date.now()}.pdf`;
      const fileUri = FileSystem.documentDirectory + namaFile;
      await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });

      setModalFileVisible(false);

      Alert.alert('✅ Berhasil', `${fotoList.length} foto sudah digabung jadi 1 PDF.`, [
        {
          text: 'Bagikan PDF',
          onPress: async () => {
            try {
              await Sharing.shareAsync(fileUri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
            } catch (err) { Alert.alert('Gagal Share', err.message); }
          },
        },
        { text: 'Tutup', style: 'cancel' },
      ]);
    } catch (error) {
      Alert.alert('Gagal Gabung PDF', error.message);
    }
  };

  const pilihPdfFinal = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: false,
      });
      if (result.canceled) return;
      const asset = result.assets && result.assets[0];
      if (!asset) return;

      let base64Data = null;
      try {
        const file = new FSFile(asset.uri);
        base64Data = await file.base64();
      } catch (err) { console.log('File API gagal:', err.message); }

      if (!base64Data) {
        try {
          base64Data = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
        } catch (err) { console.log('Legacy gagal:', err.message); }
      }

      if (!base64Data) {
        return Alert.alert('Gagal Baca PDF', 'PDF tidak bisa dibaca.\n\nCoba pilih PDF dari folder Download, ukuran kecil.');
      }

      setFilePdfFinal({ nama: asset.name, dataBase64: base64Data });
      Alert.alert('Berhasil', 'PDF siap dikirim ke Pimpinan.');
    } catch (error) {
      Alert.alert('Gagal Memilih PDF', error.message);
    }
  };

  const updateStatusTU = async () => {
    if (loading) return;
    if (!filePdfFinal) return Alert.alert('Gagal', 'Upload PDF Final terlebih dahulu!');

    const langgananAktif = cekLanggananAktif();
    const kuotaCukup = monetisasi.kuota_terpakai < monetisasi.kuota_maksimal;

    if (!langgananAktif && !kuotaCukup) {
      return Alert.alert(
        '⚠️ Limit Tercapai',
        'Kuota per-dokumen sudah habis dan langganan tidak aktif.\n\nSilakan:\n• Beli kuota tambahan, atau\n• Langganan bulanan',
        [{ text: 'OK' }]
      );
    }

    setLoading(true);
    try {
      const { error: e1 } = await supabase.from('surat')
        .update({
          status: 'Menunggu Pimpinan',
          file_pdf_final: filePdfFinal.nama,
          file_pdf_uri: filePdfFinal.dataBase64,
          diproses_pada: new Date().toISOString(),
        })
        .eq('id', suratPilih.id);

      if (e1) {
        Alert.alert('Gagal Update Surat', e1.message);
        setLoading(false);
        return;
      }

      const metode = langgananAktif ? '📅 Langganan Bulanan (Unlimited)' : '📄 Per-Document Fee';
      Alert.alert('✅ Berhasil', `Dokumen PDF tersimpan.\n\nMetode: ${metode}`);
      setModalVisible(false);
      setFilePdfFinal(null);
      ambilData();
    } catch (error) {
      Alert.alert('Gagal', error.message);
    } finally {
      setLoading(false);
    }
  };

  const hapusSurat = (surat) => {
    Alert.alert(
      '🗑️ Hapus Data Surat',
      `Yakin mau hapus "${surat.perihal}" (${surat.nomor_surat})?\n\nData akan disembunyikan dari daftar.`,
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
            if (error) { Alert.alert('Gagal Hapus', error.message); return; }
            Alert.alert('Berhasil', 'Data surat disembunyikan dari daftar.');
            setModalVisible(false);
            ambilData();
          },
        },
      ]
    );
  };

  const pilihPaket = (namaPaket, harga) => {
    setPesanan({ paket: namaPaket, harga, tanggal: new Date().toLocaleDateString('id-ID') });
    setStepBayar(2);
  };

  const konfirmasiBayarKuota = async () => {
    try {
      let tambahan = 50;
      if (pesanan.paket.includes('1000')) tambahan = 1000;
      else if (pesanan.paket.includes('500')) tambahan = 500;
      else if (pesanan.paket.includes('100')) tambahan = 100;

      await supabase.from('monetisasi')
        .update({
          paket: pesanan.paket,
          kuota_maksimal: tambahan,
          kuota_terpakai: 0,
        })
        .eq('id', 1);

      Alert.alert('✅ Berhasil', `Paket ${pesanan.paket} sudah diaktifkan.\nKuota: ${tambahan} dokumen.`);
      setModalBayar(false);
      setStepBayar(1);
      setPesanan(null);
      ambilData();
    } catch (error) {
      Alert.alert('Gagal', error.message);
    }
  };

  const tutupModalBayar = () => {
    setModalBayar(false);
    setTimeout(() => setStepBayar(1), 500);
  };

  const pilihPaketLangganan = (namaPaket, harga, durasiBulan) => {
    setPesananLangganan({ paket: namaPaket, harga, durasiBulan, tanggal: new Date().toLocaleDateString('id-ID') });
    setStepLangganan(2);
  };

  const konfirmasiBayarLangganan = async () => {
    try {
      const sekarang = new Date();
      const existing = monetisasi.tanggal_expired ? new Date(monetisasi.tanggal_expired) : sekarang;
      const mulaiDari = existing > sekarang ? existing : sekarang;

      const expiredBaru = new Date(mulaiDari);
      expiredBaru.setMonth(expiredBaru.getMonth() + pesananLangganan.durasiBulan);

      await supabase.from('monetisasi')
        .update({
          subscription_aktif: true,
          nama_subscription: pesananLangganan.paket,
          harga_subscription: parseInt(pesananLangganan.harga.replace(/\D/g, '')),
          tanggal_expired: expiredBaru.toISOString(),
          kuota_terpakai: 0,
        })
        .eq('id', 1);

      Alert.alert(
        '✅ Langganan Aktif',
        `Paket: ${pesananLangganan.paket}\n\nBerlaku sampai:\n${expiredBaru.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}\n\n🚀 Mode UNLIMITED aktif — kuota per-dokumen tidak dipakai.`
      );
      setModalLangganan(false);
      setStepLangganan(1);
      setPesananLangganan(null);
      ambilData();
    } catch (error) {
      Alert.alert('Gagal', error.message);
    }
  };

  const tutupModalLangganan = () => {
    setModalLangganan(false);
    setTimeout(() => setStepLangganan(1), 500);
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('userRole');
    router.replace('/');
  };

  const persenKuota = Math.round((monetisasi.kuota_terpakai / monetisasi.kuota_maksimal) * 100) || 0;
  const sisaKuota = monetisasi.kuota_maksimal - monetisasi.kuota_terpakai;
  const langgananAktif = cekLanggananAktif();
  const sisaHari = sisaHariLangganan();

  const formatTanggal = (iso) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <ScrollView style={S.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFF" />}>
      <View style={S.headerRow}>
        <View>
          <Text style={S.headerTitle}>Panel TU</Text>
          <Text style={S.subHeader}>Validasi Database</Text>
        </View>
        <TouchableOpacity style={S.logoutBtn} onPress={handleLogout}>
          <Text style={S.logoutText}>Keluar</Text>
        </TouchableOpacity>
      </View>

      <View style={S.cardMonetisasi}>
        <Text style={S.sectionTitle}>💰 Sistem Monetisasi</Text>
        <Text style={S.subtitleCardText}>2 Model: Subscription & Per-Document Fee</Text>

        <View style={[S.cardSubscription, langgananAktif && S.cardSubscriptionAktif]}>
          <View style={S.titleRow}>
            <Text style={S.titleCardText}>📅 Langganan Bulanan</Text>
            <View style={langgananAktif ? S.badgeMiniGreen : S.badgeMiniGray}>
              <Text style={S.badgeMiniText}>{langgananAktif ? 'AKTIF' : 'NONAKTIF'}</Text>
            </View>
          </View>

          {langgananAktif ? (
            <View style={S.mt10}>
              <Text style={S.textSmall}>
                Paket: <Text style={S.textAccentGreen}>{monetisasi.nama_subscription}</Text>
              </Text>
              <Text style={S.textSmall}>
                Berlaku sampai: <Text style={S.textAccentYellow}>{formatTanggal(monetisasi.tanggal_expired)}</Text>
              </Text>
              <Text style={S.textSmall}>
                Sisa: <Text style={S.textAccentBlue}>{sisaHari} hari</Text>
              </Text>
              <Text style={S.textNoteGreen}>🚀 Mode UNLIMITED — kuota per-dokumen tidak dipakai</Text>
            </View>
          ) : (
            <Text style={[S.textSmallMuted, S.mt10]}>
              Belum berlangganan. Setiap surat akan memakai kuota per-dokumen.
            </Text>
          )}

          <TouchableOpacity style={S.btnSubscription} onPress={() => setModalLangganan(true)}>
            <Text style={S.btnSubscriptionText}>
              {langgananAktif ? '🔄 Perpanjang Langganan' : '📅 Berlangganan Sekarang'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[S.cardPerDoc, langgananAktif && S.cardPerDocDim]}>
          <View style={S.titleRow}>
            <Text style={S.titleCardText}>📄 Per-Document Fee</Text>
            <View style={
              langgananAktif
                ? S.badgeMiniGray
                : (sisaKuota > 5 ? S.badgeMiniBlue : S.badgeMiniRed)
            }>
              <Text style={S.badgeMiniText}>
                {langgananAktif ? 'NONAKTIF' : (sisaKuota > 5 ? 'TERSEDIA' : 'MENIPIS')}
              </Text>
            </View>
          </View>

          {langgananAktif ? (
            <View style={S.mt10}>
              <Text style={S.textSmallMuted}>Mode langganan aktif. Kuota per-dokumen tidak dipakai.</Text>
              <Text style={S.textUnlimited}>✨ UNLIMITED DOKUMEN</Text>
            </View>
          ) : (
            <View style={S.mt10}>
              <Text style={S.textSmall}>
                Paket: <Text style={S.textAccentGreen}>{monetisasi.paket}</Text>
              </Text>
              <Text style={S.textSmall}>
                Sisa Kuota: <Text style={S.textAccentYellow}>{sisaKuota} / {monetisasi.kuota_maksimal} Dokumen</Text>
              </Text>

              <View style={S.progressBarBg}>
                <View style={[S.progressBarFill, { width: `${persenKuota}%` }]} />
              </View>
              <Text style={S.persenText}>{persenKuota}% Terpakai</Text>

              <TouchableOpacity style={S.btnGreenSmall} onPress={() => setModalBayar(true)}>
                <Text style={S.btnGreenSmallText}>💳 Beli Kuota Tambahan</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={S.dividerTop}>
          <Text style={[S.sectionTitle, { fontSize: 13, color: '#00BFFF' }]}>
            📋 Surat yang Sudah Diproses ({suratDiproses.length})
          </Text>

          {suratDiproses.length === 0 ? (
            <Text style={[S.textSmallMuted, S.textCenter, { paddingVertical: 10 }]}>
              Belum ada surat yang diproses
            </Text>
          ) : (
            <View style={S.listSuratBox}>
              <ScrollView nestedScrollEnabled>
                {suratDiproses.map((s) => (
                  <View
                    key={s.id}
                    style={[
                      S.listSuratItem,
                      s.status === 'Disetujui Pimpinan' ? S.listSuratItemAcc : S.listSuratItemPending,
                    ]}
                  >
                    <View style={S.listSuratHeader}>
                      <Text style={S.listSuratNomor}>{s.nomor_surat}</Text>
                      <Text style={S.listSuratTanggal}>{formatTanggal(s.diproses_pada)}</Text>
                    </View>
                    <Text style={S.listSuratPerihal} numberOfLines={1}>{s.perihal}</Text>
                    <Text style={s.status === 'Disetujui Pimpinan' ? S.listSuratStatusAcc : S.listSuratStatusPending}>
                      {s.status}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </View>

      <Text style={S.sectionTitle}>Surat Masuk</Text>
      {dataSurat.map((item, index) => (
        <TouchableOpacity
          key={index}
          style={S.suratCard}
          onPress={() => { setSuratPilih(item); setFilePdfFinal(null); setModalVisible(true); }}
        >
          <View style={S.cardHeader}>
            <Text style={S.nomorSurat}>{item.nomor_surat}</Text>
            <View style={[S.badge, { backgroundColor: item.status === 'Menunggu TU' ? '#FFC107' : '#00BFFF' }]}>
              <Text style={S.badgeText}>{item.status}</Text>
            </View>
          </View>
          <Text style={S.textPutihBold}>{item.perihal}</Text>
          <Text style={S.ketKlikYellow}>🔍 Buka & Lihat Lampiran</Text>
        </TouchableOpacity>
      ))}

      <Modal visible={modalVisible} animationType="fade" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={S.modalBg}>
          <View style={S.modalContent}>
            <Text style={S.modalTitle}>Validasi Dokumen</Text>
            {suratPilih && (
              <View>
                <Text style={S.modalLabel}>Nomor Surat:</Text>
                <Text style={S.modalValue}>{suratPilih.nomor_surat}</Text>
                <Text style={S.modalLabel}>File Mentah (Dari Staf):</Text>
                <TouchableOpacity
                  style={S.btnBukaFile}
                  onPress={() => bukaFile(suratPilih.file_mentah_uri, suratPilih.file_mentah)}
                >
                  <Text style={S.btnBukaFileText}>👁️ Lihat File Mentah dari Staf</Text>
                </TouchableOpacity>

                {suratPilih.status === 'Menunggu TU' ? (
                  <View style={S.mt15}>
                    <Text style={S.modalLabel}>Ubah ke PDF & Upload:</Text>
                    <TouchableOpacity style={S.btnUploadYellow} onPress={pilihPdfFinal}>
                      <Text style={S.btnUploadYellowText}>
                        {filePdfFinal ? `📄 ${filePdfFinal.nama}` : '📎 Upload PDF Final'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[S.submitBtnBlue, loading && { opacity: 0.6 }]}
                      onPress={updateStatusTU}
                      disabled={loading}
                    >
                      <Text style={S.submitText}>{loading ? 'MENYIMPAN...' : '📩 Kirim ke Pimpinan'}</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text style={S.infoHijau}>Sudah diteruskan ke Pimpinan.</Text>
                )}

                <TouchableOpacity
                  style={[S.mt15, S.btnFullGreen, { backgroundColor: '#DC3545' }]}
                  onPress={() => hapusSurat(suratPilih)}
                >
                  <Text style={S.btnFullGreenText}>🗑️ Hapus Data Ini</Text>
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity style={S.btnCloseStrong} onPress={() => setModalVisible(false)}>
              <Text style={S.btnCloseText}>Tutup</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={modalFileVisible} animationType="slide" transparent onRequestClose={() => setModalFileVisible(false)}>
        <View style={S.modalBg}>
          <View style={S.modalContentTall}>
            <Text style={S.modalTitle}>📎 {listFileTampil.length} File dari Staf</Text>
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

      <Modal visible={modalBayar} animationType="slide" transparent onRequestClose={tutupModalBayar}>
        <View style={S.modalBg}>
          <View style={S.modalContent}>
            {stepBayar === 1 && (
              <View>
                <Text style={S.modalTitle}>📄 Beli Kuota Dokumen</Text>
                <Text style={S.textCenterMuted}>Per-Document Fee — bayar sesuai jumlah dokumen</Text>

                <TouchableOpacity style={S.cardPaket} onPress={() => pilihPaket('Paket Basic (50 Dokumen)', 'Rp 100.000')}>
                  <Text style={[S.textAccentBlue, { fontSize: 16 }]}>Paket Basic</Text>
                  <Text style={S.textSmall}>50 Kuota Dokumen</Text>
                  <Text style={[S.textAccentGreen, S.mt10]}>Harga: Rp 100.000</Text>
                </TouchableOpacity>
                <TouchableOpacity style={S.cardPaket} onPress={() => pilihPaket('Paket Pro (1000 Dokumen)', 'Rp 500.000')}>
                  <Text style={[S.textAccentYellow, { fontSize: 16 }]}>Paket Pro</Text>
                  <Text style={S.textSmall}>1000 Kuota Dokumen</Text>
                  <Text style={[S.textAccentGreen, S.mt10]}>Harga: Rp 500.000</Text>
                </TouchableOpacity>
              </View>
            )}

            {stepBayar === 2 && pesanan && (
              <View style={{ alignItems: 'center' }}>
                <Text style={S.modalTitle}>Detail Pembayaran</Text>
                <View style={S.cardInvoice}>
                  <Text style={S.modalLabel}>Tanggal Pesanan:</Text>
                  <Text style={S.textPutih}>{pesanan.tanggal}</Text>
                  <Text style={S.modalLabel}>Paket Dipilih:</Text>
                  <Text style={S.textPutih}>{pesanan.paket}</Text>
                  <Text style={S.modalLabel}>Total Tagihan:</Text>
                  <Text style={[S.textAccentGreen, { fontSize: 18 }]}>{pesanan.harga}</Text>
                </View>
                <Text style={[S.textPutih, S.textCenter, { marginBottom: 15 }]}>Scan QRIS di bawah ini untuk membayar.</Text>
                <View style={S.qrWrapper}>
                  <QRCode value={`Bayar ${pesanan.paket}`} size={140} />
                </View>

                <TouchableOpacity style={S.btnFullGreen} onPress={konfirmasiBayarKuota}>
                  <Text style={S.btnFullGreenText}>✅ Konfirmasi Pembayaran</Text>
                </TouchableOpacity>

                <Text style={S.simNote}>(Simulasi — kuota langsung aktif)</Text>
              </View>
            )}

            <TouchableOpacity style={[S.btnCloseStrong, S.btnFullWidth, { marginTop: 20 }]} onPress={tutupModalBayar}>
              <Text style={S.btnCloseText}>{stepBayar === 1 ? 'Batal' : 'Tutup'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={modalLangganan} animationType="slide" transparent onRequestClose={tutupModalLangganan}>
        <View style={S.modalBg}>
          <View style={S.modalContent}>
            {stepLangganan === 1 && (
              <View>
                <Text style={S.modalTitle}>📅 Pilih Paket Langganan</Text>
                <Text style={S.textCenterMuted}>Subscription — biaya bulanan, unlimited dokumen</Text>

                <TouchableOpacity style={S.cardPaket} onPress={() => pilihPaketLangganan('Basic Bulanan', 'Rp 150.000', 1)}>
                  <Text style={[S.textAccentBlue, { fontSize: 16 }]}>Basic Bulanan</Text>
                  <Text style={S.textSmall}>1 Bulan Unlimited</Text>
                  <Text style={[S.textAccentGreen, S.mt10]}>Rp 150.000 / bulan</Text>
                </TouchableOpacity>

                <TouchableOpacity style={S.cardPaket} onPress={() => pilihPaketLangganan('Pro Quarterly', 'Rp 400.000', 3)}>
                  <Text style={[S.textAccentYellow, { fontSize: 16 }]}>Pro Quarterly</Text>
                  <Text style={S.textSmall}>3 Bulan Unlimited</Text>
                  <Text style={[S.textAccentGreen, S.mt10]}>Rp 400.000 / 3 bulan</Text>
                  <Text style={[S.listSuratTanggal, { marginTop: 3 }]}>Hemat 11% dari Basic</Text>
                </TouchableOpacity>

                <TouchableOpacity style={S.cardPaket} onPress={() => pilihPaketLangganan('Premium Yearly', 'Rp 1.200.000', 12)}>
                  <Text style={[S.textAccentGreen, { fontSize: 16 }]}>Premium Yearly</Text>
                  <Text style={S.textSmall}>12 Bulan Unlimited</Text>
                  <Text style={[S.textAccentGreen, S.mt10]}>Rp 1.200.000 / tahun</Text>
                  <Text style={[S.listSuratTanggal, { marginTop: 3 }]}>Hemat 33% dari Basic</Text>
                </TouchableOpacity>
              </View>
            )}

            {stepLangganan === 2 && pesananLangganan && (
              <View style={{ alignItems: 'center' }}>
                <Text style={S.modalTitle}>Detail Langganan</Text>
                <View style={S.cardInvoice}>
                  <Text style={S.modalLabel}>Tanggal Pesanan:</Text>
                  <Text style={S.textPutih}>{pesananLangganan.tanggal}</Text>
                  <Text style={S.modalLabel}>Paket Langganan:</Text>
                  <Text style={S.textPutih}>{pesananLangganan.paket}</Text>
                  <Text style={S.modalLabel}>Durasi:</Text>
                  <Text style={S.textPutih}>{pesananLangganan.durasiBulan} bulan</Text>
                  <Text style={S.modalLabel}>Total Tagihan:</Text>
                  <Text style={[S.textAccentGreen, { fontSize: 18 }]}>{pesananLangganan.harga}</Text>
                </View>
                <Text style={[S.textPutih, S.textCenter, { marginBottom: 15 }]}>Scan QRIS untuk membayar langganan.</Text>
                <View style={S.qrWrapper}>
                  <QRCode value={`Langganan ${pesananLangganan.paket}`} size={140} />
                </View>

                <TouchableOpacity style={S.btnFullGreen} onPress={konfirmasiBayarLangganan}>
                  <Text style={S.btnFullGreenText}>✅ Aktifkan Langganan</Text>
                </TouchableOpacity>

                <Text style={S.simNote}>(Simulasi — langsung aktif)</Text>
              </View>
            )}

            <TouchableOpacity style={[S.btnCloseStrong, S.btnFullWidth, { marginTop: 20 }]} onPress={tutupModalLangganan}>
              <Text style={S.btnCloseText}>{stepLangganan === 1 ? 'Batal' : 'Tutup'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={S.spacer40} />
    </ScrollView>
  );
}