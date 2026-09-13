# How to Create a Google Cloud App for YouTube Chat

*A step-by-step guide to setting up your own free Google Cloud App to connect YouTube Live Chat to your OBS overlay.*

## What you need

- [ ] A Google / YouTube account
- [ ] The toolkit running (open at **http://localhost:8778**)

---

## Step 1: Create a Google Cloud Project

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Log in with your Google / YouTube account.
3. Click the project dropdown menu at the top of the page (next to "Google Cloud").
4. Click **New Project** in the top right of the modal window.
5. Enter `My OBS Chat` as the **Project name**.
6. Click **Create**.

---

## Step 2: Enable the YouTube Data API v3

1. Click the search bar at the top of Google Cloud Console.
2. Search for `YouTube Data API v3`.
3. Select **YouTube Data API v3** under Marketplace / APIs.
4. Click the blue **Enable** button.

---

## Step 3: Configure the OAuth Consent Screen

1. In the left navigation menu, click **APIs & Services** → **OAuth consent screen** (or **Google Auth Platform**).
2. Select **External** as the User Type and click **Create**.
3. Enter `My OBS Chat` into the **App name** field.
4. Select your email address under **User support email**.
5. Scroll down to **Developer contact information** and enter your email address.
6. Click **Save and Continue** through the Scopes step.
7. Under *Publishing status*, click **Publish App** to switch status to **In production** (recommended so your login doesn't expire every 7 days).

---

## Step 4: Define Test Users & Set Status to Testing (Optional Alternative)

If you prefer to keep your app in **Testing** status instead of publishing to production, you must manually grant permission to your own email address:

1. **Navigate to Audience Configuration**:
   In the left-hand navigation menu of the Google Auth Platform / OAuth Consent Screen, click on the **Audience** (or OAuth consent screen) tab.
2. **Verify Publishing Status**:
   Verify that your Publishing status is set to **Testing**.  
   *Note: If it is already in testing, you will see a status indicating so. If it is currently published to production, you can choose to revert it back to testing.*
3. **Add Test Users**:
   - Scroll down to the **Test users** section.
   - Click the **Add users** button.
   - Enter your Google Account email addresses (standard Gmail or Google Workspace accounts) of the users you want to authorize as test users.
   - Click **Save** to apply the changes.

> ⚠️ While your app is in the **Testing** publishing status, only the designated test users you have added here will be able to log in and authorize the application during OAuth flows.

---

## Step 5: Create Credentials (Client ID & Client Secret)

1. In the left navigation menu, click **Credentials**.
2. Click **+ Create Credentials** at the top of the page.
3. Select **OAuth client ID**.
4. Set **Application type** to **Web application**.
5. Enter `OBS Toolkit Client` in the **Name** field.
6. Scroll down to **Authorized redirect URIs** and click **+ Add URI**.
7. In the toolkit setup page (**http://localhost:8778**), click **Copy the Redirect URL** and paste it here.
8. Click **Create**.

---

## Step 6: Connect to the Toolkit

1. A popup window will display your **Client ID** and **Client Secret**.
2. Copy the **Client ID** and paste it into the YouTube settings box in the toolkit setup page.
3. Copy the **Client Secret** and paste it into the YouTube settings box in the toolkit setup page.
4. Click **Save**, then click **Connect**.
5. When Google displays a screen saying *"Google hasn't verified this app"*, click **Advanced** → **Go to My OBS Chat (unsafe)** and click **Continue**.

---

## Troubleshooting

**Google says "Access blocked: App has not completed the Google verification process"**  
Your app is in *Testing* status and your email is not listed under Test Users. Follow **Step 4** above to add your email as a test user, or **Step 3** to set Publishing Status to *In Production*.

**The login screen says "Redirect URI mismatch"**  
The Redirect URI in Google Cloud Console must match character-for-character with the URL shown in the toolkit. Make sure there are no trailing slashes or extra spaces.

**The dot in the toolkit turns orange or says login expired**  
If your app was left in *Testing* mode without Publishing, Google invalidates OAuth tokens every 7 days. Go to the OAuth Consent Screen and click **Publish App** to make it permanent.
