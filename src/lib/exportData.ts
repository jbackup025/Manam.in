import * as XLSX from 'xlsx';
import { formatINR } from './constants';
import type { BlessingDoc, ContributionDoc, RsvpDoc } from '../types/wedding';

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value: unknown): string {
  const str = value == null ? '' : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function downloadCsv(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
  filename: string
) {
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((r) => r.map(escapeCsvCell).join(',')),
  ];
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], {
    type: 'text/csv;charset=utf-8',
  });
  triggerDownload(blob, filename);
}

export function exportRsvpsToCsv(slug: string, rsvps: RsvpDoc[]) {
  const headers = [
    'Ref Code',
    'Attending',
    'Full Name',
    'Mobile',
    'Email',
    'Family/Group',
    'Guest Count',
    'Party Guests (Name & Diet)',
    'Allergies',
    'Accommodation Needed',
    'Rooms Needed',
    'Check-In',
    'Check-Out',
    'Room Sharing Note',
    'Assigned Room',
    'Accommodation Status',
    'Blessing Message',
  ];

  const rows = rsvps.map((r) => [
    r.refCode,
    r.attending === 'yes' ? 'Joyfully Accepts' : 'Regretfully Declines',
    r.fullName,
    r.mobile,
    r.email,
    r.group,
    r.guestCount,
    r.partyGuests.map((g) => `${g.name} (${g.diet === 'veg' ? 'Veg' : 'Non-Veg'})`).join('; '),
    r.allergies,
    r.accommodationNeeded ? 'Yes' : 'No',
    r.roomsNeeded,
    r.adminCheckInDate || r.checkInDate,
    r.adminCheckOutDate || r.checkOutDate,
    r.roomSharingNote,
    r.assignedRoom,
    r.accommodationStatus,
    r.blessingMessage,
  ]);

  downloadCsv(headers, rows, `${slug}-rsvps.csv`);
}

export function exportRsvpsToExcel(slug: string, rsvps: RsvpDoc[]) {
  const rows = rsvps.map((r) => ({
    'Ref Code': r.refCode,
    Attending: r.attending === 'yes' ? 'Joyfully Accepts' : 'Regretfully Declines',
    'Full Name': r.fullName,
    Mobile: r.mobile,
    Email: r.email,
    'Family / Group': r.group,
    'Guest Count': r.guestCount,
    'Party Details': r.partyGuests
      .map((g) => `${g.name} (${g.diet === 'veg' ? 'Veg' : 'Non-Veg'})`)
      .join('; '),
    Allergies: r.allergies,
    'Accommodation Needed': r.accommodationNeeded ? 'Yes' : 'No',
    'Rooms Needed': r.roomsNeeded,
    'Check-In': r.adminCheckInDate || r.checkInDate,
    'Check-Out': r.adminCheckOutDate || r.checkOutDate,
    'Room Sharing Note': r.roomSharingNote,
    'Assigned Room': r.assignedRoom,
    'Accommodation Status': r.accommodationStatus,
    Blessing: r.blessingMessage,
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'RSVPs');
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  triggerDownload(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `${slug}-rsvps.xlsx`
  );
}

export function exportContributionsToCsv(
  slug: string,
  contributions: ContributionDoc[],
  partner1Label: string,
  partner2Label: string
) {
  const headers = [
    'Ref',
    'Status',
    'Recipient',
    'Amount (INR)',
    'Donor Name',
    'Show Name Publicly',
    'Message',
  ];
  const rows = contributions.map((c) => [
    c.ref,
    c.status.toUpperCase(),
    c.recipient === 'partner1' ? partner1Label : partner2Label,
    formatINR(c.amountPaise),
    c.donorName,
    c.showName ? 'Yes' : 'Anonymous',
    c.message,
  ]);
  downloadCsv(headers, rows, `${slug}-contributions.csv`);
}

export function exportAllWeddingJson(
  slug: string,
  data: {
    site: unknown;
    rsvps: RsvpDoc[];
    contributions: ContributionDoc[];
    blessings: BlessingDoc[];
  }
) {
  const payload = {
    exportedAt: new Date().toISOString(),
    slug,
    ...data,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  triggerDownload(blob, `${slug}-backup.json`);
}
