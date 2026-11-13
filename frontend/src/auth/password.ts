export function passwordRequirements(password: string): Array<{ label: string; met: boolean; display?: boolean }> {
  return [
    { label: '12–128 characters', met: password.length >= 12 && password.length <= 128 },
    { label: 'An uppercase and a lowercase letter', met: /[A-Z]/.test(password) && /[a-z]/.test(password) },
    { label: 'A number', met: /[0-9]/.test(password) },
    { label: 'A symbol', met: /[^A-Za-z0-9\s]/.test(password) },
    { label: 'No control characters', met: !/[\x00-\x1f\x7f]/.test(password), display: false },
  ];
}
