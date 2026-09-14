import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const API_BASE = 'https://snowy-art-30d9.inventory-510.workers.dev';
const APP_VERSION = '0.1.0';

type User = { userName: string; secret: string; section?: string; isAdmin?: boolean | number };
type InventoryItem = { id?: string | number; name?: string; name_ar?: string; name_en?: string; itemName?: string; quantity?: number; qty?: number; stock?: number; image?: string; imageUrl?: string };
type MaintenanceEntry = { id?: string | number; title?: string; pump?: string; type?: string; workType?: string; workStatus?: string; workDetails?: string; date?: string; timestamp?: string; createdAt?: string; user?: string; employee?: string; notes?: string; status?: string };
type VisitRow = { userName: string; sessionId?: string; visitedAt: string; visitDate: string; visitHour: number };
type Screen = 'home' | 'inventory' | 'maintenance' | 'settings';

const colors = {
  navy: '#0B1F3A',
  navy2: '#12345C',
  blue: '#1677E8',
  cyan: '#12B8D8',
  green: '#0AAE78',
  orange: '#F59E0B',
  red: '#D9465F',
  ink: '#172033',
  muted: '#708096',
  line: '#E7EEF5',
  bg: '#F4F8FC',
  card: '#FFFFFF',
};

function isAdmin(user?: User | null) {
  return !!user && (user.userName === 'admin' || user.isAdmin === true || user.isAdmin === 1);
}

function parseData(payload: any) {
  return payload?.data !== undefined ? payload.data : payload?.record || payload || {};
}

async function api(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.message || `HTTP ${response.status}`);
  return body;
}

function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <View style={styles.sectionTitleRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      </View>
      {action}
    </View>
  );
}

function Metric({ value, label, accent }: { value: string | number; label: string; accent: string }) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricDot, { backgroundColor: accent }]} />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function Header({ user, onSettings }: { user: User; onSettings: () => void }) {
  return (
    <View style={styles.header}>
      <View style={styles.brandMark}><Text style={styles.brandMarkText}>م</Text></View>
      <View style={styles.headerCopy}>
        <Text style={styles.headerKicker}>النظام المتكامل</Text>
        <Text style={styles.headerUser}>{user.userName}</Text>
      </View>
      <Pressable onPress={onSettings} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
        <Text style={styles.iconButtonText}>⚙</Text>
      </Pressable>
    </View>
  );
}

function HomeScreen({ user, onNavigate, onSettings }: { user: User; onNavigate: (screen: Screen) => void; onSettings: () => void }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Header user={user} onSettings={onSettings} />
      <View style={styles.heroCard}>
        <View style={styles.heroGlow} />
        <Text style={styles.heroEyebrow}>إدارة ذكية في منصة واحدة</Text>
        <Text style={styles.heroTitle}>مرحبًا، {user.userName}</Text>
        <Text style={styles.heroText}>تحكم سريع وهادئ في المخزون والصيانة، مع بيانات موحدة وسجل واضح.</Text>
        <View style={styles.heroActions}>
          <Pressable onPress={() => onNavigate('inventory')} style={({ pressed }) => [styles.heroButton, pressed && styles.pressed]}>
            <Text style={styles.heroButtonText}>فتح المخزون  ←</Text>
          </Pressable>
          <Pressable onPress={() => onNavigate('maintenance')} style={({ pressed }) => [styles.heroButtonGhost, pressed && styles.pressed]}>
            <Text style={styles.heroButtonGhostText}>سجل الصيانة</Text>
          </Pressable>
        </View>
      </View>
      <SectionTitle title="الوصول السريع" subtitle="الأقسام الأساسية" />
      <View style={styles.quickGrid}>
        <Pressable onPress={() => onNavigate('inventory')} style={({ pressed }) => [styles.quickCard, pressed && styles.pressed]}>
          <View style={[styles.quickIcon, { backgroundColor: '#E5F0FF' }]}><Text style={styles.quickEmoji}>📦</Text></View>
          <Text style={styles.quickTitle}>المخزون</Text><Text style={styles.quickText}>الكميات والأصناف</Text>
        </Pressable>
        <Pressable onPress={() => onNavigate('maintenance')} style={({ pressed }) => [styles.quickCard, pressed && styles.pressed]}>
          <View style={[styles.quickIcon, { backgroundColor: '#E2FAF1' }]}><Text style={styles.quickEmoji}>🛠️</Text></View>
          <Text style={styles.quickTitle}>الصيانة</Text><Text style={styles.quickText}>السجل والأعمال</Text>
        </Pressable>
      </View>
      <View style={styles.infoStrip}>
        <Text style={styles.infoIcon}>☁</Text>
        <View style={{ flex: 1 }}><Text style={styles.infoTitle}>بياناتك محفوظة سحابيًا</Text><Text style={styles.infoText}>تتم مزامنة الحسابات والسجلات مع Cloudflare D1</Text></View>
        <Text style={styles.infoArrow}>‹</Text>
      </View>
      <Text style={styles.versionText}>الإصدار {APP_VERSION}</Text>
    </ScrollView>
  );
}

