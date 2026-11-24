# Unfazed — Therapist Practice Platform (MVP)

This is a runnable MERN-style starter based on the supplied Unlox project brief.
It includes therapist registration/login, public therapist profiles, client CRM,
availability and booking, private/shared session notes, package/payment records,
chat, subscription feature gating, and analytics.

## Requirements
- Node.js 18+
- MongoDB local instance or MongoDB Atlas connection string
- Two terminals

## 1. Backend
```bash
cd unfazed-backend
cp .env.example .env
npm install
npm run dev
```
Set `MONGO_URI` in `.env`. The API runs at http://localhost:5000.
Health check: http://localhost:5000/api/health

## 2. Frontend
Open a second terminal:
```bash
cd unfazed-frontend
npm install
npm run dev
```
Open the Vite URL shown (normally http://localhost:5173).

## Demo flow
1. Register a therapist account.
2. Edit the public profile from the dashboard.
3. Add clients and availability slots.
4. Open the public profile at `/t/your-slug` and book an available slot.
5. Add session notes. Private notes are returned only to the therapist; clients only receive shared notes.
6. Use the Payments and Analytics sections.

## Important scope notes
- Razorpay is represented by a safe demo payment record flow. Real payments require Razorpay account credentials, server-side order creation, signature verification, and webhook configuration.
- Email/WhatsApp notifications are logged as stub events; no messages are sent.
- Chat uses Socket.IO when both users are connected.
- This is an educational MVP, not a production clinical-record system. Before real use, add legal/privacy review, encryption/key management, audit logging, backups, rate limiting, stronger validation, consent workflows, and security testing. Do not enter real patient data in this demo.
