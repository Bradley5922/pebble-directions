# Pebble Directions

![Pebble Appstore Banner](./banner.png)

A simple directions app for the Pebble smartwatch.
Users can select their method of transport and then speak their destination using Rebbles voice input apis.
Then the app uses the Google Directions API to
get a list of directions starting at the users current location.

Car, bike, walk and public transport ("Train") routes are all served by the Google
Directions API (`mode=transit` for public transport), which gives good worldwide
coverage including UK rail, bus and tube.

You can find it in the [Rebble Appstore](https://apps.rebble.io/en_US/application/576ee8e6ba2fe5a0c10000b9).

## Setting up your Google API key

The app uses the Google Maps Platform, so each user supplies their own free API key.
Enter it once on the app's settings page (in the Pebble phone app: open the watchapp's
settings) — it is stored on your phone and only sent to Google when you request directions.

To create a key:

1. Go to the [Google Cloud Console](https://console.cloud.google.com) and create a project.
2. **Enable billing** for the project. This is required even for the free tier — normal
   personal use stays inside Google's free monthly allowance, so you are very unlikely to
   be charged, but a card must be on file.
3. Open **APIs & Services → Enable APIs and services** and enable **both**:
   - **Geocoding API** (turns the spoken address into coordinates)
   - **Directions API** (builds the car / bike / walk / public-transport route)
4. Open **APIs & Services → Credentials → Create credentials → API key** and copy the key.
5. **Restrict the key** (recommended, since it lives inside the app on your phone):
   - *Application restrictions:* **None** — requests come from your phone with no referrer,
     so referrer/IP restrictions would break it.
   - *API restrictions:* restrict to **Geocoding API** and **Directions API** only.
6. Optionally set a **budget alert** (Billing → Budgets & alerts) or a daily request quota
   so the key can't run up a bill if it ever leaks.
7. Open the app's settings page in the Pebble phone app, paste the key into **Google API key**,
   and save.

You can sanity-check a key in a browser — this should return `"status" : "OK"`:
```
https://maps.googleapis.com/maps/api/directions/json?origin=51.507,-0.127&destination=Cambridge&mode=transit&key=YOUR_KEY
```

## Building

Build with the Pebble SDK (or import this repo into [CloudPebble](https://cloudpebble.repebble.com)).
No API keys live in the source — every user enters their own key on the settings page as
described above.
