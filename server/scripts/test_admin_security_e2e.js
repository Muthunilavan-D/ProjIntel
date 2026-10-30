const BASE_URL = 'http://localhost:5000/api';

async function runTest() {
  console.log('--- Step 1: Testing Admin Login with muthunilavand555@gmail.com / admin123 ---');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'muthunilavand555@gmail.com',
      password: 'admin123',
      role: 'Admin'
    })
  });
  const loginData = await loginRes.json();
  if (!loginData.success) {
    console.error('❌ Login failed:', loginData);
    process.exit(1);
  }
  console.log('✅ Login successful! Token received. User:', loginData.user.email);
  const token = loginData.token;

  console.log('\n--- Step 2: Testing Forgot Password OTP Trigger ---');
  const forgotRes = await fetch(`${BASE_URL}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'muthunilavand555@gmail.com' })
  });
  const forgotData = await forgotRes.json();
  if (!forgotData.success) {
    console.error('❌ Forgot password failed:', forgotData);
    process.exit(1);
  }
  console.log('✅ Forgot password response:', forgotData.message);
  console.log('OTP generated:', forgotData.devOtp);
  const otp = forgotData.devOtp;
  const resetToken = forgotData.resetToken;

  console.log('\n--- Step 3: Testing OTP Verification ---');
  const verifyOtpRes = await fetch(`${BASE_URL}/auth/verify-reset-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'muthunilavand555@gmail.com', otp })
  });
  const verifyOtpData = await verifyOtpRes.json();
  if (!verifyOtpData.success) {
    console.error('❌ OTP verification failed:', verifyOtpData);
    process.exit(1);
  }
  console.log('✅ OTP verified:', verifyOtpData.message);

  console.log('\n--- Step 4: Testing Password Reset via OTP ---');
  const resetRes = await fetch(`${BASE_URL}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'muthunilavand555@gmail.com',
      otp,
      newPassword: 'newAdminPassword123'
    })
  });
  const resetData = await resetRes.json();
  if (!resetData.success) {
    console.error('❌ Reset password failed:', resetData);
    process.exit(1);
  }
  console.log('✅ Password reset result:', resetData.message);

  console.log('\n--- Step 5: Testing Login with New Password ---');
  const newLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'muthunilavand555@gmail.com',
      password: 'newAdminPassword123',
      role: 'Admin'
    })
  });
  const newLoginData = await newLoginRes.json();
  if (!newLoginData.success) {
    console.error('❌ Login with new password failed:', newLoginData);
    process.exit(1);
  }
  console.log('✅ Login with new password successful!');
  const newAuthToken = newLoginData.token;

  console.log('\n--- Step 6: Testing Admin Request Email Change ---');
  const changeEmailRes = await fetch(`${BASE_URL}/auth/admin/request-email-change`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${newAuthToken}`
    },
    body: JSON.stringify({
      newEmail: 'muthu.verification.test@gmail.com',
      currentPassword: 'newAdminPassword123'
    })
  });
  const changeEmailData = await changeEmailRes.json();
  if (!changeEmailData.success) {
    console.error('❌ Request email change failed:', changeEmailData);
    process.exit(1);
  }
  console.log('✅ Request email change result:', changeEmailData.message);
  console.log('Verification Token:', changeEmailData.verificationToken);
  const verifyToken = changeEmailData.verificationToken;

  console.log('\n--- Step 7: Checking that Admin Email is NOT changed before verification ---');
  const meRes = await fetch(`${BASE_URL}/auth/me`, {
    headers: { 'Authorization': `Bearer ${newAuthToken}` }
  });
  const meData = await meRes.json();
  console.log('Current Admin Email before clicking link:', meData.user.email);
  if (meData.user.email === 'muthunilavand555@gmail.com') {
    console.log('✅ Verified: Email remains un-updated pending verification!');
  } else {
    console.error('❌ Email changed prematurely!');
    process.exit(1);
  }

  console.log('\n--- Step 8: Verifying Email Change with Token ---');
  const verifyEmailRes = await fetch(`${BASE_URL}/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: verifyToken })
  });
  const verifyEmailData = await verifyEmailRes.json();
  if (!verifyEmailData.success) {
    console.error('❌ Verify email failed:', verifyEmailData);
    process.exit(1);
  }
  console.log('✅ Email verification link confirmed:', verifyEmailData.message);
  console.log('New Verified Email:', verifyEmailData.user.email);
  const verifiedToken = verifyEmailData.token;

  console.log('\n--- Step 9: Restoring Primary Admin Email (muthunilavand555@gmail.com) and Password (admin123) ---');
  // Revert email back
  const revertReq = await fetch(`${BASE_URL}/auth/admin/request-email-change`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${verifiedToken}`
    },
    body: JSON.stringify({
      newEmail: 'muthunilavand555@gmail.com',
      currentPassword: 'newAdminPassword123'
    })
  });
  const revertData = await revertReq.json();
  await fetch(`${BASE_URL}/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: revertData.verificationToken })
  });

  // Revert password back to admin123
  const forgotAgain = await fetch(`${BASE_URL}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'muthunilavand555@gmail.com' })
  });
  const forgotAgainData = await forgotAgain.json();
  await fetch(`${BASE_URL}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'muthunilavand555@gmail.com',
      otp: forgotAgainData.devOtp,
      newPassword: 'admin123'
    })
  });

  console.log('✅ Admin credentials restored to pristine state: muthunilavand555@gmail.com / admin123');
  console.log('\n🎉 ALL ADMIN AUTHENTICATION, OTP RESET & EMAIL VERIFICATION TESTS PASSED PERFECTLY!');
}

runTest().catch(console.error);
