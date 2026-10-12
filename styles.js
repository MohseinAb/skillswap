import { StyleSheet } from 'react-native';

export const COLORS = {
  bgTop: '#1B362A',
  bgBottom: '#0A130F',
  primary: '#84DCC6',
  text: '#FFFFFF',
  textSecondary: '#6B8A7A',
  
  inputBg: '#0D1A15', 
  inputBorder: '#1A3328',
  
  // Card states
  cardActiveBg: '#152E24',
  cardInactiveBg: '#0B1612',
};

export const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: 20 },
  formContainer: { flex: 1, justifyContent: 'center', paddingHorizontal: 15, marginTop: 20 },
  scrollForm: { paddingHorizontal: 15, paddingBottom: 40, paddingTop: 20 },
  
  // Text
  headerText: { color: COLORS.text, fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  subtitle: { color: COLORS.textSecondary, textAlign: 'center', marginBottom: 40, fontSize: 13 },
  linkText: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 25, fontSize: 12 },
  forgotPassword: { color: COLORS.textSecondary, textAlign: 'right', marginTop: -5, marginBottom: 35, fontSize: 11 },
  
  // Auth Header
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, marginTop: 10 },
  headerTitle: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  backBtn: { color: COLORS.primary, fontSize: 20, padding: 10 },

  // Search Screen Header (New centered layout)
  searchHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20, marginTop: 10, position: 'relative', height: 40 },
  searchProfileIcon: { position: 'absolute', right: 0, width: 36, height: 36, borderRadius: 18, borderColor: COLORS.primary, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },

  // Inputs
  input: {
    backgroundColor: COLORS.inputBg,
    borderColor: COLORS.inputBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 18,
    color: COLORS.text,
    marginBottom: 20,
    fontSize: 14,
  },
  label: { color: COLORS.textSecondary, fontSize: 11, marginBottom: 8, marginTop: 5 },
  
  // Buttons - Pill shape
  primaryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
    width: '100%',
    marginTop: 10,
  },
  primaryButtonText: { color: '#000000', fontWeight: 'bold', fontSize: 15 },
  
  // Account Type Cards
  typeCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeCardActive: { 
    backgroundColor: COLORS.cardActiveBg, 
    borderColor: COLORS.primary 
  },
  typeCardInactive: { 
    backgroundColor: COLORS.cardInactiveBg, 
    borderColor: COLORS.inputBorder 
  },
  iconPlaceholder: {
    width: 40, height: 40, 
    borderRadius: 8, 
    backgroundColor: 'rgba(132, 220, 198, 0.1)', 
    marginRight: 15,
  },
  cardTextContainer: { flex: 1 },
  typeTitle: { color: COLORS.text, fontSize: 15, fontWeight: 'bold', marginBottom: 4 },
  typeDesc: { color: COLORS.textSecondary, fontSize: 11, paddingRight: 10, lineHeight: 16 },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: COLORS.textSecondary,
  },
  radioActive: { 
    borderColor: COLORS.primary, 
    borderWidth: 6, 
    backgroundColor: '#000' 
  },

  // Upload Box
  uploadBox: {
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
    marginBottom: 30,
    backgroundColor: 'rgba(13, 26, 21, 0.5)',
  },
  uploadText: { color: COLORS.textSecondary, fontSize: 12 },

  // Get Started Screen
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  logoText: { color: COLORS.text, fontSize: 24, fontWeight: 'bold', letterSpacing: 2, marginBottom: 40 },
  graphicPlaceholder: { alignItems: 'center', justifyContent: 'center', width: 200, height: 200, backgroundColor: COLORS.cardActiveBg, borderRadius: 20 },
  circleGraphic: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primary, marginBottom: 5 },
  baseGraphic: { width: 40, height: 40, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, backgroundColor: COLORS.primary },

  // --- SEARCH SCREEN STYLES ---
  searchContainer: { flexDirection: 'row', backgroundColor: COLORS.inputBg, borderRadius: 10, padding: 12, alignItems: 'center', marginBottom: 15, marginTop: 10 },
  searchInput: { flex: 1, color: COLORS.text, marginLeft: 10 },
  filterRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  filterPill: { flexDirection: 'row', borderColor: COLORS.inputBorder, borderWidth: 1, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 15, alignItems: 'center' },
  filterText: { color: COLORS.textSecondary, fontSize: 11, marginRight: 5 },
  
  // --- FREELANCER CARD STYLES ---
  freelancerCard: { backgroundColor: COLORS.cardInactiveBg, borderColor: COLORS.inputBorder, borderWidth: 1, borderRadius: 15, padding: 15, marginBottom: 15 },
  fcTopRow: { flexDirection: 'row', justifyContent: 'space-between' },
  fcLeftInfo: { flexDirection: 'row', flex: 1 },
  fcAvatar: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: COLORS.inputBg, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  fcNameRole: { flex: 1, justifyContent: 'center' },
  fcName: { color: COLORS.text, fontWeight: 'bold', fontSize: 15 },
  fcRole: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  fcLocationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  fcLocationText: { color: COLORS.textSecondary, fontSize: 10, marginLeft: 4 },
  fcRightInfo: { alignItems: 'flex-end', justifyContent: 'flex-end' },
  fcRatingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  fcRatingText: { color: COLORS.text, fontWeight: 'bold', fontSize: 12, marginLeft: 2 },
  fcPrice: { color: COLORS.text, fontWeight: 'bold', fontSize: 13 },
  bookBtn: { backgroundColor: COLORS.primary, paddingVertical: 12, borderRadius: 20, alignItems: 'center', marginTop: 15 },
  bookBtnText: { color: '#000', fontWeight: 'bold', fontSize: 13 },

  // --- PROFILE SCREEN STYLES ---
  profileAvatarContainer: { alignItems: 'center', marginVertical: 20 },
  profileAvatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.inputBg, justifyContent: 'center', alignItems: 'center' },
  profileName: { color: COLORS.text, fontSize: 18, fontWeight: 'bold', marginTop: 12 },
  profileRole: { color: COLORS.textSecondary, fontSize: 10, letterSpacing: 1, marginTop: 4 },
  sectionTitle: { color: COLORS.textSecondary, fontSize: 11, fontWeight: 'bold', marginBottom: 10, marginTop: 20 },
  infoCard: { backgroundColor: COLORS.cardInactiveBg, borderColor: COLORS.inputBorder, borderWidth: 1, borderRadius: 12, padding: 15 },
  infoLabel: { color: COLORS.textSecondary, fontSize: 10, marginBottom: 2 },
  infoValue: { color: COLORS.text, fontSize: 13, marginBottom: 12 },
  listItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: COLORS.inputBorder },
  listLeft: { flexDirection: 'row', alignItems: 'center' },
  listText: { color: COLORS.text, fontSize: 13, marginLeft: 15 },
  logoutBtn: { borderColor: '#FF4C4C', borderWidth: 1, paddingVertical: 15, borderRadius: 30, alignItems: 'center', marginTop: 30, flexDirection: 'row', justifyContent: 'center' },
  logoutText: { color: '#FF4C4C', fontWeight: 'bold', fontSize: 14, marginLeft: 10 },

