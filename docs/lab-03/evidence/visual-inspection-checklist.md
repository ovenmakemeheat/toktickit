# Lab 3 Zen Green visual inspection checklist

Issue: #76 — Lab 3 - Zen Green responsive visual inspection  
Branch: `feature/18-zen-green-visual-inspection`  
Inspection date: 2026-09-18

## Viewport evidence

The final branch was inspected in Chrome against the seeded test database at the required viewports:

- Desktop: `1280x900`
- Tablet: `820x900`
- Mobile: `390x844`

All inspected routes reported `document.documentElement.scrollWidth === innerWidth`; no horizontal page overflow was observed. The dense IT Staff Queue uses the complete card representation through `1399px`, so the desktop capture remains readable instead of clipping the ten-column table. A table is retained for wider desktop widths.

### Authentication

| Screen | Desktop | Tablet | Mobile |
| --- | --- | --- | --- |
| Login | [capture](../../../artifacts/lab-03/screenshots/authentication/login-desktop.png) | [capture](../../../artifacts/lab-03/screenshots/authentication/login-tablet.png) | [capture](../../../artifacts/lab-03/screenshots/authentication/login-mobile.png) |
| Change password | [capture](../../../artifacts/lab-03/screenshots/authentication/change-password-desktop.png) | [capture](../../../artifacts/lab-03/screenshots/authentication/change-password-tablet.png) | [capture](../../../artifacts/lab-03/screenshots/authentication/change-password-mobile.png) |

### IT Staff

| Screen | Desktop | Tablet | Mobile |
| --- | --- | --- | --- |
| Ticket Queue | [capture](../../../artifacts/lab-03/screenshots/staff-queue/staff-queue-desktop.png) | [capture](../../../artifacts/lab-03/screenshots/staff-queue/staff-queue-tablet.png) | [capture](../../../artifacts/lab-03/screenshots/staff-queue/staff-queue-mobile.png) |
| Ticket Detail | [capture](../../../artifacts/lab-03/screenshots/staff-ticket-detail/staff-ticket-detail-desktop.png) | [capture](../../../artifacts/lab-03/screenshots/staff-ticket-detail/staff-ticket-detail-tablet.png) | [capture](../../../artifacts/lab-03/screenshots/staff-ticket-detail/staff-ticket-detail-mobile.png) |

### Administrator

| Screen | Desktop | Tablet | Mobile |
| --- | --- | --- | --- |
| User Management list | [capture](../../../artifacts/lab-03/screenshots/user-management/user-management-desktop.png) | [capture](../../../artifacts/lab-03/screenshots/user-management/user-management-tablet.png) | [capture](../../../artifacts/lab-03/screenshots/user-management/user-management-mobile.png) |
| Create user form | [capture](../../../artifacts/lab-03/screenshots/user-management/user-management-create-desktop.png) | [capture](../../../artifacts/lab-03/screenshots/user-management/user-management-create-tablet.png) | [capture](../../../artifacts/lab-03/screenshots/user-management/user-management-create-mobile.png) |
| Ticket Review entry | [capture](../../../artifacts/lab-03/screenshots/user-management/admin-ticket-review-entry-desktop.png) | [capture](../../../artifacts/lab-03/screenshots/user-management/admin-ticket-review-entry-tablet.png) | [capture](../../../artifacts/lab-03/screenshots/user-management/admin-ticket-review-entry-mobile.png) |
| Ticket Review detail | [capture](../../../artifacts/lab-03/screenshots/user-management/admin-ticket-review-desktop.png) | [capture](../../../artifacts/lab-03/screenshots/user-management/admin-ticket-review-tablet.png) | [capture](../../../artifacts/lab-03/screenshots/user-management/admin-ticket-review-mobile.png) |

## Review results

- [x] Zen Green tokens, typography, spacing, borders, surfaces, buttons, badges, read-only fields, and focus treatment are consistent across the inspected screens.
- [x] Authenticated identity, role badge, permitted navigation, Password, and Log out remain visible and usable at all three viewports.
- [x] Login and Change Password expose labels, required indicators, rule/help text, safe action labels, and state regions.
- [x] Requester regression routes (`/tickets`, `/tickets/new`, `/tickets/1`) were checked at all three viewports; no Development Requester selector or Change Requester action is rendered.
- [x] Ticket Queue filters, sorting, pagination, owner/status/priority values, and Open detail remain available. Cards retain the required ticket values and action when the table would be too dense.
- [x] Ticket Detail preserves the read-only facts/operational distinction and keeps Public Comments, Internal Notes, Attachments, and the requester resolution indication visibly separate.
- [x] Administrator Ticket Review keeps facts read-only, exposes only IT Priority mutation, and keeps comments, notes, attachments, and resolution indication visibly separate.
- [x] User Management shows the required Name, Email, Role, Status, and Edit information. Tablet and mobile cards retain every required value and Edit action.
- [x] Desktop, tablet, and mobile inspection found no clipped labels, overlapping messages, hidden required controls, or horizontal page overflow.
- [x] Keyboard-visible focus, associated labels, required indicators, alert/live-region hooks, readable action names, and text alternatives were checked against the shared component tests and final rendered screens.

## Limits of this evidence

Screenshots prove the final rendered presentation only. They do not prove authorization or data isolation. API and component tests remain the evidence for forbidden, not-found, validation, conflict, loading, success, and failure behavior.
