import { defineStore } from 'pinia';
import { useFirebaseAuth } from 'vuefire';
import { createUserWithEmailAndPassword, EmailAuthProvider, getRedirectResult, sendEmailVerification, signInWithRedirect, User } from 'firebase/auth';
import { collection, doc, getDoc, getFirestore, setDoc } from 'firebase/firestore';
import { firebaseApp } from '../firebase';
import { Invite } from 'models/Invite';

export const useUserStore = defineStore('user', {
    state: () => ({
        auth: useFirebaseAuth(),
        db: getFirestore(firebaseApp),
        usersRef: collection(getFirestore(firebaseApp), 'users'),
        inviteRef: collection(getFirestore(firebaseApp), 'invites'),
    }),
    getters: {
        /**
         * Get the current user
         * 
         * @returns {User} The current user
         */
        user(): User {
            return this.auth?.currentUser!;
        }
    },
    actions: {
        findUserById(uid: string): Promise<User> {
            return new Promise((resolve, reject) => {
                const user = doc(this.usersRef, uid);
                getDoc(user).then(snapshot => {
                    if (snapshot.exists()) {
                        resolve(snapshot.data() as User);
                    } else {
                        reject('User not found.');
                    }
                }).catch(error => {
                    console.error(error);
                    reject(error);
                });
            });
        },
        findInviteByKey(key: string): Promise<Invite> {
            return new Promise((resolve, reject) => {
                const invite = doc(this.inviteRef, key);
                getDoc(invite).then(snapshot => {
                    if (snapshot.exists()) {
                        resolve(snapshot.data() as Invite);
                    } else {
                        reject('Invalid invite key.');
                    }
                }).catch(error => {
                    console.error(error);
                    reject(error);
                });
            });
        },
        createInvite(): Promise<string> {
            return new Promise((resolve, reject) => {
                // Create an invitation
                const invite = doc(this.inviteRef, this.user.uid);
                setDoc(invite, {
                    uid: this.user.uid,
                }).then(() => {
                    resolve(invite.id);
                }).catch(error => {
                    console.error(error);
                    reject(error);
                });
            });
        },
        login(email: string, password: string): Promise<User> {
            return new Promise((resolve, reject) => {
                if (this.auth !== null) {
                    signInWithRedirect(this.auth, EmailAuthProvider.credential(email, password)).then(() => {
                        return getRedirectResult(this.auth);
                    }).then((userCredential) => {
                        if (userCredential === null) {
                            return reject('User is null.');
                        }
                        resolve(userCredential.user!);
                    }).catch(error => {
                        reject(error);
                    });
                }
                // Handle the case when auth is null
                return reject('Authentication is not available.');
            });
        },
        /**
         * Register a new user
         * @param {string} email E-mail address
         * @param {string} password Password
         * @returns 
         */
        register(invite: string, email: string, password: string, firstName: string, lastName: string): Promise<User> {
            return new Promise((resolve, reject) => {
                if (this.auth !== null) {
                    createUserWithEmailAndPassword(this.auth, email, password).then(userCredential => {
                        // Verify email
                        return sendEmailVerification(userCredential.user, {
                            url: `https://www.vubdivingcenter.be/user/register?email=${email}`,
                        });
                    }).then(() => {
                        // Add user to the database
                        return setDoc(doc(this.usersRef, this.user.uid), {
                            firstName,
                            lastName,
                            invite
                        });
                    }).then(() => {
                        resolve(this.user);
                    }).catch(error => {
                        console.error(error);
                        reject(error);
                    });
                }
                // Handle the case when auth is null
                return reject('Authentication is not available.');
            });
        }
    },
});