// --- MESSAGES & BOOKINGS SHARED HEADER ---
  pageHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, marginTop: 10 },
  pageTitle: { color: COLORS.text, fontSize: 22, fontWeight: 'bold' },
  headerIconBtn: { width: 36, height: 36, borderRadius: 18, borderColor: COLORS.textSecondary, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },

  // --- MESSAGES SCREEN ---
  msgCard: { backgroundColor: COLORS.cardInactiveBg, borderColor: COLORS.inputBorder, borderWidth: 1, borderRadius: 15, padding: 15, marginBottom: 12, flexDirection: 'row', alignItems: 'center' },
  msgAvatarContainer: { position: 'relative', marginRight: 15 },
  msgAvatar: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: COLORS.inputBg, justifyContent: 'center', alignItems: 'center' },
  unreadDot: { position: 'absolute', top: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.primary, borderWidth: 2, borderColor: COLORS.cardInactiveBg },
  msgContent: { flex: 1 },
  msgTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  msgNameRow: { flexDirection: 'row', alignItems: 'center' },
  msgName: { color: COLORS.text, fontWeight: 'bold', fontSize: 14 },
  msgRole: { color: COLORS.textSecondary, fontSize: 11, marginLeft: 6 },
  msgTime: { color: COLORS.textSecondary, fontSize: 10 },
  msgPreview: { color: COLORS.textSecondary, fontSize: 12 },
  msgPreviewUnread: { color: COLORS.text, fontWeight: '600' },

  // --- BOOKINGS SCREEN ---
  tabRow: { flexDirection: 'row', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: COLORS.inputBorder },
  tabBtn: { paddingVertical: 10, marginRight: 20, position: 'relative' },
  tabText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: COLORS.primary },
  tabIndicator: { position: 'absolute', bottom: -1, left: 0, right: 0, height: 2, backgroundColor: COLORS.primary },
  
  bookingCard: { backgroundColor: COLORS.cardInactiveBg, borderColor: COLORS.inputBorder, borderWidth: 1, borderRadius: 15, padding: 15, marginBottom: 15 },
  bookingTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  statusPill: { borderWidth: 1, borderColor: COLORS.textSecondary, borderRadius: 12, paddingVertical: 4, paddingHorizontal: 10 },
  statusText: { color: COLORS.textSecondary, fontSize: 9, fontWeight: 'bold', letterSpacing: 1 },
  bookingTitle: { color: COLORS.text, fontSize: 15, fontWeight: 'bold', marginBottom: 4 },
  bookingDetails: { color: COLORS.textSecondary, fontSize: 11, marginBottom: 2 },
  bookingBtnRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
  btnHalf: { flex: 1, paddingVertical: 12, borderRadius: 20, alignItems: 'center' },
  btnDark: { backgroundColor: COLORS.inputBg, borderWidth: 1, borderColor: COLORS.inputBorder, marginRight: 10 },
  btnDarkText: { color: COLORS.text, fontWeight: 'bold', fontSize: 12 },
  btnPrimary: { backgroundColor: COLORS.primary, marginLeft: 10 },
  btnPrimaryText: { color: '#000', fontWeight: 'bold', fontSize: 12 },
  btnWarning: { backgroundColor: '#F4C77F', marginLeft: 10 },


  // --- CHAT SCREEN STYLES ---
  chatHeaderBg: { backgroundColor: COLORS.cardInactiveBg, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, paddingBottom: 15, paddingTop: 10, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chatHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  chatAvatarWrapper: { position: 'relative', marginRight: 10, marginLeft: 10 },
  chatHeaderAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.inputBg, justifyContent: 'center', alignItems: 'center' },
  onlineDot: { position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary, borderWidth: 2, borderColor: COLORS.cardInactiveBg },
  chatHeaderName: { color: COLORS.text, fontSize: 15, fontWeight: 'bold' },
  chatHeaderStatus: { color: COLORS.textSecondary, fontSize: 10 },
  detailsBtn: { borderColor: COLORS.textSecondary, borderWidth: 1, borderRadius: 15, paddingVertical: 4, paddingHorizontal: 12 },
  detailsBtnText: { color: COLORS.textSecondary, fontSize: 10 },
  
  chatArea: { flex: 1, paddingHorizontal: 15 },
  datePillWrapper: { alignItems: 'center', marginVertical: 15 },
  datePill: { backgroundColor: COLORS.cardInactiveBg, paddingVertical: 4, paddingHorizontal: 12, borderRadius: 10 },
  datePillText: { color: COLORS.textSecondary, fontSize: 9, fontWeight: 'bold', letterSpacing: 1 },
  
  msgRow: { flexDirection: 'row', marginBottom: 15, alignItems: 'flex-end' },
  msgRowSent: { justifyContent: 'flex-end' },
  msgRowReceived: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '75%', padding: 15, borderRadius: 15 },
  bubbleSent: { backgroundColor: COLORS.primary, borderBottomRightRadius: 2 },
  bubbleReceived: { backgroundColor: COLORS.cardInactiveBg, borderColor: COLORS.inputBorder, borderWidth: 1, borderBottomLeftRadius: 2 },
  bubbleTextSent: { color: '#000', fontSize: 13, lineHeight: 18 },
  bubbleTextReceived: { color: COLORS.text, fontSize: 13, lineHeight: 18 },
  msgTimestamp: { color: COLORS.textSecondary, fontSize: 9, marginHorizontal: 8, marginBottom: 2 },
  
  inputArea: { flexDirection: 'row', alignItems: 'center', padding: 15, backgroundColor: COLORS.bgBottom },
  plusIconBtn: { width: 32, height: 32, borderRadius: 16, borderColor: COLORS.textSecondary, borderWidth: 1, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  chatInputWrapper: { flex: 1, backgroundColor: COLORS.cardInactiveBg, borderColor: COLORS.inputBorder, borderWidth: 1, borderRadius: 20, paddingHorizontal: 15, height: 40, justifyContent: 'center' },
  chatInput: { color: COLORS.text, fontSize: 13 },
  sendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },


  // --- FREELANCER HOME DASHBOARD ---
  fhHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25, marginTop: 10 },
  fhHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  fhGreetingRow: { marginLeft: 12 },
  fhGreeting: { color: COLORS.textSecondary, fontSize: 11 },
  fhName: { color: COLORS.text, fontSize: 16, fontWeight: 'bold' },
  bellIconWrapper: { position: 'relative' },
  notificationDot: { position: 'absolute', top: 0, right: 2, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF4C4C' },
  
  earningsCard: { backgroundColor: COLORS.cardInactiveBg, borderColor: COLORS.inputBorder, borderWidth: 1, borderRadius: 16, padding: 20, marginBottom: 25 },
  earningsLabel: { color: COLORS.textSecondary, fontSize: 11, marginBottom: 5 },
  earningsAmount: { color: COLORS.text, fontSize: 28, fontWeight: 'bold', marginBottom: 15 },
  escrowRow: { borderTopWidth: 1, borderTopColor: COLORS.inputBorder, paddingTop: 15 },
  escrowText: { color: COLORS.textSecondary, fontSize: 11 },
  
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 15 },
  sectionTitleMain: { color: COLORS.text, fontSize: 14, fontWeight: 'bold' },
  viewAllText: { color: COLORS.textSecondary, fontSize: 11 },
  
  requestCard: { backgroundColor: COLORS.cardInactiveBg, borderColor: '#F4C77F', borderWidth: 1, borderRadius: 16, padding: 15, marginBottom: 20 },
  requestTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  requestClientInfo: { flexDirection: 'row', flex: 1 },
  clientInitialAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.inputBg, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  clientInitialText: { color: COLORS.textSecondary, fontWeight: 'bold' },
  requestClientName: { color: COLORS.text, fontWeight: 'bold', fontSize: 14 },
  requestProjectTitle: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  requestPriceRight: { alignItems: 'flex-end' },
  requestPriceText: { color: COLORS.text, fontWeight: 'bold', fontSize: 14 },
  requestLocationText: { color: COLORS.textSecondary, fontSize: 10, marginTop: 2 },
  requestBtnRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
  declineBtn: { flex: 1, borderColor: COLORS.inputBorder, borderWidth: 1, borderRadius: 20, paddingVertical: 12, alignItems: 'center', marginRight: 10 },
  declineBtnText: { color: COLORS.textSecondary, fontWeight: 'bold', fontSize: 12 },
  acceptBtn: { flex: 1, backgroundColor: COLORS.primary, borderRadius: 20, paddingVertical: 12, alignItems: 'center', marginLeft: 10 },
  acceptBtnText: { color: '#000', fontWeight: 'bold', fontSize: 12 },
  
  activeProjectCard: { backgroundColor: COLORS.cardInactiveBg, borderColor: COLORS.inputBorder, borderWidth: 1, borderRadius: 16, padding: 15, marginBottom: 15, flexDirection: 'row' },
  verticalAccent: { width: 3, backgroundColor: COLORS.primary, borderRadius: 2, marginRight: 12, height: '100%' },
  apContent: { flex: 1 },
  apTitle: { color: COLORS.text, fontWeight: 'bold', fontSize: 13, marginBottom: 2 },
  apClient: { color: COLORS.textSecondary, fontSize: 11, marginBottom: 15 },
  progressRow: { flexDirection: 'row', alignItems: 'center' },
  progressBarBg: { flex: 1, height: 4, backgroundColor: COLORS.inputBg, borderRadius: 2, marginRight: 10 },
  progressBarFill: { height: 4, backgroundColor: COLORS.primary, borderRadius: 2 },
  progressText: { color: COLORS.textSecondary, fontSize: 10 },


  // --- SERVICES SCREEN ---
  serviceCard: { backgroundColor: COLORS.cardInactiveBg, borderColor: COLORS.inputBorder, borderWidth: 1, borderRadius: 16, padding: 15, marginBottom: 15 },
  serviceTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  serviceTitleRow: { flex: 1, paddingRight: 10 },
  serviceTitle: { color: COLORS.text, fontSize: 15, fontWeight: 'bold' },
  serviceCategory: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2, marginBottom: 15 },
  servicePriceRight: { alignItems: 'flex-end' },
  servicePriceText: { color: COLORS.text, fontWeight: 'bold', fontSize: 14 },
  serviceRateType: { color: COLORS.textSecondary, fontSize: 10 },
  serviceStatsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  serviceStatCol: { flex: 1 },
  statLine: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  statDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#F4C77F', marginRight: 6 }, 
  statDotCompleted: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.textSecondary, marginRight: 6 },
  statText: { color: COLORS.textSecondary, fontSize: 11 },
  visibilityToggle: { flexDirection: 'row', alignItems: 'center' },
  visibilityText: { color: COLORS.textSecondary, fontSize: 10, marginRight: 8 },


});