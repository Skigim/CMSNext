# CMSNext Deployment Guide

## GitHub Pages Deployment

### Quick Setup

1. **Enable GitHub Pages in Repository Settings**
   - Go to Settings → Pages
   - Source: **GitHub Actions**
   - The workflow will deploy automatically on push to `main`

2. **Access Your Deployed Application**
   - URL: `https://skigim.github.io/CMSNext/`
   - Updates automatically when you push to `main` branch

### Manual Deployment Run

If you need to redeploy without pushing code:

1. Open the **Actions** tab in GitHub.
2. Select **Deploy to GitHub Pages**.
3. Click **Run workflow**, choose the `main` branch, and confirm. The workflow reuses the same build steps described below.

### Deployment Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Push to Main  │ ──▶│  GitHub Actions  │ ──▶│  GitHub Pages   │
│                 │    │                  │    │                 │
│ • Code Changes  │    │ • npm ci         │    │ • Static Files  │
│ • Auto Trigger  │    │ • npm build      │    │ • CDN Delivery  │
│ • Manual Run    │    │ • Deploy         │    │ • HTTPS Enabled │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Build Configuration

#### Vite Configuration (`vite.config.ts`)
```typescript
base: process.env.NODE_ENV === 'production' ? '/CMSNext/' : '/'
```

#### Package.json Scripts
```json
{
  "build": "tsc && vite build",
  "build:pages": "NODE_ENV=production npm run build"
}
```

#### GitHub Actions Workflow (`.github/workflows/deploy.yml`)
- **Trigger**: Push to main, manual dispatch
- **Node.js**: Version 18 with npm caching
- **Steps**: Install → Build → Upload → Deploy

### File Structure After Deployment

```
dist/
├── .nojekyll              # Prevents Jekyll processing
├── index.html             # Entry point with correct base paths
├── favicon.svg            # Custom CMSNext favicon
└── assets/
    ├── *.css             # Bundled stylesheets
    ├── *.js              # JavaScript chunks
    └── vendor-*.js       # React/vendor libraries
```

### Browser Compatibility

#### ✅ **Fully Supported**
- **Chrome 86+**: Full File System Access API support
- **Edge 86+**: Full File System Access API support  
- **Opera 72+**: Full File System Access API support

#### ⚠️ **Limited Support**
- **Firefox**: No File System Access API (fallback UI shown)
- **Safari**: No File System Access API (fallback UI shown)

### Performance Optimizations

#### Bundle Splitting
- **Vendor Chunk**: React, React-DOM (141KB)
- **UI Chunk**: Radix UI components (19KB) 
- **Forms Chunk**: React Hook Form (0.03KB)
- **Charts Chunk**: Recharts library (0.48KB)
- **Main Chunk**: Application code (213KB)

#### Lazy Loading
- Route-based code splitting
- Component-level lazy loading for large features
- Dynamic imports for non-critical functionality

### Production Considerations

#### Security
- **No Backend**: Pure client-side application
- **HTTPS**: Enforced by GitHub Pages
- **No Sensitive Data**: File System Access API for local storage only

#### Limitations
- **File System API**: Only works in supported browsers
- **Storage**: Local only, no server-side persistence
- **Offline**: Works offline after initial load

#### File Storage Recovery Checklist
- ✅ Review autosave badge states against the reference in `docs/error-boundary-guide.md` and confirm each lifecycle transition (ready, saving, retrying, permission-required, error) appears during smoke testing.
- ✅ (Optional) Capture badge/toast screenshots plus console logs when sharing findings; store them in `docs/development/resilience-screenshots/<release>/` if needed.
- ✅ Confirm `npm run test:run` passes, specifically the autosave retry and connection flow suites.
- ✅ Verify `ConnectToExistingModal` prompts when permissions are revoked mid-session.
- ✅ Log findings in release notes with remediation steps for any deviations.

### Monitoring and Maintenance

#### Deployment Status
- **Actions Tab**: View build and deployment logs
- **Deployments**: Track deployment history
- **Status Badge**: Add to README for quick status check

#### Error Monitoring
- **Build Failures**: Check Actions logs for TypeScript/build errors
- **Runtime Errors**: Browser console for client-side issues
- **Performance**: Core Web Vitals via browser dev tools

### Customization Options

#### Domain Configuration
```yaml
# Custom domain in GitHub Pages settings
# Add CNAME file to public/ folder
echo "yourdomain.com" > public/CNAME
```

#### Environment Variables
```typescript
// vite.config.ts
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString())
  }
})
```

#### Build Optimizations
```typescript
// vite.config.ts - Additional optimizations
build: {
  sourcemap: false,           // Disable source maps for production
  minify: 'terser',          // Better minification
  terserOptions: {
    compress: {
      drop_console: true     // Remove console.log in production
    }
  }
}
```

### Alternative Deployment Options

#### Netlify
```toml
# netlify.toml
[build]
  publish = "dist"
  command = "npm run build"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

#### Vercel
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

#### Firebase Hosting
```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

### Troubleshooting

#### Common Issues

**1. Build Fails with TypeScript Errors**
```bash
# Run locally to debug
npm run build:pages
# Check specific TypeScript errors
npx tsc --noEmit
```

**2. Assets Not Loading (404 errors)**
- Verify base path in vite.config.ts matches repository name
- Check GitHub Pages source is set to "GitHub Actions"
- Ensure index.html has correct asset paths

**3. File System API Not Working**
- Expected behavior on GitHub Pages (security restriction)
- Application shows appropriate fallback messaging
- Consider implementing alternative storage for production

**4. Routing Issues**
- Single-page application routing works correctly
- All routes resolve to index.html
- Browser navigation and bookmarks work as expected

#### Debug Commands
```bash
# Local development
npm run dev

# Production build test
npm run build:pages && npm run preview

# Check bundle size
npm run build:pages && du -sh dist/

# Analyze bundle composition
npx vite-bundle-analyzer dist/assets/*.js
```

### Support and Updates

#### Keeping Dependencies Updated
```bash
# Check outdated packages
npm outdated

# Update dependencies
npm update

# Major version updates
npx npm-check-updates -u && npm install
```

#### GitHub Actions Updates
- Actions versions updated automatically via Dependabot
- Monitor Actions marketplace for new deployment features
- Review workflow logs for deprecation warnings

This deployment setup provides a robust, automated solution for hosting the CMSNext application with optimal performance and maintainability.