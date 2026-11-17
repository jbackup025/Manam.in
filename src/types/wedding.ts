import type { Timestamp } from 'firebase/firestore';
import type { HeadingFontName, ThemePresetId } from '../lib/constants';

export type WeddingStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'SUSPENDED'
  | 'DELETION_PENDING';

export interface WeddingDoc {
  slug: string;
  status: WeddingStatus;
  coupleNames: string;
  weddingDate: string; // YYYY-MM-DD
  expiresAt: Timestamp;
  graceDays: number;
  readyForErase: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface WeddingAdminDoc {
  email: string;
  addedBy: string;
  addedAt: Timestamp;
}

export type SectionId =
  | 'story'
  | 'events'
  | 'accommodations'
  | 'gallery'
  | 'rsvp'
  | 'wishlist'
  | 'faq'
  | 'spotify';

export interface SectionConfig {
  id: SectionId;
  enabled: boolean;
  title: string;
}

export interface EventItem {
  id: string;
  title: string;
  date: string;
  time: string;
  venue: string;
  address: string;
  mapLink: string;
  photoAssetId: string;
  fallbackUrl: string;
  description: string;
}

export interface AccommodationItem {
  id: string;
  name: string;
  address: string;
  phone: string;
  mapLink: string;
  notes: string;
}

export interface GalleryItem {
  id: string;
  assetId: string;
  fallbackUrl: string;
  caption: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface RsvpFieldSetting {
  visible: boolean;
  required: boolean;
  label: string;
}

export interface CustomQuestion {
  id: string;
  label: string;
  type: 'text' | 'choice';
  required: boolean;
  options: string[];
}

export interface BeneficiaryConfig {
  enabled: boolean;
  displayName: string;
  upiId: string;
  payeeName: string;
  qrAssetId: string;
  description: string;
}

export interface PublicSiteDoc {
  couple: {
    partner1Name: string;
    partner2Name: string;
    partner1Role: string;
    partner2Role: string;
    weddingDate: string;
    weddingTime: string;
    heroTagline: string;
    openingVerse: string;
    logoAssetId: string;
    heroAssetId: string;
    coverAssetId: string;
    heroFallbackUrl: string;
    contactName: string;
    contactPhone: string;
  };
  theme: {
    preset: ThemePresetId;
    primaryColor: string;
    accentColor: string;
    backgroundColor: string;
    headingFont: HeadingFontName;
  };
  seo: {
    hideFromSearchEngines: boolean;
    customTitle: string;
    customDescription: string;
  };
  countdownEnabled: boolean;
  sections: SectionConfig[];
  story: {
    heading: string;
    body: string;
    imageAssetId: string;
    fallbackUrl: string;
  };
  events: EventItem[];
  accommodations: AccommodationItem[];
  gallery: GalleryItem[];
  faq: FaqItem[];
  spotifyUrl: string;
  rsvpConfig: {
    enabled: boolean;
    deadline: string; // YYYY-MM-DD or ''
    maxGuests: number;
    maxRooms: number;
    groups: string[];
    fields: {
      email: RsvpFieldSetting;
      group: RsvpFieldSetting;
      allergies: RsvpFieldSetting;
      accommodation: RsvpFieldSetting;
      blessing: RsvpFieldSetting;
    };
    customQuestions: CustomQuestion[];
    submitButtonText: string;
    thankYouHeading: string;
    thankYouMessage: string;
  };
  wishlistConfig: {
    enabled: boolean;
    title: string;
    story: string;
    targetPaise: number;
    showTargetPublicly: boolean;
    thankYouMessage: string;
    buttonText: string;
    partner1: BeneficiaryConfig;
    partner2: BeneficiaryConfig;
  };
  labels: {
    rsvpNavLabel: string;
    wishlistNavLabel: string;
    copyLinkText: string;
    shareWhatsappText: string;
  };
  rsvpDeadlineTs: Timestamp | null;
  updatedAt: Timestamp;
}

export interface PublicProgressDoc {
  confirmedTotalPaise: number;
  partner1TotalPaise: number;
  partner2TotalPaise: number;
  confirmedCount: number;
  updatedAt: Timestamp;
}

export type AssetKind = 'logo' | 'qr' | 'hero' | 'gallery' | 'story' | 'event';

export interface WeddingAssetDoc {
  id?: string;
  kind: AssetKind;
  dataUrl: string;
  width: number;
  height: number;
  bytes: number;
  createdAt: Timestamp;
}

export interface PartyGuest {
  name: string;
  diet: 'veg' | 'non-veg';
}

export type RsvpStatus = 'confirmed' | 'declined' | 'pending';

export interface RsvpDoc {
  id?: string;
  refCode: string;
  attending: 'yes' | 'no';
  status?: RsvpStatus;
  fullName: string;
  mobile?: string;
  email: string;
  group: string;
  guestCount: number;
  partyGuests: PartyGuest[];
  allergies: string;
  accommodationNeeded: boolean;
  roomsNeeded: number;
  checkInDate: string;
  checkOutDate: string;
  roomSharingNote: string;
  customAnswers: Record<string, string>;
  blessingMessage: string;
  consentAccepted: boolean;
  assignedRoom: string;
  accommodationStatus: 'pending' | 'confirmed';
  adminCheckInDate: string;
  adminCheckOutDate: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ContributionDoc {
  id?: string;
  ref: string;
  recipient: 'partner1' | 'partner2';
  amountPaise: number;
  donorName: string;
  message: string;
  showName: boolean;
  status: 'pending' | 'confirmed' | 'reversed';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface BlessingDoc {
  id?: string;
  displayName: string;
  message: string;
  approved: boolean;
  source: 'contribution' | 'rsvp';
  sourceId: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface AuditLogDoc {
  id?: string;
  actorEmail: string;
  action: string;
  targetId: string;
  timestamp: Timestamp;
}

export interface PlatformAuditLogDoc {
  id?: string;
  actorEmail: string;
  action: string;
  targetSlug: string;
  timestamp: Timestamp;
}
