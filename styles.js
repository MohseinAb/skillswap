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
  
  // Header
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, marginTop: 10 },
  headerTitle: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  backBtn: { color: COLORS.primary, fontSize: 20, padding: 10 },

  // Inputs - Made darker and slightly less tall
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


  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  logoText: { color: COLORS.text, fontSize: 24, fontWeight: 'bold', letterSpacing: 2, marginBottom: 40 },
  graphicPlaceholder: { alignItems: 'center', justifyContent: 'center', width: 200, height: 200, backgroundColor: COLORS.cardActiveBg, borderRadius: 20 },
  circleGraphic: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primary, marginBottom: 5 },
  baseGraphic: { width: 40, height: 40, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, backgroundColor: COLORS.primary },
});

