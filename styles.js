import { StyleSheet } from 'react-native';

/* ═══════════════════════════════════════════════════════════════════════
   THEME: "Emerald Night"
   Deep emerald gradient · glass surfaces · one vivid mint accent.

   Colour carries meaning (this is an escrow marketplace, so money states matter):
     mint  = money you can touch / active / go
     gold  = held, pending, needs a response
     coral = dispute / destructive

   Every visual decision lives in COLORS, so re-skinning = editing this block.
   ═══════════════════════════════════════════════════════════════════════ */
export const COLORS = {
  // Screen background (3 stops look richer than 2):
  // <LinearGradient colors={[COLORS.bgTop, COLORS.bgMid, COLORS.bgBottom]} locations={[0, 0.4, 1]} style={styles.container}>
  bgTop: '#10412F',
  bgMid: '#0B2D21',
  bgBottom: '#071C14',

  // Accent
  primary: '#52E5A8',
  primaryDim: 'rgba(82, 229, 168, 0.14)', // tinted fills (pills, icon chips)
  primaryLine: 'rgba(82, 229, 168, 0.40)', // tinted borders
  onPrimary: '#04170F', // text / icons that sit ON the accent colour

  // Text
  text: '#F2FBF7',
  textSecondary: '#9DBBAE',
  placeholder: '#6F8E7F', // use for placeholderTextColor

  // GLASS surfaces: translucent, so whatever is behind shows through. The stylesheet below
  // uses these for things that sit directly on the gradient (cards, fields, chips).
  // Never use them for modals, sheets, menus or toasts.
  glass: 'rgba(255, 255, 255, 0.06)',
  glassActive: 'rgba(82, 229, 168, 0.10)',
  sunken: 'rgba(0, 0, 0, 0.28)', // fields + inset wells on glass
  surfaceRaised: 'rgba(255, 255, 255, 0.09)', // buttons / chips sitting on a surface
  inputBorder: 'rgba(255, 255, 255, 0.12)',
  border: 'rgba(255, 255, 255, 0.09)', // hairlines

  // SOLID surfaces: opaque, safe anywhere (modals, bottom sheets, dropdowns, toasts).
  // These keep your original token names, so existing components stay opaque.
  cardInactiveBg: '#17372A',
  cardActiveBg: '#1D4837',
  inputBg: '#10261D', // fields inside modals / solid cards
  surfaceSolid: '#123828', // avatars + anything that casts a shadow

  // Status
  warning: '#F4C77F',
  warningDim: 'rgba(244, 199, 127, 0.14)',
  warningLine: 'rgba(244, 199, 127, 0.45)',
  danger: '#FF6B6B',
  dangerDim: 'rgba(255, 107, 107, 0.12)',
  dangerLine: 'rgba(255, 107, 107, 0.45)',
};

/* ── TYPEFACE ────────────────────────────────────────────────────────────
   Uses the system font by default. To switch the whole app to a custom family,
   load it with expo-font first, then replace `null` below. Example:

   const FONT = {
     regular: 'PlusJakartaSans_400Regular',
     medium: 'PlusJakartaSans_500Medium',
     semibold: 'PlusJakartaSans_600SemiBold',
     bold: 'PlusJakartaSans_700Bold',
     heavy: 'PlusJakartaSans_800ExtraBold',
   };
   ──────────────────────────────────────────────────────────────────────── */
const FONT = null;
const WEIGHTS = { regular: '400', medium: '500', semibold: '600', bold: '700', heavy: '800' };
const font = (w) => (FONT ? { fontFamily: FONT[w] } : { fontWeight: WEIGHTS[w] });

// Radius scale: size follows hierarchy instead of one radius on everything
const RADIUS = { sm: 14, md: 16, lg: 22, xl: 28, pill: 999 };

/* Depth on a dark UI comes from lighter surfaces + hairline borders (black shadows vanish).
   Real shadows are kept for accent elements only. Never put a shadow on a translucent
   surface (it shows through the glass), so every `glow` element has a solid background. */
const glow = {
  shadowColor: COLORS.primary,
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.3,
  shadowRadius: 18,
  elevation: 8,
};
const glowSm = {
  shadowColor: COLORS.primary,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.22,
  shadowRadius: 10,
  elevation: 4,
};

