const GemAd = require('../models/GemAd');
const User = require('../models/User');
const ImageKit = require('imagekit');

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

const USD_TO_LKR_RATE = Number(process.env.USD_TO_LKR_RATE) || 300;

const getRequiredCredits = (amount, currency) => {
  const lkrAmount = currency === 'USD' ? amount * USD_TO_LKR_RATE : amount;
  if (lkrAmount < 10000) return 1;
  if (lkrAmount < 50000) return 4;
  return 6;
};

// --------------------------------------------------------------------------
// IMAGEKIT DIRECT UPLOAD AUTHENTICATION
// --------------------------------------------------------------------------
exports.getImageKitAuth = (req, res) => {
  try {
    const authParams = imagekit.getAuthenticationParameters();
    return res.json({
      success: true,
      ...authParams,
      publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
    });
  } catch (err) {
    console.error('getImageKitAuth error:', err);
    return res.status(500).json({ success: false, message: 'Could not generate upload signature.' });
  }
};

// --------------------------------------------------------------------------
// CREATE AD
// --------------------------------------------------------------------------
exports.createGemAd = async (req, res) => {
  try {
    const {
      title, category, price, weightCarats, color, shape, treatment,
      certification, description, images, certificateImage, province, city,
      contactPhone, hidePhoneNumber,
    } = req.body;

    // Validate the arrays uploaded directly from the frontend
    if (!Array.isArray(images) || images.length < 1 || images.length > 5) {
      return res.status(400).json({ success: false, message: 'Please provide between 1 and 5 images.' });
    }

    const requiredCredits = getRequiredCredits(Number(price.amount), price.currency);
    const user = await User.findById(req.user._id);

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    if (user.adCredits < requiredCredits) {
      return res.status(402).json({
        success: false,
        code: 'INSUFFICIENT_CREDITS',
        message: `You need ${requiredCredits} ad credit(s) to post this ad. You currently have ${user.adCredits}.`,
      });
    }

    const gemAd = await GemAd.create({
      user: req.user._id,
      title: title.trim(),
      category,
      price: { amount: Number(price.amount), currency: price.currency, negotiable: !!price.negotiable },
      weightCarats: Number(weightCarats),
      color,
      shape,
      treatment,
      certification: {
        status: certification?.status || 'Not Certified',
        labName: certification?.status === 'Certified' ? certification.labName : '',
      },
      description: description || '',
      images: images, // Contains [{ url, fileId }]
      certificateImage: certificateImage || null,
      location: { province, city },
      contactPhone: hidePhoneNumber ? '' : contactPhone,
      hidePhoneNumber: !!hidePhoneNumber,
      status: 'PENDING',
      creditsUsed: requiredCredits,
    });

    user.adCredits -= requiredCredits;
    await user.save();

    return res.status(201).json({
      success: true,
      message: 'Ad submitted successfully. Pending admin approval.',
      gemAd,
    });
  } catch (err) {
    console.error('createGemAd error:', err);
    return res.status(500).json({ success: false, message: 'Could not create ad.' });
  }
};

// --------------------------------------------------------------------------
// GET MY ADS
// --------------------------------------------------------------------------
exports.getMyGemAds = async (req, res) => {
  try {
    const gemAds = await GemAd.find({ user: req.user._id }).sort({ createdAt: -1 });
    return res.json({ success: true, gemAds });
  } catch (err) {
    console.error('getMyGemAds error:', err);
    return res.status(500).json({ success: false, message: 'Could not fetch your ads.' });
  }
};

// --------------------------------------------------------------------------
// GET SINGLE AD
// --------------------------------------------------------------------------
exports.getGemAdById = async (req, res) => {
  try {
    const gemAd = await GemAd.findOne({ _id: req.params.id, user: req.user._id });
    if (!gemAd) return res.status(404).json({ success: false, message: 'Ad not found.' });
    return res.json({ success: true, gemAd });
  } catch (err) {
    console.error('getGemAdById error:', err);
    return res.status(500).json({ success: false, message: 'Could not fetch ad.' });
  }
};

// --------------------------------------------------------------------------
// GET PUBLISHED ADS (For Home Screen Feed)
// --------------------------------------------------------------------------
exports.getPublishedGemAds = async (req, res) => {
  try {
    const gemAds = await GemAd.find({ status: 'APPROVED' })
      .populate('user', 'name')
      .sort({ createdAt: -1 });

    return res.json({ success: true, gemAds });
  } catch (err) {
    console.error('getPublishedGemAds error:', err);
    return res.status(500).json({ success: false, message: 'Could not fetch ads.' });
  }
};

