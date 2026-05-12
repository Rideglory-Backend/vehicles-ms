# Product Requirements Document — Rideglory

> Version: 1.0
> Updated: 2026-05-11
> Status: Draft — edit this file, then run `/solo-plan` to generate the iteration plan.

---

## 1. Product overview

**Rideglory** is a Flutter mobile application for motorcycle riding events and community coordination. It enables riders to discover events, register for rides, manage their garage of vehicles, track live ride positions, and connect with other riders.

The app targets Android and iOS. The backend is **rideglory-api** — a NestJS microservices system at `/Users/cami/Developer/Personal/rideglory-api` — that provides REST and WebSocket APIs authenticated via Firebase ID tokens.

---

## 2. Existing system

- **Base path:** `/Users/cami/Developer/Personal/Rideglory`
- **Flutter app:** `lib/` — Clean Architecture (domain/data/presentation per feature)
- **Backend:** `/Users/cami/Developer/Personal/rideglory-api` — NestJS microservices (gateway, tracking, events, users)
- **Notes:** Brownfield. Authentication, vehicle management, event registration, event listing, user profiles, and live tracking are partially or fully implemented. See `docs/handoffs/planning/00-existing-system-scan.md` after running `/solo-plan`.

---

## 3. Personas

**Rider** — primary user. Registers for events, tracks live rides, manages their vehicle garage, views other riders' profiles.

**Event Organizer** — creates and manages events, approves/rejects registrations, monitors live ride tracking during events.

**Admin** — manages platform configuration (future).

---

## 4. Core features (what the app must do)

> The planning team will break these into iterations. Replace this list with more specific functional requirements as they are clarified.

### Authentication
- Email/password sign-in and registration
- Google sign-in
- Apple sign-in (iOS)
- Firebase Auth token refreshed automatically

### Vehicle Garage
- Add vehicles with make, model, year, VIN, license plate
- Set main vehicle
- Upload vehicle photo (Firebase Storage)
- Edit and delete vehicles

### Event Discovery
- Browse upcoming events (list and detail views)
- Filter events by type, date, location
- View event organizer and attendee list

### Event Registration
- Register for events
- Organizer approval / rejection workflow
- View my registrations (pending, approved, rejected)
- Registration detail with event info

### Live Event Tracking
- Real-time GPS location sharing during active events (WebSocket)
- Map view showing all riders' positions
- Battery-aware location updates
- Auto-reconnect on disconnect

### User Profiles
- View own profile and other riders' profiles
- Profile photo (Firebase Storage)
- Vehicle showcase

### Maintenance Log
- Log maintenance records per vehicle (date, type, mileage, notes)

---

## 5. Technical constraints

- **Platform:** Flutter (Android + iOS). Minimum SDK: Android API 21, iOS 13.
- **State management:** BLoC/Cubit + `ResultState<T>` freezed union — no boolean flags for async state.
- **Architecture:** Clean Architecture (domain / data / presentation) per feature. One widget per file.
- **Backend:** rideglory-api NestJS microservices. All endpoints require Firebase ID token.
- **Auth:** Firebase Auth (email, Google, Apple). Token injected by `FirebaseAuthInterceptor`.
- **HTTP:** Dio + Retrofit (code-generated clients). Base URL from Firebase Remote Config (prod) or `.env` (dev).
- **Localization:** All UI strings in Spanish via `lib/l10n/app_es.arb` → `context.l10n.<key>`.
- **Design system:** Dark mode, orange primary `#f98c1f`, Space Grotesk font, 8px border radius.
- **No Playwright** — QA uses `flutter test`, `dart analyze`, widget tests.

---

## 6. Quality expectations

- `dart analyze` must pass with zero violations on every iteration.
- `flutter test` must pass on every iteration.
- No hardcoded strings in UI (always via ARB).
- No raw Material widgets where a shared equivalent exists (`AppButton`, `AppTextField`, etc.).
- No layer violations (domain must not import Flutter; presentation must not call HTTP directly).

---

## 7. Security requirements

- Firebase ID tokens validated on every rideglory-api protected endpoint.
- No secrets committed to source (`.env.example` with placeholders only; real values in GitHub Actions secrets).
- Firebase config files (`google-services.json`, `GoogleService-Info.plist`) injected from CI secrets, never committed.

---

## 8. Success criteria

- Riders can discover, register for, and attend events end-to-end in the mobile app.
- Live tracking shows all riders on a map in real-time during an active event.
- The app builds and passes CI (`dart analyze` + `flutter test`) on every push to `iter-N`.

---

## 9. Out of scope

- Web version of the app
- Admin dashboard web UI
- Push notifications (future)
- Payment processing
- Social feed / posts

---

## How to use this PRD

1. Edit sections 4–8 with specific acceptance criteria as features are clarified.
2. Run `/solo-plan` — the PO agent will break this into iterations.
3. Review `docs/PLAN.md` and the dashboard (`python3 server.py`).
4. Run `/solo-approve` when the plan is ready.
5. Run `/iter 1` to start building.
