# Computer Science Guide

A static website for learning computer science, built with Astro and hosted on Azure Static Web Apps.

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Deployment to Azure Static Web Apps

### Option 1: GitHub Integration (Recommended)

1. Push this repository to GitHub
2. Go to Azure Portal > Create a resource > Static Web App
3. Connect your GitHub repository
4. Configure:
   - Build preset: `Astro`
   - App location: `/`
   - Output location: `dist`
5. Azure will add the deployment token to your repo secrets automatically

### Option 2: Azure CLI

```bash
# Login to Azure
az login

# Create resource group
az group create --name rg-csguide --location eastus2

# Create Static Web App
az staticwebapp create \
  --name computerscienceguide \
  --resource-group rg-csguide \
  --source https://github.com/YOUR_USERNAME/ComputerScienceGuideSite \
  --branch main \
  --app-location "/" \
  --output-location "dist"
```

## Configuration

### Google AdSense

Replace the placeholder values in `src/layouts/BaseLayout.astro`:

1. Find `ca-pub-XXXXXXXXXX` and replace with your AdSense publisher ID
2. In `src/components/AdUnit.astro`, replace `data-ad-slot="XXXXXXXXXX"` with your ad unit IDs

### Google Analytics

In `src/layouts/BaseLayout.astro`, replace `G-XXXXXXXXXX` with your GA4 measurement ID.

### Custom Domain

1. In Azure Portal, go to your Static Web App > Custom domains
2. Add your domain (computerscienceguide.com)
3. Configure DNS:
   - For apex domain: Add A record pointing to Azure IP
   - For www: Add CNAME pointing to your Azure domain

## Project Structure

```
├── src/
│   ├── components/     # Reusable components
│   ├── layouts/        # Page layouts
│   ├── pages/          # All routes (file-based routing)
│   │   ├── guides/     # CS guide content
│   │   └── ...
│   └── styles/         # Global CSS
├── public/             # Static assets
├── astro.config.mjs    # Astro configuration
├── staticwebapp.config.json  # Azure SWA config
└── package.json
```

## Adding New Guides

1. Create a new `.astro` file in `src/pages/guides/`
2. Use the `GuideLayout` component for consistent styling:

```astro
---
import GuideLayout from '../../layouts/GuideLayout.astro';

const toc = [
  { title: 'Section 1', href: '#section-1' },
  // ...
];
---

<GuideLayout
  title="Your Guide Title"
  description="SEO description"
  level="beginner"
  readTime="15 min read"
  toc={toc}
>
  <!-- Content here -->
</GuideLayout>
```

## SEO Features

- Automatic sitemap generation via `@astrojs/sitemap`
- Open Graph and Twitter Card meta tags
- Structured data (JSON-LD) for articles
- Canonical URLs
- robots.txt

## License

All rights reserved.
