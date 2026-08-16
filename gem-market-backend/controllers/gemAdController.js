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

// Normalizes a { amount, currency } price into LKR using the server's
// configured rate, so it can be stored on the document and queried/sorted
// directly in MongoDB (see priceInLKR in the GemAd model).
const toLKR = (amount, currency) =>
  currency === 'USD' ? Number(amount) * USD_TO_LKR_RATE : Number(amount);

exports.getImageKitAuth = (req, res) => {
  try {
    const authParams = imagekit.getAuthenticationParameters();
    return res.json({
      success: true,
      ...authParams,
      publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Could not generate upload signature.' });
  }
};

exports.createGemAd = async (req, res) => {
  try {
    const {
      title, category, price, weightCarats, color, shape, treatment, origin, clarity, dimensions,
      certification, description, images, certificateImage, province, city,
      contactPhone, hidePhoneNumber, whatsappCountryCode, whatsappNumber
    } = req.body;

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
        message: `You need ${requiredCredits} ad credit(s). You have ${user.adCredits}.`,
      });
    }

    // Save WhatsApp details to the User profile if provided during Ad creation
    if (whatsappCountryCode && whatsappNumber) {
      user.whatsappCountryCode = whatsappCountryCode;
      user.whatsappNumber = whatsappNumber.replace(/\D/g, '');
      // user.save() is called below anyway to deduct credits
    }

    const gemAd = await GemAd.create({
      user: req.user._id,
      title: title.trim(),
      category,
      price: { amount: Number(price.amount), currency: price.currency, negotiable: !!price.negotiable },
      priceInLKR: toLKR(price.amount, price.currency),
      weightCarats: Number(weightCarats),
      color,
      shape,
      origin,
      clarity,
      dimensions: {
        length: dimensions?.length ? Number(dimensions.length) : 0,
        width: dimensions?.width ? Number(dimensions.width) : 0,
        depth: dimensions?.depth ? Number(dimensions.depth) : 0,
      },
      treatment,
      certification: {
        status: certification?.status || 'Not Certified',
        labName: certification?.status === 'Certified' ? certification.labName : '',
      },
      description: description || '',
      images: images,
      certificateImage: certificateImage || null,
      location: { province, city },
      contactPhone: hidePhoneNumber ? '' : contactPhone,
      hidePhoneNumber: !!hidePhoneNumber,
      status: 'PENDING',
      creditsUsed: requiredCredits,
      bumpedAt: Date.now(),
    });

    user.adCredits -= requiredCredits;
    await user.save();

    return res.status(201).json({ success: true, message: 'Ad submitted successfully.', gemAd });
  } catch (err) {
    console.error('createGemAd error:', err);
    return res.status(500).json({ success: false, message: 'Could not create ad.' });
  }
};

exports.getMyGemAds = async (req, res) => {
  try {
    const gemAds = await GemAd.find({ user: req.user._id }).sort({ bumpedAt: -1, createdAt: -1 });
    return res.json({ success: true, gemAds });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Could not fetch your ads.' });
  }
};

exports.getGemAdById = async (req, res) => {
  try {
    const gemAd = await GemAd.findOne({ _id: req.params.id, user: req.user._id });
    if (!gemAd) return res.status(404).json({ success: false, message: 'Ad not found.' });
    return res.json({ success: true, gemAd });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Could not fetch ad.' });
  }
};

// --- ADVANCED SEARCH & FILTER: fully DB-side now ---
// Every filter (including price, across currencies) is expressed as a
// Mongo query condition, and pagination uses .skip()/.limit() at the
// database level instead of fetching all matches into memory first. This
// is what keeps response times flat as the ad count grows into the
// thousands, instead of degrading linearly with collection size.
exports.getPublishedGemAds = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const category = req.query.category;
    const prefCurrency = req.query.currency || 'LKR';
    const exchangeRate = parseFloat(req.query.rate) || USD_TO_LKR_RATE;

    const query = { status: 'APPROVED' };

    // 1. Text Search (Matches Title or Description)
    // Kept as $regex to preserve partial/substring matching behavior.
    // The { status: 1, bumpedAt: -1 } index still lets Mongo narrow to
    // approved ads efficiently before scanning for the regex match.
    if (req.query.search) {
      query.$or = [
        { title: { $regex: req.query.search, $options: 'i' } },
        { description: { $regex: req.query.search, $options: 'i' } },
      ];
    }

    // 2. Exact Match Filters
    if (category && category !== 'All') query.category = category;
    if (req.query.color && req.query.color !== 'All') query.color = req.query.color;
    if (req.query.shape && req.query.shape !== 'All') query.shape = req.query.shape;
    if (req.query.origin && req.query.origin !== 'All') query.origin = req.query.origin;
    if (req.query.clarity && req.query.clarity !== 'All') query.clarity = req.query.clarity;

    // 3. Carat Weight Range Filter
    const minCarat = parseFloat(req.query.minCarat);
    const maxCarat = parseFloat(req.query.maxCarat);
    if (!isNaN(minCarat) || !isNaN(maxCarat)) {
      query.weightCarats = {};
      if (!isNaN(minCarat)) query.weightCarats.$gte = minCarat;
      if (!isNaN(maxCarat)) query.weightCarats.$lte = maxCarat;
    }

    // 4. Price Range Filter — now a normal indexed Mongo query.
    // The user's min/max are in `prefCurrency`; convert them to LKR (the
    // unit priceInLKR is stored in) using the same rate the client sent,
    // so comparisons stay consistent with what's rendered on screen.
    const minPrice = parseFloat(req.query.minPrice);
    const maxPrice = parseFloat(req.query.maxPrice);
    if (!isNaN(minPrice) || !isNaN(maxPrice)) {
      query.priceInLKR = {};
      if (!isNaN(minPrice)) {
        query.priceInLKR.$gte = prefCurrency === 'USD' ? minPrice * exchangeRate : minPrice;
      }
      if (!isNaN(maxPrice)) {
        query.priceInLKR.$lte = prefCurrency === 'USD' ? maxPrice * exchangeRate : maxPrice;
      }
    }

    // Run the page fetch and the total count in parallel — countDocuments
    // uses the same indexed query so it stays cheap even as the
    // collection grows.
    const [gemAds, totalMatching] = await Promise.all([
      GemAd.find(query)
        .populate('user', 'name')
        .sort({ bumpedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      GemAd.countDocuments(query),
    ]);

    const hasMore = skip + gemAds.length < totalMatching;

    return res.json({ success: true, gemAds, hasMore });
  } catch (err) {
    console.error('getPublishedGemAds error:', err);
    return res.status(500).json({ success: false, message: 'Could not fetch ads.' });
  }
};

