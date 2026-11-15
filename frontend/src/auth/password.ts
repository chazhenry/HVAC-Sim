export function passwordRequirements(password: string): Array<{ label: string; met: boolean; display?: boolean }> {
  return [
    { label: '8–24 characters', met: password.length >= 8 && password.length <= 24 },
    { label: 'An uppercase and a lowercase letter', met: /[A-Z]/.test(password) && /[a-z]/.test(password) },
    { label: 'A number', met: /[0-9]/.test(password) },
    { label: 'A symbol', met: /[^A-Za-z0-9\s]/.test(password) },
    { label: 'No control characters', met: !/[\x00-\x1f\x7f]/.test(password), display: false },
  ];
}