export const styles = StyleSheet.create({
  // ── CORE LAYOUT (unchanged) ──
  container: { flex: 1 },
  safeArea: { flex: 1, padding: 20 },
  formContainer: { flex: 1, justifyContent: 'center', paddingHorizontal: 15, marginTop: 20 },
  scrollForm: { paddingHorizontal: 15, paddingBottom: 40, paddingTop: 20 },
  // Desktop-preview tip: add width: '100%', maxWidth: 760, alignSelf: 'center' to safeArea so
  // content stops stretching edge to edge on wide screens. No effect on phones.

  // ── TEXT ──
  headerText: { color: COLORS.text, fontSize: 28, ...font('bold'), textAlign: 'center', marginBottom: 8, letterSpacing: -0.6 },
  subtitle: { color: COLORS.textSecondary, textAlign: 'center', marginBottom: 40, fontSize: 14, lineHeight: 21, ...font('regular') },
  linkText: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 25, fontSize: 13, ...font('semibold') },
  forgotPassword: { color: COLORS.primary, textAlign: 'right', marginTop: -5, marginBottom: 35, fontSize: 13, ...font('semibold') },

  // ── AUTH HEADER ──
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, marginTop: 10 },
  headerTitle: { color: COLORS.text, fontSize: 17, ...font('semibold') },
  backBtn: { color: COLORS.primary, fontSize: 22, padding: 10 },

  // ── SEARCH SCREEN HEADER ──
  searchHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20, marginTop: 10, position: 'relative', height: 40 },
  searchProfileIcon: { position: 'absolute', right: 0, width: 38, height: 38, borderRadius: 19, borderColor: COLORS.primaryLine, borderWidth: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.primaryDim },

  // ── INPUTS ──
  input: { backgroundColor: COLORS.sunken, borderColor: COLORS.inputBorder, borderWidth: 1, borderRadius: RADIUS.md, padding: 18, color: COLORS.text, marginBottom: 20, fontSize: 15, ...font('regular') },
  // NEW (optional): style={[styles.input, focused && styles.inputFocused]}
  inputFocused: { borderColor: COLORS.primary, backgroundColor: 'rgba(82, 229, 168, 0.06)' },
  label: { color: COLORS.textSecondary, fontSize: 13, ...font('semibold'), marginBottom: 8, marginTop: 5, marginLeft: 4 },

  // ── BUTTONS ──
  primaryButton: { backgroundColor: COLORS.primary, paddingVertical: 18, borderRadius: 30, alignItems: 'center', width: '100%', marginTop: 10, ...glow },
  primaryButtonText: { color: COLORS.onPrimary, fontSize: 16, ...font('bold'), letterSpacing: 0.2 },

  // ── ACCOUNT TYPE CARDS ──
  typeCard: { borderWidth: 1.5, borderRadius: RADIUS.lg, padding: 20, marginBottom: 20, flexDirection: 'row', alignItems: 'center' },
  typeCardActive: { backgroundColor: COLORS.glassActive, borderColor: COLORS.primary },
  typeCardInactive: { backgroundColor: COLORS.glass, borderColor: COLORS.border },
  iconPlaceholder: { width: 44, height: 44, borderRadius: RADIUS.sm, backgroundColor: COLORS.primaryDim, marginRight: 15, justifyContent: 'center', alignItems: 'center' },
  cardTextContainer: { flex: 1 },
  typeTitle: { color: COLORS.text, fontSize: 16, ...font('bold'), marginBottom: 4 },
  typeDesc: { color: COLORS.textSecondary, fontSize: 13, paddingRight: 10, lineHeight: 19, ...font('regular') },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.28)' },
  radioActive: { borderColor: COLORS.primary, borderWidth: 7, backgroundColor: COLORS.onPrimary },

  // ── UPLOAD BOX ──
  uploadBox: { borderWidth: 1.5, borderColor: 'rgba(255, 255, 255, 0.20)', borderStyle: 'dashed', borderRadius: RADIUS.lg, padding: 30, alignItems: 'center', marginBottom: 30, backgroundColor: 'rgba(255, 255, 255, 0.03)' },
  uploadText: { color: COLORS.textSecondary, fontSize: 14, ...font('medium'), marginTop: 8 },

  // ── GET STARTED ──
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  logoText: { color: COLORS.text, fontSize: 28, ...font('heavy'), letterSpacing: 3, marginBottom: 40 },
  graphicPlaceholder: { alignItems: 'center', justifyContent: 'center', width: 220, height: 220, backgroundColor: COLORS.surfaceSolid, borderRadius: 32, borderWidth: 1, borderColor: COLORS.primaryLine, ...glow },
  circleGraphic: { width: 90, height: 90, borderRadius: 45, backgroundColor: COLORS.primary, marginBottom: 8 },
  baseGraphic: { width: 46, height: 46, borderBottomLeftRadius: 23, borderBottomRightRadius: 23, backgroundColor: COLORS.primary },

  // ── SEARCH SCREEN ──
  searchContainer: { flexDirection: 'row', backgroundColor: COLORS.sunken, borderColor: COLORS.inputBorder, borderWidth: 1, borderRadius: RADIUS.md, padding: 14, alignItems: 'center', marginBottom: 15, marginTop: 10 },
  searchInput: { flex: 1, color: COLORS.text, marginLeft: 10, fontSize: 15, ...font('regular') },
  filterRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  filterPill: { flexDirection: 'row', backgroundColor: COLORS.glass, borderColor: COLORS.border, borderWidth: 1, borderRadius: RADIUS.pill, paddingVertical: 8, paddingHorizontal: 16, alignItems: 'center' },
  filterText: { color: COLORS.text, fontSize: 13, ...font('semibold'), marginRight: 6 },

  // ── FREELANCER CARD ──
  freelancerCard: { backgroundColor: COLORS.glass, borderColor: COLORS.border, borderWidth: 1, borderRadius: RADIUS.lg, padding: 18, marginBottom: 15 },
  fcTopRow: { flexDirection: 'row', justifyContent: 'space-between' },
  fcLeftInfo: { flexDirection: 'row', flex: 1 },
  fcAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: COLORS.surfaceRaised, justifyContent: 'center', alignItems: 'center', marginRight: 14, borderWidth: 1, borderColor: COLORS.border },
  fcNameRole: { flex: 1, justifyContent: 'center' },
  fcName: { color: COLORS.text, fontSize: 16, ...font('bold'), letterSpacing: -0.2 },
  fcRole: { color: COLORS.textSecondary, fontSize: 13, marginTop: 3, ...font('regular') },
  fcLocationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  fcLocationText: { color: COLORS.textSecondary, fontSize: 12, marginLeft: 6, ...font('medium') },
  fcRightInfo: { alignItems: 'flex-end', justifyContent: 'flex-start' },
  fcRatingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, backgroundColor: COLORS.warningDim, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  fcRatingText: { color: COLORS.warning, fontSize: 12, ...font('bold'), marginLeft: 4 },
  fcPrice: { color: COLORS.primary, fontSize: 15, ...font('bold') },
  bookBtn: { backgroundColor: COLORS.primaryDim, borderColor: COLORS.primaryLine, borderWidth: 1, paddingVertical: 14, borderRadius: RADIUS.md, alignItems: 'center', marginTop: 18 },
  bookBtnText: { color: COLORS.primary, fontSize: 14, ...font('bold') },

  // ── PROFILE SCREEN ──
  profileAvatarContainer: { alignItems: 'center', marginVertical: 25 },
  profileAvatar: { width: 90, height: 90, borderRadius: 45, backgroundColor: COLORS.surfaceSolid, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.primary, ...glowSm },
  profileName: { color: COLORS.text, fontSize: 22, ...font('bold'), marginTop: 15, letterSpacing: -0.4 },
  profileRole: { color: COLORS.primary, fontSize: 12, ...font('bold'), letterSpacing: 0.6, marginTop: 6 },
  sectionTitle: { color: COLORS.textSecondary, fontSize: 14, ...font('semibold'), marginBottom: 12, marginTop: 25 },
  infoCard: { backgroundColor: COLORS.glass, borderColor: COLORS.border, borderWidth: 1, borderRadius: RADIUS.lg, padding: 20 },
  infoLabel: { color: COLORS.textSecondary, fontSize: 12, ...font('medium'), marginBottom: 4 },
  infoValue: { color: COLORS.text, fontSize: 15, ...font('medium'), marginBottom: 16 },
  listItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  listLeft: { flexDirection: 'row', alignItems: 'center' },
  listText: { color: COLORS.text, fontSize: 15, ...font('medium'), marginLeft: 15 },
  logoutBtn: { backgroundColor: COLORS.dangerDim, borderColor: COLORS.dangerLine, borderWidth: 1, paddingVertical: 16, borderRadius: 30, alignItems: 'center', marginTop: 35, flexDirection: 'row', justifyContent: 'center' },
  logoutText: { color: COLORS.danger, fontSize: 15, ...font('bold'), marginLeft: 10 },

  // ── MESSAGES & BOOKINGS SHARED HEADER ──
  pageHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 25, marginTop: 10 },
  pageTitle: { color: COLORS.text, fontSize: 28, ...font('bold'), letterSpacing: -0.6 },
  headerIconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.surfaceRaised, borderColor: COLORS.border, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },

  // ── MESSAGES SCREEN ──
  msgCard: { backgroundColor: COLORS.glass, borderColor: COLORS.border, borderWidth: 1, borderRadius: RADIUS.lg, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center' },
  msgAvatarContainer: { position: 'relative', marginRight: 15 },
  msgAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: COLORS.surfaceRaised, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  unreadDot: { position: 'absolute', top: -2, right: -2, width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.primary, borderWidth: 2.5, borderColor: COLORS.bgMid },
  msgContent: { flex: 1 },
  msgTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  msgNameRow: { flexDirection: 'row', alignItems: 'center' },
  msgName: { color: COLORS.text, fontSize: 15, ...font('bold') },
  msgRole: { color: COLORS.primary, fontSize: 11, ...font('semibold'), marginLeft: 8 },
  msgTime: { color: COLORS.textSecondary, fontSize: 12, ...font('medium') },
  msgPreview: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 20, ...font('regular') },
  msgPreviewUnread: { color: COLORS.text, fontSize: 14, lineHeight: 20, ...font('semibold') },

  // ── BOOKINGS SCREEN ──
  tabRow: { flexDirection: 'row', marginBottom: 25, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tabBtn: { paddingVertical: 12, marginRight: 24, position: 'relative' },
  tabText: { color: COLORS.textSecondary, fontSize: 15, ...font('semibold') },
  tabTextActive: { color: COLORS.primary },
  tabIndicator: { position: 'absolute', bottom: -1, left: 0, right: 0, height: 3, backgroundColor: COLORS.primary, borderTopLeftRadius: 3, borderTopRightRadius: 3 },

  bookingCard: { backgroundColor: COLORS.glass, borderColor: COLORS.border, borderWidth: 1, borderRadius: RADIUS.lg, padding: 18, marginBottom: 16 },
  bookingTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  statusPill: { backgroundColor: COLORS.primaryDim, borderWidth: 1, borderColor: COLORS.primaryLine, borderRadius: RADIUS.pill, paddingVertical: 5, paddingHorizontal: 12 },
  statusText: { color: COLORS.primary, fontSize: 11, ...font('bold'), letterSpacing: 0.6 },
  bookingTitle: { color: COLORS.text, fontSize: 17, ...font('bold'), marginBottom: 6, letterSpacing: -0.3 },
  bookingDetails: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 4, ...font('regular') },
  bookingBtnRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  btnHalf: { flex: 1, paddingVertical: 14, borderRadius: RADIUS.md, alignItems: 'center' },
  btnDark: { backgroundColor: COLORS.surfaceRaised, borderWidth: 1, borderColor: COLORS.border, marginRight: 10 },
  btnDarkText: { color: COLORS.text, fontSize: 14, ...font('semibold') },
  btnPrimary: { backgroundColor: COLORS.primary, marginLeft: 10, ...glowSm },
  btnPrimaryText: { color: COLORS.onPrimary, fontSize: 14, ...font('bold') },
  btnWarning: { backgroundColor: COLORS.warning, marginLeft: 10 },

  // ── CHAT SCREEN ──
  chatHeaderBg: { backgroundColor: COLORS.glass, borderColor: COLORS.border, borderWidth: 1, borderTopWidth: 0, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, paddingBottom: 15, paddingTop: 15, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chatHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  chatAvatarWrapper: { position: 'relative', marginRight: 12, marginLeft: 10 },
  chatHeaderAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.surfaceSolid, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.primary },
  onlineDot: { position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.primary, borderWidth: 2, borderColor: COLORS.bgMid },
  chatHeaderName: { color: COLORS.text, fontSize: 16, ...font('bold') },
  chatHeaderStatus: { color: COLORS.primary, fontSize: 12, ...font('medium'), marginTop: 2 },
  detailsBtn: { backgroundColor: COLORS.surfaceRaised, borderColor: COLORS.border, borderWidth: 1, borderRadius: RADIUS.md, paddingVertical: 8, paddingHorizontal: 14 },
  detailsBtnText: { color: COLORS.text, fontSize: 12, ...font('semibold') },

  chatArea: { flex: 1, paddingHorizontal: 20 },
  datePillWrapper: { alignItems: 'center', marginVertical: 20 },
  datePill: { backgroundColor: COLORS.glass, borderColor: COLORS.border, borderWidth: 1, paddingVertical: 6, paddingHorizontal: 16, borderRadius: 14 },
  datePillText: { color: COLORS.textSecondary, fontSize: 11, ...font('semibold'), letterSpacing: 0.4 },

  msgRow: { flexDirection: 'row', marginBottom: 18, alignItems: 'flex-end' },
  msgRowSent: { justifyContent: 'flex-end' },
  msgRowReceived: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '75%', paddingVertical: 12, paddingHorizontal: 16, borderRadius: RADIUS.lg },
  bubbleSent: { backgroundColor: COLORS.primary, borderBottomRightRadius: 6 },
  bubbleReceived: { backgroundColor: COLORS.surfaceRaised, borderColor: COLORS.border, borderWidth: 1, borderBottomLeftRadius: 6 },
  bubbleTextSent: { color: COLORS.onPrimary, fontSize: 15, lineHeight: 21, ...font('medium') },
  bubbleTextReceived: { color: COLORS.text, fontSize: 15, lineHeight: 21, ...font('regular') },
  msgTimestamp: { color: COLORS.textSecondary, fontSize: 11, marginHorizontal: 10, marginBottom: 4, ...font('medium') },

  inputArea: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 15, backgroundColor: COLORS.bgBottom, borderTopWidth: 1, borderTopColor: COLORS.border },
  plusIconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surfaceRaised, borderColor: COLORS.border, borderWidth: 1, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  chatInputWrapper: { flex: 1, backgroundColor: COLORS.sunken, borderColor: COLORS.inputBorder, borderWidth: 1, borderRadius: 24, paddingHorizontal: 18, height: 46, justifyContent: 'center' },
  chatInput: { color: COLORS.text, fontSize: 15, ...font('regular') },
  sendBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginLeft: 12, ...glowSm },

  // ── FREELANCER HOME DASHBOARD ──
  fhHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30, marginTop: 10 },
  fhHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  fhGreetingRow: { marginLeft: 14 },
  fhGreeting: { color: COLORS.textSecondary, fontSize: 13, ...font('medium') },
  fhName: { color: COLORS.text, fontSize: 19, ...font('bold'), letterSpacing: -0.3 },
  bellIconWrapper: { position: 'relative', width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.surfaceRaised, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  notificationDot: { position: 'absolute', top: 10, right: 12, width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.danger, borderWidth: 2, borderColor: COLORS.bgMid },

  // The one loud element on the dashboard: everything else stays quiet so this lands.
  earningsCard: { backgroundColor: COLORS.primary, borderRadius: RADIUS.xl, padding: 24, marginBottom: 30, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.35)', ...glow },
  earningsLabel: { color: COLORS.onPrimary, fontSize: 13, ...font('semibold'), marginBottom: 8, opacity: 0.7 },
  earningsAmount: { color: COLORS.onPrimary, fontSize: 40, ...font('heavy'), marginBottom: 20, letterSpacing: -1.2 },
  escrowRow: { borderTopWidth: 1, borderTopColor: 'rgba(4, 23, 15, 0.14)', paddingTop: 16 },
  escrowText: { color: COLORS.onPrimary, fontSize: 13, ...font('semibold'), opacity: 0.85 },

  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18 },
  sectionTitleMain: { color: COLORS.text, fontSize: 17, ...font('bold'), letterSpacing: -0.3 },
  viewAllText: { color: COLORS.primary, fontSize: 13, ...font('semibold') },

  requestCard: { backgroundColor: 'rgba(244, 199, 127, 0.07)', borderColor: COLORS.warningLine, borderWidth: 1, borderRadius: RADIUS.lg, padding: 18, marginBottom: 20 },
  requestTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  requestClientInfo: { flexDirection: 'row', flex: 1 },
  clientInitialAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.warningDim, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  clientInitialText: { color: COLORS.warning, fontSize: 16, ...font('heavy') },
  requestClientName: { color: COLORS.text, fontSize: 15, ...font('bold') },
  requestProjectTitle: { color: COLORS.textSecondary, fontSize: 13, marginTop: 4, ...font('regular') },
  requestPriceRight: { alignItems: 'flex-end' },
  requestPriceText: { color: COLORS.text, fontSize: 16, ...font('heavy') },
  requestLocationText: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4, ...font('medium') },
  requestBtnRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  declineBtn: { flex: 1, backgroundColor: COLORS.surfaceRaised, borderColor: COLORS.border, borderWidth: 1, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center', marginRight: 10 },
  declineBtnText: { color: COLORS.text, fontSize: 14, ...font('semibold') },
  acceptBtn: { flex: 1, backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center', marginLeft: 10, ...glowSm },
  acceptBtnText: { color: COLORS.onPrimary, fontSize: 14, ...font('bold') },

  activeProjectCard: { backgroundColor: COLORS.glass, borderColor: COLORS.border, borderWidth: 1, borderRadius: RADIUS.lg, padding: 0, marginBottom: 18, flexDirection: 'row', overflow: 'hidden' },
  verticalAccent: { width: 5, backgroundColor: COLORS.primary, height: '100%' },
  apContent: { flex: 1, padding: 18 },
  apTitle: { color: COLORS.text, fontSize: 16, ...font('bold'), marginBottom: 4 },
  apClient: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 18, ...font('regular') },
  progressRow: { flexDirection: 'row', alignItems: 'center' },
  progressBarBg: { flex: 1, height: 6, backgroundColor: 'rgba(255, 255, 255, 0.10)', borderRadius: 3, marginRight: 12 },
  progressBarFill: { height: 6, backgroundColor: COLORS.primary, borderRadius: 3 },
  progressText: { color: COLORS.primary, fontSize: 12, ...font('bold') },

  // ── SERVICES SCREEN ──
  serviceCard: { backgroundColor: COLORS.glass, borderColor: COLORS.border, borderWidth: 1, borderRadius: RADIUS.lg, padding: 18, marginBottom: 16 },
  serviceTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  serviceTitleRow: { flex: 1, paddingRight: 12 },
  serviceTitle: { color: COLORS.text, fontSize: 17, ...font('bold'), letterSpacing: -0.3 },
  serviceCategory: { color: COLORS.primary, fontSize: 13, ...font('semibold'), marginTop: 4, marginBottom: 18 },
  servicePriceRight: { alignItems: 'flex-end' },
  servicePriceText: { color: COLORS.text, fontSize: 17, ...font('heavy') },
  serviceRateType: { color: COLORS.textSecondary, fontSize: 12, ...font('medium'), marginTop: 2 },
  serviceStatsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.sunken, padding: 12, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border },
  serviceStatCol: { flex: 1 },
  statLine: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  statDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.warning, marginRight: 8 },
  statDotCompleted: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, marginRight: 8 },
  statText: { color: COLORS.text, fontSize: 13, ...font('medium') },
  visibilityToggle: { flexDirection: 'row', alignItems: 'center' },
  visibilityText: { color: COLORS.textSecondary, fontSize: 12, ...font('semibold'), marginRight: 8 },

  // ── NEW (optional): status variants ──
  // Layer them on the base style, e.g.
  //   <View style={[styles.activeProjectCard, isDispute && styles.activeProjectCardDanger]}>
  //   <View style={[styles.statusPill, isDispute && styles.statusPillDanger]}>
  activeProjectCardDanger: { borderColor: COLORS.dangerLine, backgroundColor: COLORS.dangerDim },
  verticalAccentDanger: { backgroundColor: COLORS.danger },
  progressBarFillDanger: { backgroundColor: COLORS.danger },
  progressTextDanger: { color: COLORS.danger },
  statusPillDanger: { backgroundColor: COLORS.dangerDim, borderColor: COLORS.dangerLine },
  statusTextDanger: { color: COLORS.danger },
  statusPillWarning: { backgroundColor: COLORS.warningDim, borderColor: COLORS.warningLine },
  statusTextWarning: { color: COLORS.warning },
});

/* ── NEW (optional): bottom tab bar ──────────────────────────────────────
   Your tab bar is styled outside this file. If you use React Navigation:
   <Tab.Navigator screenOptions={{ headerShown: false, ...TAB_BAR_OPTIONS }}> */
export const TAB_BAR_OPTIONS = {
  tabBarActiveTintColor: COLORS.primary,
  tabBarInactiveTintColor: COLORS.textSecondary,
  tabBarStyle: { backgroundColor: COLORS.bgBottom, borderTopColor: COLORS.border, borderTopWidth: 1 },
  tabBarLabelStyle: { fontSize: 11, ...font('semibold') },
};