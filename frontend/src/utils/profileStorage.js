const STORAGE_KEY = 'splitroof-profile';

const emptyProfile = {
  username: '',
  incomeType: 'gross',
  grossIncome: '',
  netIncome: '',
  taxPercent: '',
  household: null,
  households: [],
};

export const clampTax = (value) => Math.min(Math.max(Number(value) || 0, 0), 100);

export const calcNetFromGross = (gross, taxPercent) => {
  const amount = Number(gross) || 0;
  return Math.round(amount * (1 - clampTax(taxPercent) / 100) * 100) / 100;
};

export const calcGrossFromNet = (net, taxPercent) => {
  const amount = Number(net) || 0;
  const tax = clampTax(taxPercent);
  if (tax >= 100) return 0;
  return Math.round((amount / (1 - tax / 100)) * 100) / 100;
};

export const getProfileNetIncome = (profile) => {
  if (profile.incomeType === 'net') return Number(profile.netIncome) || 0;
  const gross = Number(profile.grossIncome) || 0;
  return calcNetFromGross(gross, profile.taxPercent);
};

export const makeJoinCode = () =>
  Math.random().toString(36).slice(2, 8).toUpperCase();

export const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
};

export const isSharedHousehold = (household) => (household?.members || []).length > 1;

const SAMPLE_MEMBERS = ['Alex', 'Marta'];

const mergeSampleMembers = (members = []) => {
  const next = [];
  const seen = new Set();

  members.forEach((name) => {
    const sample = SAMPLE_MEMBERS.find((item) => item.toLowerCase() === String(name).toLowerCase());
    const label = sample || String(name || '').trim();
    const key = label.toLowerCase();
    if (!label || seen.has(key)) return;
    seen.add(key);
    next.push(label);
  });

  SAMPLE_MEMBERS.forEach((sample) => {
    if (seen.has(sample.toLowerCase())) return;
    seen.add(sample.toLowerCase());
    next.push(sample);
  });

  return next;
};

export const ensureSampleMembers = (profile = loadProfileData()) => {
  if (getStoredUser() || !profile?.household) return profile;

  const members = mergeSampleMembers(profile.household.members);
  const current = profile.household.members || [];
  const unchanged = members.length === current.length && members.every((name, index) => name === current[index]);
  if (unchanged) return profile;

  const household = { ...profile.household, members };
  const households = (profile.households?.length ? profile.households : [household]).map((item) =>
    item.id === household.id ? { ...item, members } : item
  );

  return saveProfileData({ household, households });
};

export const getHouseholdUsers = (profile = loadProfileData()) => {
  const username = profile.username || getStoredUser()?.username || '';
  const members = profile.household?.members || [];

  if (members.length) {
    return Array.from(new Set([...members, username].filter(Boolean)));
  }

  return username ? [username] : [];
};

export const applyServerUser = (user) => {
  if (!user) return loadProfileData();

  localStorage.setItem('user', JSON.stringify({
    _id: user._id,
    username: user.username,
    email: user.email,
  }));

  const next = saveProfileData({
    username: user.username || '',
    incomeType: user.incomeType || 'gross',
    grossIncome: user.grossIncome ?? '',
    netIncome: user.netIncome ?? '',
    taxPercent: user.taxPercent ?? '',
    household: user.household || null,
    households: Array.isArray(user.households) ? user.households : (user.household ? [user.household] : []),
  });

  window.dispatchEvent(new Event('authChange'));
  return next;
};

export const loadProfileData = () => {
  if (typeof localStorage === 'undefined') return { ...emptyProfile };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...emptyProfile };

    const data = JSON.parse(raw);
    delete data.joinedIncomeWith;
    return {
      ...emptyProfile,
      ...data,
      household: data.household || null,
      households: Array.isArray(data.households)
        ? data.households
        : (data.household ? [data.household] : []),
    };
  } catch {
    return { ...emptyProfile };
  }
};

export const saveProfileData = (data) => {
  const next = {
    ...emptyProfile,
    ...loadProfileData(),
    ...data,
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event('profileChange'));
  return next;
};

export const syncStoredUsername = (username) => {
  const user = getStoredUser();
  if (user) {
    localStorage.setItem('user', JSON.stringify({ ...user, username }));
    window.dispatchEvent(new Event('authChange'));
  }
};
