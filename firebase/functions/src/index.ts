import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import {user} from "firebase-functions/v1/auth";

admin.initializeApp();

// Initialize Firestore collections
const users = admin.firestore().collection("users");
const invites = admin.firestore().collection("invites");

export const onUserRegistration = user().onCreate(async (user) => {
  try {
    // Access the user data
    const { email, uid } = user;
    const userData = await users.doc(uid).get();
    if (!userData.exists) {
      logger.error("User document not found for user:", uid);
      await admin.auth().deleteUser(uid);
      return;
    }

    const inviteKey: string = userData.get("invite");

    const inviteSnapshot = await invites.doc(inviteKey).get();
    if (!inviteSnapshot.exists) {
      logger.error("Invalid invite key for user:", inviteKey);
      await admin.auth().deleteUser(uid);
      return;
    }

    // Delete the invite and update the claim
    await inviteSnapshot.ref.delete();
    // Delete the invite field from the user document
    await userData.ref.update({invite: admin.firestore.FieldValue.delete()});
    await admin.auth().setCustomUserClaims(uid, {role: "user"});

    logger.info(`New user registered: ${email}`);
  } catch (error) {
    logger.error("Error registering new user:", error);
  }
});
