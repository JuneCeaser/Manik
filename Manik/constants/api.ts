// Replace with your actual local IPv4 address
export const API_BASE_URL = 'http://192.168.8.101:5000/api/auth';

/**
 * Formats phone numbers for the backend (e.g. 0771234567 -> 94771234567)
 */
export const formatPhoneNumber = (phone: string) => {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '94' + cleaned.substring(1);
  }
  return cleaned;
};