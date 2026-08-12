export const GEM_CATEGORIES = [
  'Blue Sapphire',
  'Yellow Sapphire',
  'Pink Sapphire',
  'White Sapphire',
  'Star Sapphire',
  'Ruby',
  'Star Ruby',
  'Padparadscha',
  'Emerald',
  'Spinel',
  'Tsavorite',
  'Tourmaline',
  'Alexandrite',
  "Cat's Eye (Chrysoberyl)",
  'Garnet',
  'Moonstone',
  'Amethyst',
  'Citrine',
  'Topaz',
  'Zircon',
  'Aquamarine',
  'Peridot',
  'Tanzanite',
  'Opal',
  'Rough / Uncut Gem',
  'Other',
];

export const GEM_ORIGINS = [
  'Ceylon (Sri Lanka)',
  'Madagascar',
  'Burma (Myanmar)',
  'Mozambique',
  'Tanzania',
  'Zambia',
  'Brazil',
  'Colombia',
  'Afghanistan',
  'Other',
];

export const GEM_CLARITIES = [
  'VVS / Loupe Clean',
  'VS / Eye Clean',
  'SI / Slightly Included',
  'I / Included',
  'Opaque / Cabochon Grade',
];

export const GEM_COLORS = [
  'Blue',
  'Red',
  'Pink',
  'Yellow',
  'Green',
  'Orange',
  'Purple',
  'White / Colorless',
  'Parti-color',
  'Other',
];

export const GEM_SHAPES = [
  'Oval',
  'Cushion',
  'Round',
  'Emerald Cut',
  'Cabochon',
  'Rough (Uncut)',
  'Other',
];

export const GEM_TREATMENTS = [
  'Unheated / 100% Natural',
  'Heated (Standard)',
  'Beryllium Treated',
  'Glass Filled',
];

export const CERTIFICATION_STATUSES = ['Certified', 'Not Certified'];

export const CERTIFICATION_LABS = ['GIA', 'GRS', 'CGL', 'AIGS', 'IGI', 'Other'];

export const PROVINCE_CITY_MAP: Record<string, string[]> = {
  Western: ['Colombo', 'Dehiwala-Mount Lavinia', 'Moratuwa', 'Negombo', 'Gampaha', 'Kalutara', 'Panadura', 'Ja-Ela'],
  Central: ['Kandy', 'Matale', 'Nuwara Eliya', 'Gampola', 'Nawalapitiya', 'Hatton'],
  Southern: ['Galle', 'Matara', 'Hambantota', 'Tangalle', 'Weligama', 'Ambalangoda'],
  Northern: ['Jaffna', 'Vavuniya', 'Mannar', 'Kilinochchi', 'Mullaitivu', 'Point Pedro'],
  Eastern: ['Trincomalee', 'Batticaloa', 'Ampara', 'Kalmunai', 'Kattankudy'],
  'North Western': ['Kurunegala', 'Puttalam', 'Chilaw', 'Wariyapola', 'Kuliyapitiya'],
  'North Central': ['Anuradhapura', 'Polonnaruwa', 'Kekirawa', 'Medawachchiya'],
  Uva: ['Badulla', 'Bandarawela', 'Moneragala', 'Wellawaya', 'Haputale'],
  Sabaragamuwa: ['Ratnapura', 'Kegalle', 'Embilipitiya', 'Balangoda'],
};

export const PROVINCES = Object.keys(PROVINCE_CITY_MAP);

const USD_TO_LKR_ESTIMATE = 300;

export const getEstimatedRequiredCredits = (amount: number, currency: 'LKR' | 'USD') => {
  const lkrAmount = currency === 'USD' ? amount * USD_TO_LKR_ESTIMATE : amount;
  if (lkrAmount < 10000) return 1;
  if (lkrAmount < 50000) return 4;
  return 6;
};