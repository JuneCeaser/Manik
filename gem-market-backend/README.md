# Gem Market Backend — Registration & Login

Phone OTP is only used once, to verify a number at signup. After that,
login is phone + password. JWT issued on both register and login.

## Setup

1. `npm install`
2. `.env` is already filled in with your Mongo URI and JWT secret — just
   fill in `TEXTLK_API_KEY` with your **regenerated** Text.lk token.
3. `npm run dev` (or `npm start`)

## Flow

**Register (one-time, OTP required):**
1. `POST /api/auth/register/send-otp` `{ phone, name, password }` → SMS sent.
   Password is hashed immediately and held with the OTP record — the
   plain-text password is never written to the database.
2. `POST /api/auth/register/verify-otp` `{ phone, code }` → account created
   with the hashed password, returns `{ token, user }`

**Login (every time after that, no OTP):**
1. `POST /api/auth/login` `{ phone, password }` → returns `{ token, user }`

`phone` should be sent without a leading `+`, e.g. `94771234567`.

## What's deliberately left out for now

- No protected routes yet (`middleware/authMiddleware.js` is ready for when
  you add some — attach `protect` to any route that needs `req.user`)
- No refresh tokens — the JWT is just long-lived (`JWT_EXPIRES_IN`, default 30 days)
- No "forgot password" flow — you'd likely reuse the OTP model for this later
  (send a reset OTP, verify it, then let the user set a new password)

## Testing without spending SMS credits

Text.lk gives 10 free test units on the sandbox sender ID (`TextLKDemo`) —
use those while you build, then request your real sender ID before you
need production sends.

## Before this goes anywhere public

- Rotate `MONGO_URI` and `JWT_SECRET` — both were shared in plain text during
  development.
- Confirm `.env` is actually being ignored by git (`git check-ignore .env`
  should print `.env`) before your first commit/push.
