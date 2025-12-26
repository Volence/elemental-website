# Testing Timezone Display

## Method 1: Chrome/Edge DevTools (Recommended)

1. Open DevTools (F12)
2. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac) to open Command Palette
3. Type "timezone" and select **"Sensors: Show Sensors"**
4. In the Sensors tab, find the **Location** section
5. From the timezone dropdown, select:
   - **Tokyo** (to test JST - Japan Standard Time)
   - **Berlin** (to test CET - Central European Time)
   - **Los Angeles** (to test PST - Pacific Standard Time)
   - **New York** (to test EST - Eastern Standard Time)
   - **London** (to test GMT/BST)
6. Reload the page
7. All times should now display in the selected timezone!

## Method 2: Firefox DevTools

1. Open DevTools (F12)
2. Click the three dots (⋮) → Settings
3. Scroll to "Advanced Settings"
4. Check "Enable custom formatters"
5. Use about:config to set `intl.regional_prefs.use_os_locales` to false
6. Set `intl.accept_languages` to test different locales

Note: Firefox doesn't have as easy timezone override as Chrome

## Method 3: Multi-Timezone Debug Component

I've created a debug component that shows the same time in 6 timezones at once!

**To use it:**

1. Open any Production Dashboard view (e.g., `StaffSignupsView.tsx`)

2. Import the component at the top:
```typescript
import { TimezoneDebug } from './TimezoneDebug'
```

3. Add it anywhere in the JSX (good spot is right after the header):
```tsx
<div className="production-dashboard__staff-signups">
  <div className="production-dashboard__header">
    {/* ... existing header ... */}
  </div>
  
  {/* ADD THIS LINE: */}
  <TimezoneDebug date={new Date('2025-12-26T21:00:00Z')} />
  
  {/* ... rest of component ... */}
</div>
```

4. Save and reload the page

5. You'll see the same time displayed in:
   - 🗽 New York (EST)
   - 🌴 Los Angeles (PST)
   - 🇬🇧 London (GMT)
   - 🇩🇪 Berlin (CET)
   - 🇯🇵 Tokyo (JST)
   - 🇦🇺 Sydney (AEDT)

6. **Remove it when done testing!**

## What to Look For

When testing, verify:
1. ✅ Timezone abbreviation changes (EST → CET → JST, etc.)
2. ✅ Time values shift correctly (3:00 PM EST = 9:00 PM CET)
3. ✅ Date can shift if crossing midnight (Dec 25 EST = Dec 26 JST)
4. ✅ The notice shows the correct timezone name

## Example Timeline for Same Match:
- 3:00 PM EST (New York)
- 12:00 PM PST (Los Angeles) 
- 8:00 PM GMT (London)
- 9:00 PM CET (Berlin)
- 5:00 AM JST (Tokyo, next day)

