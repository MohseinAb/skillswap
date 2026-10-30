// Who may be signed in, and where they land. No React Native or Firebase imports, so it is unit-testable.
// Used by app startup (App.js), the login screen and both registration screens, so they always agree.

export const ADMIN_EMAIL = 'admin@skillswap.ph';

export const VERIFICATION = {
  // New accounts are flagged `emailVerificationRequired` when they register, and must verify before they can sign in.
  // Accounts created before this update have no flag and keep working. Set this to true to make EVERY
  // non-admin account verify (older ones can then use "Send again" on the login screen to get a link).
  ENFORCE_FOR_ALL: false,
};

export function roleOf(userData, email) {
  const data = userData || {};
  const role = String(data.role || data.accountType || '').toLowerCase();
  if (role === 'admin' || String(email || '').toLowerCase() === ADMIN_EMAIL) return 'admin';
  return role === 'freelancer' ? 'freelancer' : 'client';
}

export function routeForRole(role) {
  if (role === 'admin') return 'AdminDashboard';
  return role === 'freelancer' ? 'FreelancerTabs' : 'ClientTabs';
}

// The demo admin uses a made-up address that can never receive mail, so admins are exempt.
export function needsEmailVerification(userData, email) {
  if (roleOf(userData, email) === 'admin') return false;
  return (userData && userData.emailVerificationRequired === true) || VERIFICATION.ENFORCE_FOR_ALL;
}

/*
  Decides whether an account that has just signed in (or is being restored) may use the app.
    userData        the person's profile document (or {})
    reloadUser()    refreshes the Firebase user, because `emailVerified` is cached on the phone
    isEmailVerified()  reads the current value
  Returns { allowed: true, role } or { allowed: false, reason: 'suspended' | 'unverified' }.
*/
export async function checkAccountAccess({ userData, email, reloadUser, isEmailVerified }) {
  if (userData && userData.suspended) return { allowed: false, reason: 'suspended' };

  if (needsEmailVerification(userData, email) && !isEmailVerified()) {
    await reloadUser();
    if (!isEmailVerified()) return { allowed: false, reason: 'unverified' };
  }
  return { allowed: true, role: roleOf(userData, email) };
}

// Where the app opens. Anyone who is still signed in from last time goes straight to their home;
// everyone else (or anyone who may no longer sign in) sees the welcome screen.
export async function resolveStartRoute({ user, loadProfile, reloadUser, isEmailVerified, signOutUser }) {
  if (!user) return 'GetStarted';
  try {
    const userData = await loadProfile(user.uid);
    const access = await checkAccountAccess({ userData, email: user.email, reloadUser, isEmailVerified });
    if (!access.allowed) {
      await signOutUser();
      return 'GetStarted';
    }
    return routeForRole(access.role);
  } catch (error) {
    // Offline or a temporary error: do not guess, let them log in again.
    return 'GetStarted';
  }
}

// Last step of registering: the account exists, but nobody can use it until the emailed link is opened.
// Failing to send the email must not lose the account, so it is reported instead of thrown.
export async function completeRegistration({ user, sendVerification, signOutUser }) {
  let emailSent = true;
  try {
    await sendVerification(user);
  } catch (error) {
    emailSent = false;
  }
  await signOutUser(); // Firebase signs a new account in automatically; it must not stay signed in unverified
  return { emailSent };
}

// Shown when someone tries to log in before verifying. Returns 'declined' | 'sent' | 'failed'.
export async function offerVerificationResend({ user, email, confirm, notifyFn, sendVerification }) {
  const wantsIt = await confirm(
    'Verify your email first',
    `Open the verification link we sent to ${email}, then log in again. Do you want us to send it again?`,
    'Send again'
  );
  if (!wantsIt) return 'declined';
  try {
    await sendVerification(user);
    notifyFn('Email sent', `A new verification link is on its way to ${email}. Check your spam folder too.`);
    return 'sent';
  } catch (error) {
    notifyFn(
      error && error.code === 'auth/too-many-requests' ? 'Please wait a bit' : 'Could not send the email',
      error && error.code === 'auth/too-many-requests'
        ? 'Too many emails were requested. Try again in a few minutes.'
        : (error && error.message) || 'Please try again.'
    );
    return 'failed';
  }
}
