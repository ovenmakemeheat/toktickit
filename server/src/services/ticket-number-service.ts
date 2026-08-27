import { randomInt } from "node:crypto";

const ticketNumberAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
export const ticketNumberPattern = /^TT-\d{8}-[A-Z0-9]{6}$/;

function createSuffix() {
  return Array.from({ length: 6 }, () =>
    ticketNumberAlphabet.charAt(randomInt(ticketNumberAlphabet.length)),
  ).join("");
}

export function formatTicketNumber(ticketDate: Date, suffix: string) {
  const normalizedSuffix = suffix.toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(normalizedSuffix)) {
    throw new Error(
      "Ticket Number suffix must contain six uppercase characters",
    );
  }

  const datePart = ticketDate.toISOString().slice(0, 10).replaceAll("-", "");
  return `TT-${datePart}-${normalizedSuffix}`;
}

export function generateTicketNumber(ticketDate = new Date()) {
  return formatTicketNumber(ticketDate, createSuffix());
}