// --------------------------------------------------------------------------
// GET PUBLIC GEM AD DETAILS 
// --------------------------------------------------------------------------
exports.getPublicGemAdById = async (req, res) => {
  try {
    const gemAd = await GemAd.findOne({ _id: req.params.id, status: 'APPROVED' })
      .populate('user', 'name profileImage whatsappCountryCode whatsappNumber phone');

    if (!gemAd) return res.status(404).json({ success: false, message: 'Gem ad not found.' });
    return res.json({ success: true, gemAd });
  } catch (err) {
    console.error('getPublicGemAdById error:', err);
    return res.status(500).json({ success: false, message: 'Could not fetch ad details.' });
  }
};

// --------------------------------------------------------------------------
// EDIT AD
// --------------------------------------------------------------------------
exports.updateGemAd = async (req, res) => {
  try {
    const gemAd = await GemAd.findOne({ _id: req.params.id, user: req.user._id });
    if (!gemAd) return res.status(404).json({ success: false, message: 'Ad not found.' });

    const {
      title, category, price, weightCarats, color, shape, treatment,
      certification, description, images, certificateImage, province, city,
      contactPhone, hidePhoneNumber,
    } = req.body;

    if (title) gemAd.title = title.trim();
    if (category) gemAd.category = category;
    if (price && price.amount) {
      gemAd.price = { amount: Number(price.amount), currency: price.currency, negotiable: !!price.negotiable };
    }
    if (weightCarats) gemAd.weightCarats = Number(weightCarats);
    if (color) gemAd.color = color;
    if (shape) gemAd.shape = shape;
    if (treatment) gemAd.treatment = treatment;
    if (certification) {
      gemAd.certification = {
        status: certification.status || 'Not Certified',
        labName: certification.status === 'Certified' ? certification.labName : '',
      };
    }
    if (description !== undefined) gemAd.description = description;
    if (province && city) gemAd.location = { province, city };
    if (hidePhoneNumber !== undefined) gemAd.hidePhoneNumber = !!hidePhoneNumber;
    if (contactPhone !== undefined) gemAd.contactPhone = hidePhoneNumber ? '' : contactPhone;

    // Handle image updates and cleanup obsolete images from ImageKit
    if (Array.isArray(images) && images.length > 0) {
      const newFileIds = images.map(img => img.fileId);
      for (const oldImage of gemAd.images) {
        if (oldImage.fileId && !newFileIds.includes(oldImage.fileId)) {
          try {
            await imagekit.deleteFile(oldImage.fileId);
          } catch (err) { 
            console.error('Failed to delete old gem image from ImageKit:', err); 
          }
        }
      }
      gemAd.images = images;
    }

    if (certificateImage !== undefined) {
      if (gemAd.certificateImage && gemAd.certificateImage.fileId && (!certificateImage || certificateImage.fileId !== gemAd.certificateImage.fileId)) {
        try {
          await imagekit.deleteFile(gemAd.certificateImage.fileId);
        } catch (err) { 
          console.error('Failed to delete old certificate image from ImageKit:', err); 
        }
      }
      gemAd.certificateImage = certificateImage || null;
    }

    gemAd.status = 'PENDING'; // Resets to pending for admin re-evaluation upon update
    await gemAd.save();

    return res.json({ success: true, message: 'Ad updated and resubmitted for approval.', gemAd });
  } catch (err) {
    console.error('updateGemAd error:', err);
    return res.status(500).json({ success: false, message: 'Could not update ad.' });
  }
};

// --------------------------------------------------------------------------
// DELETE AD 
// --------------------------------------------------------------------------
exports.deleteGemAd = async (req, res) => {
  try {
    const gemAd = await GemAd.findOne({ _id: req.params.id, user: req.user._id });
    if (!gemAd) return res.status(404).json({ success: false, message: 'Ad not found.' });

    for (const image of gemAd.images) {
      if (image.fileId) {
        try {
          await imagekit.deleteFile(image.fileId);
        } catch (err) { console.error('Failed to delete gem image from ImageKit:', err); }
      }
    }

    if (gemAd.certificateImage && gemAd.certificateImage.fileId) {
      try {
        await imagekit.deleteFile(gemAd.certificateImage.fileId);
      } catch (err) { console.error('Failed to delete certificate image from ImageKit:', err); }
    }

    await GemAd.findByIdAndDelete(gemAd._id);

    return res.json({ success: true, message: 'Ad deleted.' });
  } catch (err) {
    console.error('deleteGemAd error:', err);
    return res.status(500).json({ success: false, message: 'Could not delete ad.' });
  }
};