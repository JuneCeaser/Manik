const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString(); // always 6 digits
};

module.exports = generateOtp;
