const Payment = require('../models/Payment');
const ImageKit = require('imagekit');

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

// @desc    Submit a manual bank slip for 30 Ad Credits
// @route   POST /api/payments/manual-slip
// @access  Private (User)
exports.submitManualSlip = async (req, res) => {
  try {
    const { base64Image, amount } = req.body;

    if (!base64Image) {
      return res.status(400).json({ success: false, message: 'Bank slip image is required.' });
    }

    // 1. Upload Bank Slip image to ImageKit
    const uploadResponse = await imagekit.upload({
      file: base64Image,
      fileName: `slip_${req.user._id}_${Date.now()}.jpg`,
      folder: '/bank_slips',
    });

    // 2. Create Payment Record with PENDING status
    const payment = await Payment.create({
      user: req.user._id,
      amount: amount || 990, // Launch bundle price (Rs. 990)
      method: 'MANUAL_SLIP',
      status: 'PENDING',
      adCreditsAdded: 30,
      slipImage: uploadResponse.url,
      slipImageId: uploadResponse.fileId,
    });

    return res.status(201).json({
      success: true,
      message: 'Bank slip submitted successfully. Pending admin approval.',
      payment,
    });
  } catch (err) {
    console.error('submitManualSlip Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to upload bank slip.' });
  }
};