# GitHub Pages Deployment

This repository is configured for automatic deployment to GitHub Pages using GitHub Actions.

## Setup Instructions

### 1. Repository Settings

1. Go to your repository settings on GitHub
2. Navigate to **Pages** in the left sidebar
3. Under **Source**, select **"GitHub Actions"**
4. The workflow will automatically deploy when you push to the `main` branch

### 2. Environment Variables

The deployment is configured to work automatically with:
- **Base URL**: `/CMSNext/` (matches repository name)
- **Build Command**: `npm run build:pages`
- **Output Directory**: `dist/`

### 3. Workflow Details

The deployment workflow (`.github/workflows/deploy.yml`) includes:

- **Trigger**: Pushes to `main` branch and manual dispatch
- **Node.js**: Version 18 with npm caching
- **Build Process**: TypeScript compilation + Vite build
- **Deployment**: Automatic upload to GitHub Pages

### 4. File System Access API Considerations

⚠️ **Important**: The CMSNext application uses the File System Access API, which has browser compatibility limitations:

- **Supported**: Chrome 86+, Edge 86+, Opera 72+
- **Not Supported**: Firefox, Safari (as of 2025)

When deployed to GitHub Pages, users will see a compatibility warning for unsupported browsers.

### 5. Local Development vs Production

- **Local Development**: Uses base path `/`
- **GitHub Pages**: Uses base path `/CMSNext/`
- **Automatic Detection**: Based on `NODE_ENV` environment variable

### 6. Manual Deployment

To manually trigger a deployment:

1. Go to the **Actions** tab in your repository
2. Select the **"Deploy to GitHub Pages"** workflow
3. Click **"Run workflow"**
4. Select the `main` branch and click **"Run workflow"**

### 7. Monitoring Deployments

- View deployment status in the **Actions** tab
- Check the **Deployments** section on the repository main page
- Access the live site at: `https://skigim.github.io/CMSNext/`

### 8. Troubleshooting

**Build Fails:**
- Check the Actions log for detailed error messages
- Ensure all dependencies are correctly specified in `package.json`
- Verify TypeScript compilation passes locally

**Routing Issues:**
- Ensure all internal links use relative paths
- The application is configured for single-page app routing

**File System API Not Working:**
- This is expected on GitHub Pages due to security restrictions
- Users will see appropriate fallback messages
- Consider implementing alternative storage for production use

### 9. Customization

To modify the deployment:

- **Base Path**: Update `base` in `vite.config.ts`
- **Build Settings**: Modify `build:pages` script in `package.json`
- **Workflow**: Edit `.github/workflows/deploy.yml`

### 10. Alternative Deployments

This setup can be adapted for other static hosting services:

- **Netlify**: Remove base path configuration
- **Vercel**: Use vercel.json for routing
- **Firebase Hosting**: Update firebase.json configuration