function InventoryScreen({ user }: { user: User }) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');

  const load = async () => {
    try {
      const body = await api('/inventory');
      const data = parseData(body);
      setItems(Array.isArray(data?.inventory) ? data.inventory : Array.isArray(data) ? data : []);
    } catch (e: any) { Alert.alert('تعذر تحميل المخزون', e.message); }
    finally { setLoading(false); setRefreshing(false); }
  };
  useEffect(() => { load(); }, []);
  const filtered = useMemo(() => items.filter((item) => String(item.name_ar || item.name || item.itemName || item.name_en || '').toLowerCase().includes(query.toLowerCase())), [items, query]);
  const low = items.filter((item) => Number(item.quantity ?? item.qty ?? item.stock ?? 0) <= 3).length;

  return (
    <View style={styles.screen}>
      <FlatList
        data={filtered}
        keyExtractor={(item, index) => String(item.id || item.name || item.itemName || index)}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.blue} />}
        ListHeaderComponent={<>
          <View style={styles.topBar}><View><Text style={styles.pageTitle}>المخزون</Text><Text style={styles.pageSubtitle}>متابعة الأصناف والكميات لحظة بلحظة</Text></View><View style={styles.pageBadge}><Text style={styles.pageBadgeText}>📦</Text></View></View>
          <View style={styles.inventoryStats}><Metric value={items.length} label="إجمالي الأصناف" accent={colors.blue} /><Metric value={low} label="منخفض المخزون" accent={colors.orange} /></View>
          <TextInput value={query} onChangeText={setQuery} placeholder="ابحث عن صنف..." placeholderTextColor="#9AA9BB" style={styles.search} textAlign="right" />
          <Text style={styles.listHeading}>قائمة الأصناف</Text>
          {loading && <ActivityIndicator color={colors.blue} style={{ marginVertical: 24 }} />}
        </>}
        renderItem={({ item }) => {
          const quantity = Number(item.quantity ?? item.qty ?? item.stock ?? item.qty ?? 0);
          const name = String(item.name_ar || item.name || item.itemName || item.name_en || 'صنف بدون اسم');
          return <View style={styles.inventoryRow}><View style={[styles.quantityPill, { backgroundColor: quantity <= 3 ? '#FFF4DF' : '#E6F8F0' }]}><Text style={[styles.quantityText, { color: quantity <= 3 ? '#B56A00' : '#087A51' }]}>{quantity}</Text></View><View style={{ flex: 1 }}><Text style={styles.itemName}>{name}</Text><Text style={styles.itemMeta}>{quantity <= 3 ? 'يحتاج متابعة' : 'متوفر'}</Text></View><Text style={styles.itemChevron}>‹</Text></View>;
        }}
        ListEmptyComponent={!loading ? <View style={styles.empty}><Text style={styles.emptyIcon}>📋</Text><Text style={styles.emptyTitle}>لا توجد أصناف</Text><Text style={styles.emptyText}>ستظهر بيانات المخزون بعد مزامنتها من السحابة.</Text></View> : null}
      />
    </View>
  );
}

