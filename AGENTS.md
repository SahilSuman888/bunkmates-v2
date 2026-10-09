# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Firebase Access & Modifications Rule
- **STRICT RESTRICTION**: NEVER run any Firebase CLI deployment commands (`firebase deploy`, `firebase emulators`, database modifications, rules deployment, cloud functions deployment, etc.).
- Agents have NO direct access or permission to modify the live Firebase project/backend.
- Whenever any backend/Firebase change is required (Firestore rules, indexes, collections, auth providers, Cloud Functions, etc.), provide step-by-step instructions so the user can perform the changes manually.
