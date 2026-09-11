# Google AdSense Auto ads

1. Set `PUBLIC_ADSENSE_CLIENT_ID=ca-pub-YOUR_16_DIGIT_ID` in `.env` for local development or Cloudflare Workers runtime variables for production. Use the publisher ID from your own AdSense account. Restart the dev server after changing `.env`.
2. Build and deploy the app. The shared layout loads the Auto ads script once on eligible content pages when the ID is valid. Login, administration, teacher tools, exam taking/results, and pages with `showAds={false}` or `noindex` are excluded.
3. The app serves `/lms/ads.txt`. Because the app uses the `/lms` base path, configure the domain host to serve that content at **https://lop12.com/ads.txt**, or redirect that root URL to `/lms/ads.txt`. Preserve any existing authorized seller entries on the domain. This root-domain configuration is outside this app's routing.
4. In AdSense, add/verify the site and wait for approval. Under **Ads → By site → Edit**, enable **Auto ads** and apply to the site. Auto ads does not require manual ad slot IDs.
5. Verify page source contains `adsbygoogle.js?client=ca-pub-...` once and root `/ads.txt` includes your `pub-...` ID. Actual ad delivery depends on Google's approval and serving decisions.

References: https://support.google.com/adsense/answer/9261307 and https://support.google.com/adsense/answer/12171612.
