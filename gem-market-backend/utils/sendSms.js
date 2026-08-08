const axios = require('axios');

/**
 * Sends an SMS via Text.lk.
 * @param {string} phone - recipient number, e.g. "94771234567" (no leading +)
 * @param {string} message - message body
 */
const sendSms = async (phone, message) => {
  try {
    const response = await axios.post(
      process.env.TEXTLK_API_URL,
      {
        recipient: phone,
        sender_id: process.env.TEXTLK_SENDER_ID,
        type: 'plain',
        message,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.TEXTLK_API_KEY}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );
    return response.data;
  } catch (err) {
    console.error('Text.lk send failed:', err.response?.data || err.message);
    throw new Error('Failed to send SMS');
  }
};

module.exports = sendSms;