exports.getPublicGemAdById = async (req, res) => {
  try {
    const gemAd = await GemAd.findOne({ _id: req.params.id, status: 'APPROVED' })
      .populate('user', 'name profileImage whatsappCountryCode whatsappNumber phone');

    if (!gemAd) return res.status(404).json({ success: false, message: 'Gem ad not found.' });
    return res.json({ success: true, gemAd });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Could not fetch ad details.' });
  }
};

exports.pushGemAd = async (req, res) => {
  try {
    const gemAd = await GemAd.findOne({ _id: req.params.id, user: req.user._id });
    if (!gemAd) return res.status(404).json({ success: false, message: 'Ad not found.' });
    if (gemAd.status !== 'APPROVED') return res.status(400).json({ success: false, message: 'Only published ads can be pushed.' });

    const user = await User.findById(req.user._id);
    if (user.adCredits < 1) {
      return res.status(402).json({ success: false, code: 'INSUFFICIENT_CREDITS', message: 'You need at least 1 ad credit to push an ad.' });
    }

    user.adCredits -= 1;
    await user.save();

    gemAd.bumpedAt = Date.now();
    await gemAd.save();

    // FIXED: Return the formatted user object so the frontend context and RevenueCat don't crash
    return res.json({ 
      success: true, 
      message: 'Ad successfully pushed to the front!', 
      user: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        profileImage: user.profileImage,
        whatsappCountryCode: user.whatsappCountryCode,
        whatsappNumber: user.whatsappNumber,
        province: user.province,
        city: user.city,
        adCredits: user.adCredits
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Could not push ad.' });
  }
};

exports.updateGemAd = async (req, res) => {
  try {
    const gemAd = await GemAd.findOne({ _id: req.params.id, user: req.user._id });
    if (!gemAd) return res.status(404).json({ success: false, message: 'Ad not found.' });

    const {
      title, category, price, weightCarats, color, shape, treatment, origin, clarity, dimensions,
      certification, description, images, certificateImage, province, city,
      contactPhone, hidePhoneNumber,
    } = req.body;

    if (title) gemAd.title = title.trim();
    if (category) gemAd.category = category;
    if (price && price.amount) {
      gemAd.price = { amount: Number(price.amount), currency: price.currency, negotiable: !!price.negotiable };
      // Keep the denormalized LKR value in sync whenever price changes.
      gemAd.priceInLKR = toLKR(price.amount, price.currency);
    }
    if (weightCarats) gemAd.weightCarats = Number(weightCarats);
    if (color) gemAd.color = color;
    if (shape) gemAd.shape = shape;
    if (origin) gemAd.origin = origin;
    if (clarity) gemAd.clarity = clarity;
    if (dimensions) {
      gemAd.dimensions = {
        length: dimensions.length ? Number(dimensions.length) : 0,
        width: dimensions.width ? Number(dimensions.width) : 0,
        depth: dimensions.depth ? Number(dimensions.depth) : 0,
      };
    }
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

    if (Array.isArray(images) && images.length > 0) {
      const newFileIds = images.map(img => img.fileId);
      for (const oldImage of gemAd.images) {
        if (oldImage.fileId && !newFileIds.includes(oldImage.fileId)) {
          try { await imagekit.deleteFile(oldImage.fileId); } catch (err) { }
        }
      }
      gemAd.images = images;
    }

    if (certificateImage !== undefined) {
      if (gemAd.certificateImage && gemAd.certificateImage.fileId && (!certificateImage || certificateImage.fileId !== gemAd.certificateImage.fileId)) {
        try { await imagekit.deleteFile(gemAd.certificateImage.fileId); } catch (err) { }
      }
      gemAd.certificateImage = certificateImage || null;
    }

    gemAd.status = 'PENDING';
    gemAd.bumpedAt = Date.now();
    await gemAd.save();

    return res.json({ success: true, message: 'Ad updated and resubmitted.', gemAd });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Could not update ad.' });
  }
};

exports.deleteGemAd = async (req, res) => {
  try {
    const gemAd = await GemAd.findOne({ _id: req.params.id, user: req.user._id });
    if (!gemAd) return res.status(404).json({ success: false, message: 'Ad not found.' });

    for (const image of gemAd.images) {
      if (image.fileId) {
        try { await imagekit.deleteFile(image.fileId); } catch (err) { }
      }
    }

    if (gemAd.certificateImage && gemAd.certificateImage.fileId) {
      try { await imagekit.deleteFile(gemAd.certificateImage.fileId); } catch (err) { }
    }

    await GemAd.findByIdAndDelete(gemAd._id);

    return res.json({ success: true, message: 'Ad deleted.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Could not delete ad.' });
  }
};