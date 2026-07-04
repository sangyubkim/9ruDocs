/**

 * EAS/로컬 빌드용 Expo 설정.

 * Google Maps Android SDK: 빌드 시 `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` 설정

 * (미설정 시 MapView 비활성 — 앱 내 OSM 정적 지도 + 구글 지도 링크만 사용)

 *

 * PC LAN API (http): `EXPO_PUBLIC_API_URL` — EAS preview 빌드 전 선택 설정

 */

const appJson = require("./app.json");



const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";



module.exports = {

  expo: {

    ...appJson.expo,

    android: {

      ...appJson.expo.android,

      usesCleartextTraffic: true,

      config: {

        ...appJson.expo.android?.config,

        googleMaps: {

          apiKey: googleMapsApiKey,

        },

      },

    },

    ios: {

      ...appJson.expo.ios,

      config: {

        ...appJson.expo.ios?.config,

        googleMapsApiKey,

      },

    },

  },

};

