export const validatePassword = (password: string): { valid: boolean; error?: string } => {
  if (password.length < 6) {
    return { valid: false, error: 'Пароль должен быть не менее 6 символов' };
  }

  // Проверка: пароль должен содержать буквы и числа
  const hasLetter = /[a-zA-Zа-яА-Я]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  if (!hasLetter) {
    return { valid: false, error: 'Пароль должен содержать буквы' };
  }

  if (!hasNumber) {
    return { valid: false, error: 'Пароль должен содержать числа' };
  }

  return { valid: true };
};