function MaintenanceScreen() {
  const [entries, setEntries] = useState<MaintenanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const load = async () => { try { const body = await api('/maintenance'); const data = parseData(body); setEntries(Array.isArray(data?.maintenanceLog) ? data.maintenanceLog : []); } catch (e: any) { Alert.alert('تعذر تحميل الصيانة', e.message); } finally { setLoading(false); setRefreshing(false); } };
  useEffect(() => { load(); }, []);
  return <FlatList data={entries} keyExtractor={(item, index) => String(item.id || item.timestamp || item.createdAt || index)} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.green} />} ListHeaderComponent={<View style={styles.topBar}><View><Text style={styles.pageTitle}>الصيانة</Text><Text style={styles.pageSubtitle}>السجل الكامل لأعمال الصيانة</Text></View><View style={[styles.pageBadge, { backgroundColor: '#E2FAF1' }]}><Text style={styles.pageBadgeText}>🛠️</Text></View></View>} renderItem={({ item }) => <View style={styles.maintenanceRow}><View style={styles.maintenanceDate}><Text style={styles.maintenanceDateText}>{String(item.date || item.timestamp || item.createdAt || '—').slice(0, 10)}</Text></View><View style={{ flex: 1 }}><Text style={styles.itemName}>{item.title || item.pump || item.type || item.workType || 'عمل صيانة'}</Text><Text style={styles.itemMeta}>{item.user || item.employee || 'مسجل في النظام'}{item.status || item.workStatus ? ` · ${item.status || item.workStatus}` : ''}</Text>{!!(item.notes || item.workDetails) && <Text style={styles.maintenanceNotes}>{item.notes || item.workDetails}</Text>}</View></View>} ListEmptyComponent={!loading ? <View style={styles.empty}><Text style={styles.emptyIcon}>🧰</Text><Text style={styles.emptyTitle}>السجل فارغ</Text><Text style={styles.emptyText}>ستظهر أعمال الصيانة هنا بعد مزامنتها.</Text></View> : <ActivityIndicator color={colors.green} style={{ marginTop: 24 }} />} />;
}

function VisitModal({ visible, onClose, user }: { visible: boolean; onClose: () => void; user: User }) {
  const [rows, setRows] = useState<VisitRow[]>([]);
  const [loading, setLoading] = useState(false);
  const load = async () => { setLoading(true); try { const scope = isAdmin(user) ? 'all' : 'mine'; const body = await api(`/visits?scope=${scope}&user=${encodeURIComponent(user.userName)}`, { headers: { 'X-App-User': user.userName, 'X-App-Secret': user.secret, 'X-App-Role': isAdmin(user) ? 'admin' : 'employee' } }); setRows(Array.isArray(body?.visits) ? body.visits : []); } catch (e: any) { Alert.alert('تعذر تحميل الإحصائيات', e.message); } finally { setLoading(false); } };
  useEffect(() => { if (visible) load(); }, [visible]);
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = rows.filter((r) => String(r.visitDate).slice(0, 10) === today).length;
  const share = () => Share.share({ message: `تقرير دخول التطبيق\nالحساب: ${user.userName}\nإجمالي الدخول: ${rows.length}\nدخول اليوم: ${todayCount}` });
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.modalCard}><View style={styles.modalHead}><View><Text style={styles.modalTitle}>إحصائيات دخول التطبيق</Text><Text style={styles.modalSubtitle}>{isAdmin(user) ? 'عرض شامل لجميع الحسابات' : 'ملخص دخول حسابك'}</Text></View><Pressable onPress={onClose} style={styles.closeButton}><Text>×</Text></Pressable></View><View style={styles.modalMetrics}><Metric value={rows.length} label="إجمالي الدخول" accent={colors.blue} /><Metric value={todayCount} label="دخول اليوم" accent={colors.green} /></View>{loading ? <ActivityIndicator color={colors.blue} style={{ margin: 30 }} /> : <ScrollView style={{ maxHeight: 300 }}>{rows.slice(0, 60).map((row, index) => <View style={styles.visitRow} key={`${row.sessionId || row.visitedAt}-${index}`}><Text style={styles.visitTime}>{String(row.visitedAt || '').replace('T', ' ').slice(0, 16)}</Text><Text style={styles.visitUser}>{row.userName}</Text></View>)}</ScrollView>}<Pressable onPress={share} style={styles.shareButton}><Text style={styles.shareButtonText}>مشاركة التقرير</Text></Pressable></View></View></Modal>;
}

