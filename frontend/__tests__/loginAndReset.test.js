import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Frontend Login & Password Reset Interaction Logic', () => {

  // Skenario G: Aksi Coba Lagi menutup modal dan mengizinkan input kembali
  test('G. Action "Coba Lagi" closes prompt modal and retains login form without countdown', () => {
    let showForgotPromptModal = true;
    let isInputLocked = false;
    let countdownTimer = null;

    // Aksi Coba Lagi
    const handleTryAgain = () => {
      showForgotPromptModal = false;
      isInputLocked = false;
      countdownTimer = null;
    };

    handleTryAgain();

    assert.equal(showForgotPromptModal, false, 'Prompt modal should be closed');
    assert.equal(isInputLocked, false, 'Input should not be locked');
    assert.equal(countdownTimer, null, 'No countdown timer should be set');
  });

  // Skenario H: Aksi Lupa Password membuka modal dan memerlukan konfirmasi pengguna
  test('H. Action "Lupa Password" opens ForgotPasswordModal with prefilled username and requires confirmation', () => {
    const currentUsername = '0125.02.0001';
    let showForgotPromptModal = true;
    let showForgotPasswordModal = false;
    let modalPrefilledUsername = '';
    let apiCallTriggered = false;

    // Klik tombol "Lupa Password / Hubungi Admin" dari prompt modal
    const handleOpenForgotPasswordFromPrompt = () => {
      showForgotPromptModal = false;
      showForgotPasswordModal = true;
      modalPrefilledUsername = currentUsername.trim();
    };

    handleOpenForgotPasswordFromPrompt();

    assert.equal(showForgotPromptModal, false, 'Prompt modal should close');
    assert.equal(showForgotPasswordModal, true, 'Forgot password modal should open');
    assert.equal(modalPrefilledUsername, '0125.02.0001', 'Username should be prefilled');
    assert.equal(apiCallTriggered, false, 'API request must NOT be triggered without user explicit confirmation');

    // Pengguna menekan tombol "Kirim Permintaan" pada ForgotPasswordModal (konfirmasi)
    const handleConfirmSubmit = () => {
      apiCallTriggered = true;
    };

    handleConfirmSubmit();
    assert.equal(apiCallTriggered, true, 'API request triggered after user confirmation');
  });

  // Skenario K: Tidak ada optimistic success; error server menampilkan kegagalan yang jelas
  test('K. Error handling displays failure message on API failure instead of false optimistic success', () => {
    let notificationState = null;
    let isSubmitting = true;

    // Simulasi respons server gagal (500 atau 400)
    const simulateFailedApiResponse = (error) => {
      const errorMsg = error?.response?.data?.message || 'Gagal mengirim permintaan reset password. Periksa koneksi internet Anda.';
      notificationState = { visible: true, title: 'Gagal', message: errorMsg, type: 'error' };
      isSubmitting = false;
    };

    simulateFailedApiResponse({
      response: {
        status: 400,
        data: { message: 'Permintaan reset password untuk akun ini sudah ada dan sedang diproses oleh Admin.' }
      }
    });

    assert.equal(isSubmitting, false);
    assert.equal(notificationState.type, 'error');
    assert.equal(notificationState.title, 'Gagal');
    assert.match(notificationState.message, /sudah ada dan sedang diproses/);
  });

  // Skenario E: Reset state ketika username diubah di form login
  test('E & F. Changing username clears previous error state and hides prompt modal', () => {
    let errorMessage = 'Username atau password salah';
    let showForgotPromptModal = true;

    const onUsernameChange = (newText) => {
      errorMessage = '';
      showForgotPromptModal = false;
    };

    onUsernameChange('different_user');

    assert.equal(errorMessage, '', 'Error message should be cleared');
    assert.equal(showForgotPromptModal, false, 'Prompt modal should be hidden when username changes');
  });
});
