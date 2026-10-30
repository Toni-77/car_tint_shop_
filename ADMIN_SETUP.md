# Admin page setup

The admin page lives at `/admin` (for example `https://your-site.com/admin`).
Only the owner's email can sign in.

## 1. Turn on sign-in in Firebase

1. Open the [Firebase console](https://console.firebase.google.com) and choose your project.
2. Go to **Build → Authentication → Sign-in method** and enable **Email/Password**.
3. Go to **Authentication → Users → Add user** and create your account
   (your email and a strong password).
4. Go to **Authentication → Settings → User actions** and turn off
   **Enable create (sign-up)**, so nobody else can create an account.
5. Go to **Authentication → Settings → Authorized domains** and make sure your
   website's domain (for example `your-site.netlify.app` and your own domain) is listed.

## 2. Add settings to Netlify (and to `.env.local` for testing on your computer)

| Name | Value | Needed? |
|---|---|---|
| `ADMIN_EMAIL` | The email you signed up with in step 1.3 | Yes |
| `ADMIN_UID` | Your user's UID from Authentication → Users | Optional, extra safety |
| `BOOKING_FROM_EMAIL` | e.g. `Supernova Tinting <bookings@your-domain.com>` | For "Confirm and send email" |

The `NEXT_PUBLIC_FIREBASE_...` settings the site already uses are also needed by
the sign-in page. After changing settings in Netlify, redeploy the site.

## 3. Customer emails (for "Confirm and send email")

Resend only sends to customers from a domain you own:

1. In [Resend](https://resend.com) go to **Domains → Add domain** and follow the DNS steps.
2. Once it shows **Verified**, set `BOOKING_FROM_EMAIL` (above) to an address on that domain.

Until then, **Confirm only** works normally and **Confirm and send email** confirms
the booking and tells you the email wasn't sent.

## 4. Shop address in emails

Open `lib/shop-info.ts` and fill in `address` so confirmation emails tell customers
where to go.

## 5. Lock down the database (recommended)

Bookings are now read and written only by the server, so the browser never needs
direct database access. In **Firestore → Rules**, you can use:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## What's stored where (Firestore)

| Collection | What it holds |
|---|---|
| `bookings` | Every appointment, from the website or added by you. Never deleted; cancelled ones keep their status. |
| `slots` | One document per taken or blocked time (see below). |
| `quotes` | Every Get Quote estimate. Ones with an email are leads (status `new`, `contacted` or `booked`). |
| `customerNotes` | Notes you write on a customer, keyed by their phone number or email. |
| `rate_limits` | Spam-protection counters. Safe to delete anytime. |

The Customers list isn't stored: it's built from `bookings` and `quotes` each time you open it.

## How the time slots work

- Every taken time has a document in the `slots` collection, named like `2026-11-04_0930`.
- Blocked times have `kind: "block"` and an optional `reason`.
- The website hides every time that has a slot document. The admin page creates and
  removes them for you (cancel, reschedule, block, unblock), so you no longer need to
  edit Firestore by hand.