function SettingsModal({ visible, onClose, user, onLogout, onVisits }: { visible: boolean; onClose: () => void; user: User; onLogout: () => void; onVisits: () => void }) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.settingsCard}><View style={styles.settingsHero}><Text style={styles.settingsIcon}>⚙</Text><View style={{ flex: 1 }}><Text style={styles.settingsTitle}>الإعدادات والخيارات</Text><Text style={styles.settingsSubtitle}>تحكم هادئ في تجربة التطبيق</Text></View><Pressable onPress={onClose} style={styles.closeButton}><Text style={{ color: '#fff' }}>×</Text></Pressable></View><View style={styles.settingsBody}><View style={styles.accountTile}><View style={styles.avatar}><Text style={styles.avatarText}>{user.userName.slice(0, 1)}</Text></View><View style={{ flex: 1 }}><Text style={styles.accountName}>{user.userName}</Text><Text style={styles.accountRole}>{isAdmin(user) ? 'مسؤول النظام' : 'مستخدم'}</Text></View></View><Pressable onPress={onVisits} style={styles.settingRow}><Text style={styles.settingEmoji}>📊</Text><View style={{ flex: 1 }}><Text style={styles.settingTitle}>إحصائيات دخول التطبيق</Text><Text style={styles.settingText}>عرض السجل السحابي ومشاركته</Text></View><Text style={styles.itemChevron}>‹</Text></Pressable><View style={styles.settingRow}><Text style={styles.settingEmoji}>☁️</Text><View style={{ flex: 1 }}><Text style={styles.settingTitle}>المزامنة السحابية</Text><Text style={styles.settingText}>Cloudflare Worker و D1</Text></View><View style={styles.onlineDot} /></View><Pressable onPress={onLogout} style={[styles.settingRow, { marginTop: 10 }]}><Text style={styles.settingEmoji}>↪</Text><View style={{ flex: 1 }}><Text style={[styles.settingTitle, { color: colors.red }]}>تسجيل الخروج</Text><Text style={styles.settingText}>إنهاء الجلسة الحالية</Text></View></Pressable></View></View></View></Modal>;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [username, setUsername] = useState('');
  const [secret, setSecret] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [screen, setScreen] = useState<Screen>('home');
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [visitsVisible, setVisitsVisible] = useState(false);
  useEffect(() => {
    api('/users').then((body) => setUsers(Array.isArray(body?.users) ? body.users : [])).catch(() => undefined);
    AsyncStorage.getItem('inventory-maintenance-session').then((saved) => {
      if (saved) { try { setUser(JSON.parse(saved)); } catch { AsyncStorage.removeItem('inventory-maintenance-session'); } }
    });
  }, []);
  const login = async () => { setLoginLoading(true); try { const list = users.length ? users : (await api('/users')).users || []; const found = list.find((item: User) => item.userName === username.trim() && String(item.secret) === secret); if (!found) throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة'); const signed = { ...found, secret }; setUser(signed); setScreen('home'); await AsyncStorage.setItem('inventory-maintenance-session', JSON.stringify(signed)); api('/visits', { method: 'POST', headers: { 'X-App-User': signed.userName, 'X-App-Secret': signed.secret, 'X-App-Role': isAdmin(signed) ? 'admin' : 'employee' }, body: JSON.stringify({ sessionId: `native-${Date.now()}-${Math.random().toString(36).slice(2)}`, visitedAt: new Date().toISOString(), visitDate: new Date().toISOString().slice(0, 10), visitHour: new Date().getHours() }) }).catch(() => undefined); } catch (e: any) { Alert.alert('تعذر تسجيل الدخول', e.message); } finally { setLoginLoading(false); } };
  if (!user) return <SafeAreaView style={styles.loginSafe}><StatusBar style="light" /><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.loginWrap}><View style={styles.loginOrb} /><View style={styles.loginLogo}><Text style={styles.loginLogoText}>م</Text></View><Text style={styles.loginTitle}>النظام المتكامل</Text><Text style={styles.loginSubtitle}>إدارة المخزون والصيانة في منصة واحدة</Text><View style={styles.loginCard}><Text style={styles.loginCardTitle}>تسجيل الدخول</Text><Text style={styles.inputLabel}>اسم المستخدم</Text><TextInput value={username} onChangeText={setUsername} placeholder="أدخل اسم المستخدم" placeholderTextColor="#9AA9BB" style={styles.input} textAlign="right" autoCapitalize="none" /><Text style={styles.inputLabel}>كلمة المرور</Text><TextInput value={secret} onChangeText={setSecret} placeholder="أدخل كلمة المرور" placeholderTextColor="#9AA9BB" style={styles.input} textAlign="right" secureTextEntry onSubmitEditing={login} /><Pressable onPress={login} disabled={loginLoading} style={({ pressed }) => [styles.loginButton, pressed && styles.pressed, loginLoading && { opacity: 0.7 }]}>{loginLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginButtonText}>دخول آمن  ←</Text>}</Pressable></View><Text style={styles.loginFoot}>بياناتك محمية ومزامنة عبر السحابة</Text></KeyboardAvoidingView></SafeAreaView>;
  return <SafeAreaView style={styles.appSafe}><StatusBar style="dark" /><View style={styles.appBody}>{screen === 'home' && <HomeScreen user={user} onNavigate={setScreen} onSettings={() => setSettingsVisible(true)} />}{screen === 'inventory' && <InventoryScreen user={user} />}{screen === 'maintenance' && <MaintenanceScreen />}{screen === 'settings' && <HomeScreen user={user} onNavigate={setScreen} onSettings={() => setSettingsVisible(true)} />}</View><View style={styles.tabBar}>{[['home', '⌂', 'الرئيسية'], ['inventory', '▦', 'المخزون'], ['maintenance', '⚒', 'الصيانة'], ['settings', '⚙', 'الإعدادات']].map(([key, icon, label]) => <Pressable key={key} onPress={() => key === 'settings' ? setSettingsVisible(true) : setScreen(key as Screen)} style={({ pressed }) => [styles.tab, pressed && styles.pressed]}><Text style={[styles.tabIcon, screen === key && styles.tabIconActive]}>{icon}</Text><Text style={[styles.tabLabel, screen === key && styles.tabLabelActive]}>{label}</Text></Pressable>)}</View><SettingsModal visible={settingsVisible} onClose={() => setSettingsVisible(false)} user={user} onVisits={() => { setSettingsVisible(false); setTimeout(() => setVisitsVisible(true), 220); }} onLogout={() => { setSettingsVisible(false); setUser(null); setUsername(''); setSecret(''); AsyncStorage.removeItem('inventory-maintenance-session'); }} /><VisitModal visible={visitsVisible} onClose={() => setVisitsVisible(false)} user={user} /></SafeAreaView>;
}

