import { Timestamp } from 'firebase/firestore';
import { THEME_PRESETS, type ThemePresetId } from './constants';
import type { PublicSiteDoc } from '../types/wedding';

export function buildInitialPublicSite(params: {
  partner1Name: string;
  partner2Name: string;
  weddingDate: string;
  themePresetId?: ThemePresetId;
}): Omit<PublicSiteDoc, 'updatedAt'> & { updatedAt: ReturnType<typeof Timestamp.now> } {
  const preset =
    THEME_PRESETS.find((t) => t.id === (params.themePresetId || 'classic-gold')) ||
    THEME_PRESETS[0];

  return {
    couple: {
      partner1Name: params.partner1Name,
      partner2Name: params.partner2Name,
      partner1Role: 'Bride',
      partner2Role: 'Groom',
      weddingDate: params.weddingDate,
      weddingTime: '10:30 AM',
      heroTagline: 'Together with our families, we joyfully invite you to celebrate our wedding.',
      openingVerse: 'With gratitude, love, and warm blessings.',
      logoAssetId: '',
      heroAssetId: '',
      coverAssetId: '',
      heroFallbackUrl: '',
      contactName: '',
      contactPhone: '',
    },
    theme: {
      preset: preset.id,
      primaryColor: preset.primaryColor,
      accentColor: preset.accentColor,
      backgroundColor: preset.backgroundColor,
      headingFont: preset.headingFont,
    },
    seo: {
      hideFromSearchEngines: true,
      customTitle: `${params.partner1Name} & ${params.partner2Name} — Wedding Invitation`,
      customDescription: `Join ${params.partner1Name} & ${params.partner2Name} for their wedding celebrations on ${params.weddingDate}.`,
    },
    countdownEnabled: true,
    sections: [
      { id: 'story', enabled: true, title: 'Our Story' },
      { id: 'events', enabled: true, title: 'Celebrations & Schedule' },
      { id: 'accommodations', enabled: true, title: 'Stay & Travel' },
      { id: 'gallery', enabled: true, title: 'Moments' },
      { id: 'rsvp', enabled: true, title: 'RSVP' },
      { id: 'wishlist', enabled: true, title: 'Wishlist - Moi' },
      { id: 'faq', enabled: true, title: 'Guest Notes' },
      { id: 'spotify', enabled: false, title: 'Wedding Playlist' },
    ],
    story: {
      heading: 'Two families, one celebration',
      body: 'We are grateful to share this milestone with the family and friends who shaped our lives. Thank you for travelling near and far to bless us.',
      imageAssetId: '',
      fallbackUrl: '',
    },
    events: [
      {
        id: 'ceremony',
        title: 'Wedding Ceremony',
        date: params.weddingDate,
        time: '10:30 AM',
        venue: 'Main Courtyard Mandap',
        address: 'Address to be updated by the couple',
        mapLink: '',
        photoAssetId: '',
        fallbackUrl: '',
        description: 'Traditional morning ceremony followed by lunch.',
      },
    ],
    accommodations: [],
    gallery: [],
    faq: [
      {
        id: 'faq-1',
        question: 'What is the dress code?',
        answer: 'Traditional Indian attire or formal festive wear.',
      },
    ],
    spotifyUrl: '',
    rsvpConfig: {
      enabled: true,
      deadline: '',
      maxGuests: 10,
      maxRooms: 4,
      groups: ['Bride Family', 'Groom Family', 'Friends', 'Colleagues'],
      fields: {
        email: { visible: true, required: false, label: 'Email address' },
        group: { visible: true, required: true, label: 'Family or Group' },
        allergies: { visible: true, required: false, label: 'Dietary notes or allergies' },
        accommodation: { visible: true, required: false, label: 'Do you need accommodation?' },
        blessing: { visible: true, required: false, label: 'A blessing or note for the couple' },
      },
      customQuestions: [],
      submitButtonText: 'Confirm RSVP',
      thankYouHeading: 'We have received your response',
      thankYouMessage: 'Keep your reference code handy if you need to update your party details before the deadline.',
    },
    wishlistConfig: {
      enabled: true,
      title: 'Wishlist - Moi',
      story: 'Your presence at our wedding is the greatest gift. For loved ones who wish to send traditional moi from afar, you may bless either of us directly via UPI.',
      targetPaise: 10000000,
      showTargetPublicly: false,
      thankYouMessage: 'Thank you for your warm blessing and thoughtful contribution.',
      buttonText: 'Send Moi Blessing',
      partner1: {
        enabled: true,
        displayName: params.partner1Name,
        upiId: '',
        payeeName: '',
        qrAssetId: '',
        description: `${params.partner1Name}'s family Moi account`,
      },
      partner2: {
        enabled: true,
        displayName: params.partner2Name,
        upiId: '',
        payeeName: '',
        qrAssetId: '',
        description: `${params.partner2Name}'s family Moi account`,
      },
    },
    labels: {
      rsvpNavLabel: 'RSVP',
      wishlistNavLabel: 'Wishlist - Moi',
      copyLinkText: 'Copy invitation link',
      shareWhatsappText: 'Share on WhatsApp',
    },
    rsvpDeadlineTs: null,
    updatedAt: Timestamp.now(),
  };
}
