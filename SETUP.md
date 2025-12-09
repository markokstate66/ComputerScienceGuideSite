# Setup Instructions

## 1. Google AdSense Setup

1. Go to [Google AdSense](https://www.google.com/adsense/)
2. Sign up or log in to your account
3. Add your site: `computerscienceguide.com`
4. Get your **Publisher ID** (format: `ca-pub-1234567890123456`)
5. Create ad units and get **Ad Slot IDs** for:
   - Horizontal banner
   - Sidebar rectangle
   - In-article ad

### Update the code:

**File: `src/layouts/BaseLayout.astro`** (line ~37)
```html
<!-- Replace this line -->
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXX" crossorigin="anonymous"></script>

<!-- With your Publisher ID -->
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-YOUR_ID_HERE" crossorigin="anonymous"></script>
```

**File: `src/components/AdUnit.astro`** (lines ~36-37)
```html
<!-- Replace these lines -->
data-ad-client="ca-pub-XXXXXXXXXX"
data-ad-slot="XXXXXXXXXX"

<!-- With your IDs -->
data-ad-client="ca-pub-YOUR_ID_HERE"
data-ad-slot="YOUR_AD_SLOT_ID"
```

---

## 2. Google Analytics 4 Setup

1. Go to [Google Analytics](https://analytics.google.com/)
2. Create a new property for `computerscienceguide.com`
3. Choose "Web" as the platform
4. Get your **Measurement ID** (format: `G-XXXXXXXXXX`)

### Update the code:

**File: `src/layouts/BaseLayout.astro`** (lines ~40-46)
```html
<!-- Replace G-XXXXXXXXXX in both places -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');  <!-- Replace here too -->
</script>
```

---

## 3. Azure Static Web Apps Deployment

After pushing to GitHub, the GitHub Action will need a deployment token.

### Get the token from Azure:

1. Go to [Azure Portal](https://portal.azure.com/)
2. Create a Static Web App resource (or use existing)
3. Go to **Settings > Deployment token**
4. Copy the token

### Add to GitHub:

1. Go to your GitHub repo > **Settings > Secrets and variables > Actions**
2. Click **New repository secret**
3. Name: `AZURE_STATIC_WEB_APPS_API_TOKEN`
4. Value: Paste the deployment token
5. Click **Add secret**

---

## 4. Custom Domain Setup

After deployment:

1. In Azure Portal, go to your Static Web App
2. Click **Custom domains > Add**
3. Add `computerscienceguide.com`
4. Configure your DNS:
   - **A record**: Point `@` to the Azure IP provided
   - **TXT record**: Add the validation TXT record
   - **CNAME**: Point `www` to your Azure domain

---

## Quick Reference

| Service | Where to find ID | Format |
|---------|------------------|--------|
| AdSense Publisher ID | AdSense > Account > Account Information | `ca-pub-1234567890123456` |
| AdSense Ad Slot | AdSense > Ads > By ad unit | `1234567890` |
| GA4 Measurement ID | Analytics > Admin > Data Streams > Web | `G-XXXXXXXXXX` |
| Azure Deploy Token | Azure Portal > Static Web App > Deployment token | Long string |