const styles = StyleSheet.create({
  appSafe: { flex: 1, backgroundColor: colors.bg }, appBody: { flex: 1 }, screen: { flex: 1, backgroundColor: colors.bg }, content: { padding: 18, paddingBottom: 110 },
  header: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 18 }, brandMark: { width: 48, height: 48, borderRadius: 17, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center', shadowColor: colors.blue, shadowOpacity: 0.24, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 5 }, brandMarkText: { color: '#fff', fontSize: 24, fontWeight: '900' }, headerCopy: { flex: 1, alignItems: 'flex-end', marginRight: 12 }, headerKicker: { color: colors.muted, fontSize: 12, fontWeight: '700' }, headerUser: { color: colors.ink, fontSize: 20, fontWeight: '900', marginTop: 2 }, iconButton: { width: 44, height: 44, borderRadius: 16, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line }, iconButtonText: { color: colors.navy, fontSize: 23 }, pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  heroCard: { overflow: 'hidden', backgroundColor: colors.navy, borderRadius: 28, padding: 24, marginBottom: 26, shadowColor: colors.navy, shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 6 }, heroGlow: { position: 'absolute', width: 230, height: 230, borderRadius: 120, right: -70, top: -80, backgroundColor: '#1F5B90', opacity: 0.46 }, heroEyebrow: { color: '#8CC9F2', fontSize: 13, fontWeight: '800', textAlign: 'right' }, heroTitle: { color: '#fff', fontSize: 29, fontWeight: '900', textAlign: 'right', marginTop: 10 }, heroText: { color: '#BBD0E5', fontSize: 14, lineHeight: 24, textAlign: 'right', marginTop: 10 }, heroActions: { flexDirection: 'row-reverse', gap: 10, marginTop: 22 }, heroButton: { backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 15 }, heroButtonText: { color: colors.navy, fontSize: 13, fontWeight: '900' }, heroButtonGhost: { borderWidth: 1, borderColor: '#4D789D', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 15 }, heroButtonGhostText: { color: '#D8E9F7', fontSize: 13, fontWeight: '800' }, sectionTitleRow: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 12 }, sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: '900', textAlign: 'right' }, sectionSubtitle: { color: colors.muted, fontSize: 12, textAlign: 'right', marginTop: 3 }, quickGrid: { flexDirection: 'row-reverse', gap: 12 }, quickCard: { flex: 1, backgroundColor: '#fff', borderRadius: 22, padding: 16, borderWidth: 1, borderColor: colors.line, shadowColor: '#1D3850', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 2 }, quickIcon: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end', marginBottom: 13 }, quickEmoji: { fontSize: 23 }, quickTitle: { color: colors.ink, fontSize: 17, fontWeight: '900', textAlign: 'right' }, quickText: { color: colors.muted, fontSize: 12, textAlign: 'right', marginTop: 4 }, infoStrip: { flexDirection: 'row-reverse', alignItems: 'center', marginTop: 20, padding: 15, backgroundColor: '#EAF7FF', borderRadius: 18, borderWidth: 1, borderColor: '#D6EEFC', gap: 12 }, infoIcon: { color: colors.blue, fontSize: 25 }, infoTitle: { color: colors.navy, textAlign: 'right', fontSize: 13, fontWeight: '900' }, infoText: { color: colors.muted, textAlign: 'right', fontSize: 11, marginTop: 3 }, infoArrow: { fontSize: 27, color: colors.blue }, versionText: { textAlign: 'center', color: '#9AA9BB', fontSize: 11, marginTop: 22 },
  topBar: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 20 }, pageTitle: { fontSize: 28, fontWeight: '900', color: colors.ink, textAlign: 'right' }, pageSubtitle: { color: colors.muted, fontSize: 13, textAlign: 'right', marginTop: 4 }, pageBadge: { width: 55, height: 55, borderRadius: 20, backgroundColor: '#E5F0FF', alignItems: 'center', justifyContent: 'center', marginLeft: 14 }, pageBadgeText: { fontSize: 27 }, inventoryStats: { flexDirection: 'row-reverse', gap: 12, marginBottom: 18 }, metricCard: { flex: 1, backgroundColor: '#fff', borderRadius: 20, padding: 15, borderWidth: 1, borderColor: colors.line, minHeight: 84 }, metricDot: { width: 8, height: 8, borderRadius: 4, alignSelf: 'flex-end', marginBottom: 8 }, metricValue: { textAlign: 'right', color: colors.ink, fontSize: 25, fontWeight: '900' }, metricLabel: { textAlign: 'right', color: colors.muted, fontSize: 11, marginTop: 3 }, search: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, borderRadius: 17, paddingHorizontal: 16, paddingVertical: 13, fontSize: 14, color: colors.ink, marginBottom: 18 }, listHeading: { color: colors.ink, fontSize: 17, fontWeight: '900', textAlign: 'right', marginBottom: 10 }, inventoryRow: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 19, borderWidth: 1, borderColor: colors.line, marginBottom: 10 }, quantityPill: { minWidth: 45, height: 45, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginLeft: 12 }, quantityText: { fontSize: 18, fontWeight: '900' }, itemName: { color: colors.ink, fontSize: 15, fontWeight: '800', textAlign: 'right' }, itemMeta: { color: colors.muted, fontSize: 11, textAlign: 'right', marginTop: 4 }, itemChevron: { color: '#B3C0CD', fontSize: 28, marginRight: 10 }, empty: { alignItems: 'center', padding: 40 }, emptyIcon: { fontSize: 42, marginBottom: 12 }, emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' }, emptyText: { color: colors.muted, textAlign: 'center', marginTop: 6, lineHeight: 21 }, maintenanceRow: { flexDirection: 'row-reverse', alignItems: 'flex-start', backgroundColor: '#fff', padding: 15, borderRadius: 19, borderWidth: 1, borderColor: colors.line, marginBottom: 10 }, maintenanceDate: { backgroundColor: '#E2FAF1', borderRadius: 13, padding: 9, marginLeft: 12 }, maintenanceDateText: { color: '#087A51', fontSize: 11, fontWeight: '800' }, maintenanceNotes: { color: colors.muted, fontSize: 12, textAlign: 'right', marginTop: 5 },
  tabBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.line, flexDirection: 'row-reverse', paddingTop: 9, paddingBottom: Platform.OS === 'ios' ? 22 : 10 }, tab: { flex: 1, alignItems: 'center' }, tabIcon: { fontSize: 22, color: '#98A7B8' }, tabIconActive: { color: colors.blue }, tabLabel: { color: '#98A7B8', fontSize: 10, fontWeight: '700', marginTop: 3 }, tabLabelActive: { color: colors.blue },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(7,24,44,.55)', justifyContent: 'center', padding: 18 }, modalCard: { backgroundColor: '#fff', borderRadius: 28, padding: 18, maxHeight: '82%' }, modalHead: { flexDirection: 'row-reverse', alignItems: 'flex-start', marginBottom: 15 }, modalTitle: { color: colors.ink, fontSize: 20, fontWeight: '900', textAlign: 'right' }, modalSubtitle: { color: colors.muted, fontSize: 12, textAlign: 'right', marginTop: 4 }, closeButton: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginLeft: 10 }, modalMetrics: { flexDirection: 'row-reverse', gap: 10, marginBottom: 15 }, visitRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line }, visitUser: { color: colors.ink, fontWeight: '800' }, visitTime: { color: colors.muted, fontSize: 12 }, shareButton: { backgroundColor: colors.green, borderRadius: 16, padding: 14, alignItems: 'center', marginTop: 15 }, shareButtonText: { color: '#fff', fontWeight: '900' }, settingsCard: { backgroundColor: '#fff', borderRadius: 28, overflow: 'hidden' }, settingsHero: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: colors.blue, padding: 20 }, settingsIcon: { color: '#fff', fontSize: 26, marginLeft: 12 }, settingsTitle: { color: '#fff', fontSize: 19, fontWeight: '900', textAlign: 'right' }, settingsSubtitle: { color: '#D9EEFF', fontSize: 12, textAlign: 'right', marginTop: 3 }, settingsBody: { padding: 16 }, accountTile: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#F7FAFD', borderRadius: 18, padding: 13, marginBottom: 12 }, avatar: { width: 43, height: 43, borderRadius: 15, backgroundColor: '#D9ECFF', alignItems: 'center', justifyContent: 'center', marginLeft: 11 }, avatarText: { color: colors.blue, fontSize: 20, fontWeight: '900' }, accountName: { color: colors.ink, fontSize: 16, fontWeight: '900', textAlign: 'right' }, accountRole: { color: colors.muted, fontSize: 11, textAlign: 'right', marginTop: 2 }, settingRow: { flexDirection: 'row-reverse', alignItems: 'center', padding: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, borderRadius: 18, marginBottom: 9 }, settingEmoji: { fontSize: 22, marginLeft: 12 }, settingTitle: { color: colors.ink, fontSize: 14, fontWeight: '900', textAlign: 'right' }, settingText: { color: colors.muted, fontSize: 11, textAlign: 'right', marginTop: 3 }, onlineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.green },
  loginSafe: { flex: 1, backgroundColor: colors.navy }, loginWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22, overflow: 'hidden' }, loginOrb: { position: 'absolute', width: 370, height: 370, borderRadius: 200, backgroundColor: '#123D65', top: -100, right: -120, opacity: 0.7 }, loginLogo: { width: 82, height: 82, borderRadius: 29, backgroundColor: '#1C7FD5', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#6BD9F0', shadowColor: '#0EC1DA', shadowOpacity: 0.4, shadowRadius: 22, shadowOffset: { width: 0, height: 6 }, elevation: 6 }, loginLogoText: { color: '#fff', fontSize: 42, fontWeight: '900' }, loginTitle: { color: '#fff', fontSize: 28, fontWeight: '900', marginTop: 18 }, loginSubtitle: { color: '#B9D1E5', fontSize: 14, marginTop: 6, marginBottom: 25 }, loginCard: { width: '100%', backgroundColor: '#fff', borderRadius: 26, padding: 20, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 7 }, loginCardTitle: { color: colors.ink, fontSize: 20, fontWeight: '900', textAlign: 'right', marginBottom: 18 }, inputLabel: { color: colors.ink, fontSize: 12, fontWeight: '800', textAlign: 'right', marginBottom: 6, marginTop: 8 }, input: { backgroundColor: '#F6F9FC', borderWidth: 1, borderColor: colors.line, borderRadius: 15, paddingHorizontal: 14, paddingVertical: 13, color: colors.ink, fontSize: 14 }, loginButton: { backgroundColor: colors.blue, borderRadius: 16, padding: 15, alignItems: 'center', marginTop: 20, shadowColor: colors.blue, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 }, loginButtonText: { color: '#fff', fontSize: 15, fontWeight: '900' }, loginFoot: { color: '#7FA5C1', fontSize: 11, marginTop: 18 },
});
