import { Timestamp, doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { buildInitialPublicSite } from './defaultSite';
import { db } from './firebase';

/**
 * Seeds the staging "demo" wedding if it does not yet exist and is not reserved.
 * Only intended for staging / development projects, invoked explicitly by the Super Admin.
 */
export async function seedStagingDemoWedding(actorEmail: string): Promise<void> {
  const slug = 'demo';
  const reservedSnap = await getDoc(doc(db, 'reservedSlugs', slug));
  if (reservedSnap.exists()) {
    throw new Error('The "demo" slug was previously erased and is permanently reserved.');
  }

  const existingSnap = await getDoc(doc(db, 'weddings', slug));
  if (existingSnap.exists()) {
    throw new Error('Demo wedding already exists.');
  }

  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 45);
  const weddingDateStr = futureDate.toISOString().slice(0, 10);

  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 90);

  const site = buildInitialPublicSite({
    partner1Name: 'Jerin',
    partner2Name: 'Vini',
    weddingDate: weddingDateStr,
    themePresetId: 'classic-gold',
  });

  site.couple.heroTagline =
    'With joyful hearts, our families invite you to gather in Chennai and bless our new beginning.';
  site.couple.openingVerse = 'Love is patient, love is kind — and shared joy is doubled.';
  site.couple.heroFallbackUrl = '/src/assets/images/demo_wedding_hero_1794917674013.jpg';
  site.story.imageAssetId = '';
  site.story.fallbackUrl = '/src/assets/images/demo_couple_portrait_1794917673218.jpg';
  site.story.heading = 'From temple courtyard coffee to forever';
  site.story.body =
    'What began over filter coffee after a morning concert in Mylapore grew into six years of shared books, family festivals, and long coastal drives. We cannot wait to welcome every person who walked beside us.';

  site.events = [
    {
      id: 'nalangu',
      title: 'Sangeet & Mehendi',
      date: weddingDateStr,
      time: '05:30 PM',
      venue: 'The Banyan Lawn, ITC Grand Chola',
      address: '63 Mount Road, Guindy, Chennai 600032',
      mapLink: 'https://maps.google.com/?q=ITC+Grand+Chola+Chennai',
      photoAssetId: '',
      fallbackUrl: '/src/assets/images/demo_ceremony_venue_1794917674422.jpg',
      description: 'An evening of music, floral garlands, and family warmth under the courtyard lights.',
    },
    {
      id: 'muhurtham',
      title: 'Muhurtham Ceremony',
      date: weddingDateStr,
      time: '09:15 AM',
      venue: 'Vadapalani Heritage Mandapam',
      address: '14 Temple Courtyard Road, Mylapore, Chennai 600004',
      mapLink: 'https://maps.google.com/?q=Mylapore+Chennai',
      photoAssetId: '',
      fallbackUrl: '/src/assets/images/demo_wedding_hero_1794917674013.jpg',
      description: 'Traditional morning wedding ceremony followed by a seated banana-leaf sadhya.',
    },
  ];

  site.accommodations = [
    {
      id: 'hotel-1',
      name: 'The Raintree Courtyard',
      address: '120 St. Marys Road, Alwarpet, Chennai',
      phone: '+91 44 2430 4050',
      mapLink: 'https://maps.google.com/?q=Alwarpet+Chennai',
      notes: '10 minutes from the mandapam. Mention the Jerin & Vini block when checking in.',
    },
  ];

  site.gallery = [
    {
      id: 'gal-1',
      assetId: '',
      fallbackUrl: '/src/assets/images/demo_wedding_hero_1794917674013.jpg',
      caption: 'Morning mandap preparations',
    },
    {
      id: 'gal-2',
      assetId: '',
      fallbackUrl: '/src/assets/images/demo_couple_portrait_1794917673218.jpg',
      caption: 'Heirloom silk and jasmine garlands',
    },
    {
      id: 'gal-3',
      assetId: '',
      fallbackUrl: '/src/assets/images/demo_ceremony_venue_1794917674422.jpg',
      caption: 'Evening courtyard dinner',
    },
  ];

  const batch = writeBatch(db);
  batch.set(doc(db, 'weddings', slug), {
    slug,
    status: 'ACTIVE',
    coupleNames: 'Jerin & Vini',
    weddingDate: weddingDateStr,
    expiresAt: Timestamp.fromDate(expiryDate),
    graceDays: 30,
    readyForErase: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, 'weddings', slug, 'admins', actorEmail.toLowerCase()), {
    email: actorEmail.toLowerCase(),
    addedBy: actorEmail.toLowerCase(),
    addedAt: serverTimestamp(),
  });

  batch.set(doc(db, 'weddings', slug, 'public', 'site'), {
    ...site,
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
}
