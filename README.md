# Ruchi Furniture Billing App (Expo React Native)

Production-ready cross-platform billing app for Android and iOS.

## Features
- Dynamic line-item billing with product name, unit price, and quantity
- Real-time subtotal, tax, and total calculations
- PDF invoice generation with customizable letterhead
- Excel invoice generation with letterhead metadata
- Auto invoice numbering (RF-1001+)
- Product memory/history using local storage
- Search, re-use, and delete saved products
- Customer details and print-ready invoice layout
- File sharing to email/print/chat apps

## Setup
1. Install Node.js 18+.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start app:
   ```bash
   npm run start
   ```
4. Run on device/emulator:
   ```bash
   npm run android
   npm run ios
   ```

## Branding Customization
Use **Letterhead Setup** section in app to set:
- Company name
- Address
- Contact info
- Logo placeholder text

Saved locally and re-used for all generated bills.

## Production Notes
- For release builds: use EAS Build (`npx eas build`) and configure app signing.
- Replace placeholder assets in `/assets` with brand icons and splash images.
- If you need GST-specific fields/formatting, extend tax and customer schema.
