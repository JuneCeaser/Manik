//gemAdController.js

const GemAd = require('../models/GemAd');
const User = require('../models/User');
const ImageKit = require('imagekit');

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

// Rough USD -> LKR rate used ONLY to decide which credit tier a USD-priced ad
// falls into. Update this in your .env as exchange rates move; it does not
// affect the price actually shown/stored for the ad.
const USD_TO_LKR_RATE = Number(process.env.USD_TO_LKR_RATE) || 300;

// --------------------------------------------------------------------------
// CREDIT TIER LOGIC
// --------------------------------------------------------------------------
const getRequiredCredits = (amount, currency) => {
  const lkrAmount = currency === 'USD' ? amount * USD_TO_LKR_RATE : amount;
  if (lkrAmount < 10000) return 1;
  if (lkrAmount < 50000) return 4;
  return 6;
};

// --------------------------------------------------------------------------
// CREATE AD
// --------------------------------------------------------------------------
exports.createGemAd = async (req, res) => {
  try {
    const {
      title,
      category,
      price,
      weightCarats,
      color,
      shape,
      treatment,
      certification,
      description,
      images,
      certificateImage,
      province,
      city,
      contactPhone,
      hidePhoneNumber,
    } = req.body;

    if (!title || !category || !price || !price.amount || !price.currency) {
      return res.status(400).json({ success: false, message: 'Title, category, and price are required.' });
    }
    if (!weightCarats || !color || !shape || !treatment) {
      return res.status(400).json({ success: false, message: 'Weight, color, shape, and treatment are required.' });
    }
    if (!province || !city) {
      return res.status(400).json({ success: false, message: 'Location is required.' });
    }
    if (!Array.isArray(images) || images.length < 1 || images.length > 5) {
      return res.status(400).json({ success: false, message: 'Please upload between 1 and 5 images.' });
    }
    if (certification && certification.status === 'Certified' && !certification.labName) {
      return res.status(400).json({ success: false, message: 'Please provide the certifying lab name.' });
    }
    if (!hidePhoneNumber && !contactPhone) {
      return res.status(400).json({ success: false, message: 'Please provide a contact number or hide it.' });
    }

    const requiredCredits = getRequiredCredits(Number(price.amount), price.currency);

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (user.adCredits < requiredCredits) {
      return res.status(402).json({
        success: false,
        code: 'INSUFFICIENT_CREDITS',
        message: `You need ${requiredCredits} ad credit(s) to post this ad. You currently have ${user.adCredits}.`,
        requiredCredits,
        availableCredits: user.adCredits,
      });
    }

    // Upload gem images to ImageKit
    const uploadedImages = [];
    for (let i = 0; i < images.length; i++) {
      const uploadResponse = await imagekit.upload({
        file: images[i],
        fileName: `gem_${req.user._id}_${Date.now()}_${i}.jpg`,
        folder: '/gem_ads',
      });
      uploadedImages.push({ url: uploadResponse.url, fileId: uploadResponse.fileId });
    }

    // Upload certificate image if provided
    let uploadedCertificate = null;
    if (certificateImage) {
      const certUploadResponse = await imagekit.upload({
        file: certificateImage,
        fileName: `cert_${req.user._id}_${Date.now()}.jpg`,
        folder: '/gem_certificates',
      });
      uploadedCertificate = { url: certUploadResponse.url, fileId: certUploadResponse.fileId };
    }

    const gemAd = await GemAd.create({
      user: req.user._id,
      title: title.trim(),
      category,
      price: {
        amount: Number(price.amount),
        currency: price.currency,
        negotiable: !!price.negotiable,
      },
      weightCarats: Number(weightCarats),
      color,
      shape,
      treatment,
      certification: {
        status: certification?.status || 'Not Certified',
        labName: certification?.status === 'Certified' ? certification.labName : '',
      },
      description: description || '',
      images: uploadedImages,
      certificateImage: uploadedCertificate,
      location: { province, city },
      contactPhone: hidePhoneNumber ? '' : contactPhone,
      hidePhoneNumber: !!hidePhoneNumber,
      status: 'PENDING',
      creditsUsed: requiredCredits,
    });

    // Deduct credits only after the ad is successfully created
    user.adCredits -= requiredCredits;
    await user.save();

    return res.status(201).json({
      success: true,
      message: 'Ad submitted successfully. Pending admin approval.',
      gemAd,
      remainingCredits: user.adCredits,
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
// GET SINGLE AD (owner only - used to load the edit form)
// --------------------------------------------------------------------------
exports.getGemAdById = async (req, res) => {
  try {
    const gemAd = await GemAd.findOne({ _id: req.params.id, user: req.user._id });
    if (!gemAd) {
      return res.status(404).json({ success: false, message: 'Ad not found.' });
    }
    return res.json({ success: true, gemAd });
  } catch (err) {
    console.error('getGemAdById error:', err);
    return res.status(500).json({ success: false, message: 'Could not fetch ad.' });
  }
};

// --------------------------------------------------------------------------
// GET PUBLISHED ADS (public home feed - newest first)
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
// EDIT AD (no credit charge - goes back to PENDING for re-approval)
// --------------------------------------------------------------------------
exports.updateGemAd = async (req, res) => {
  try {
    const gemAd = await GemAd.findOne({ _id: req.params.id, user: req.user._id });
    if (!gemAd) {
      return res.status(404).json({ success: false, message: 'Ad not found.' });
    }

    const {
      title,
      category,
      price,
      weightCarats,
      color,
      shape,
      treatment,
      certification,
      description,
      images,
      certificateImage,
      province,
      city,
      contactPhone,
      hidePhoneNumber,
    } = req.body;

    if (title) gemAd.title = title.trim();
    if (category) gemAd.category = category;
    if (price && price.amount && price.currency) {
      gemAd.price = {
        amount: Number(price.amount),
        currency: price.currency,
        negotiable: !!price.negotiable,
      };
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

    // Replace images only if a new full set was submitted
    if (Array.isArray(images) && images.length > 0) {
      if (images.length > 5) {
        return res.status(400).json({ success: false, message: 'Please upload a maximum of 5 images.' });
      }

      for (const oldImage of gemAd.images) {
        try {
          await imagekit.deleteFile(oldImage.fileId);
        } catch (imgError) {
          console.error('Failed to delete old gem image:', imgError);
        }
      }

      const uploadedImages = [];
      for (let i = 0; i < images.length; i++) {
        const uploadResponse = await imagekit.upload({
          file: images[i],
          fileName: `gem_${req.user._id}_${Date.now()}_${i}.jpg`,
          folder: '/gem_ads',
        });
        uploadedImages.push({ url: uploadResponse.url, fileId: uploadResponse.fileId });
      }
      gemAd.images = uploadedImages;
    }

    // Replace certificate image only if a new one was submitted
    if (certificateImage) {
      if (gemAd.certificateImage) {
        try {
          await imagekit.deleteFile(gemAd.certificateImage.fileId);
        } catch (imgError) {
          console.error('Failed to delete old certificate image:', imgError);
        }
      }
      const certUploadResponse = await imagekit.upload({
        file: certificateImage,
        fileName: `cert_${req.user._id}_${Date.now()}.jpg`,
        folder: '/gem_certificates',
      });
      gemAd.certificateImage = { url: certUploadResponse.url, fileId: certUploadResponse.fileId };
    }

    // Any edit sends the ad back for admin approval - no credit charge
    gemAd.status = 'PENDING';

    await gemAd.save();

    return res.json({ success: true, message: 'Ad updated and resubmitted for approval.', gemAd });
  } catch (err) {
    console.error('updateGemAd error:', err);
    return res.status(500).json({ success: false, message: 'Could not update ad.' });
  }
};

// --------------------------------------------------------------------------
// DELETE AD (no credit refund)
// --------------------------------------------------------------------------
exports.deleteGemAd = async (req, res) => {
  try {
    const gemAd = await GemAd.findOne({ _id: req.params.id, user: req.user._id });
    if (!gemAd) {
      return res.status(404).json({ success: false, message: 'Ad not found.' });
    }

    for (const image of gemAd.images) {
      try {
        await imagekit.deleteFile(image.fileId);
      } catch (imgError) {
        console.error('Failed to delete gem image:', imgError);
      }
    }

    if (gemAd.certificateImage) {
      try {
        await imagekit.deleteFile(gemAd.certificateImage.fileId);
      } catch (imgError) {
        console.error('Failed to delete certificate image:', imgError);
      }
    }

    await GemAd.findByIdAndDelete(gemAd._id);

    return res.json({ success: true, message: 'Ad deleted. Credits are not refunded for deleted ads.' });
  } catch (err) {
    console.error('deleteGemAd error:', err);
    return res.status(500).json({ success: false, message: 'Could not delete ad.' });
  }
};