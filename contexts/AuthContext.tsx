import React, { createContext, useContext, useState, useEffect } from 'react';
import {
    User,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../services/firebase';
import { WELCOME_BONUS_POINTS } from '../config/pricingConfig';

interface UserProfile {
    uid: string;
    email: string;
    displayName: string;
    photoURL?: string;
    pointsBalance: number;
    createdAt: string;
}

interface AuthContextType {
    currentUser: User | null;
    userProfile: UserProfile | null;
    loading: boolean;
    signup: (email: string, password: string, displayName: string) => Promise<void>;
    login: (email: string, password: string) => Promise<void>;
    loginWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
    refreshProfile: () => Promise<void>;
    // NOTE: Points are now deducted SERVER-SIDE.
    // These methods only update the local UI state after server confirms deduction.
    updateLocalBalance: (newBalance: number) => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    // Load user profile from Firestore
    const loadUserProfile = async (user: User) => {
        try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
                setUserProfile(userDoc.data() as UserProfile);
            } else {
                // Create new user profile with welcome bonus
                const newProfile: UserProfile = {
                    uid: user.uid,
                    email: user.email || '',
                    displayName: user.displayName || 'User',
                    photoURL: user.photoURL || undefined,
                    pointsBalance: WELCOME_BONUS_POINTS,
                    createdAt: new Date().toISOString()
                };
                await setDoc(doc(db, 'users', user.uid), newProfile);

                // Record welcome bonus transaction
                await setDoc(doc(db, 'transactions', `${user.uid}_welcome`), {
                    userId: user.uid,
                    type: 'bonus',
                    amount: WELCOME_BONUS_POINTS,
                    description: `Начален бонус при регистрация (${WELCOME_BONUS_POINTS} точки)`,
                    createdAt: new Date().toISOString()
                });

                setUserProfile(newProfile);
                console.log(`[Auth] ✅ New user created with ${WELCOME_BONUS_POINTS} points welcome bonus: ${user.uid}`);
            }
        } catch (error) {
            console.error('[Auth] Error loading user profile:', error);
        }
    };

    // Refresh profile data from Firestore (call after server-side operations)
    const refreshProfile = async () => {
        if (currentUser) {
            await loadUserProfile(currentUser);
        }
    };

    // Update local balance immediately (optimistic UI update)
    // Called after server confirms deduction via response.points.newBalance
    const updateLocalBalance = (newBalance: number) => {
        setUserProfile(prev => prev ? { ...prev, pointsBalance: newBalance } : prev);
    };

    // Sign up with email and password
    const signup = async (email: string, password: string, displayName: string) => {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName });
        await loadUserProfile(userCredential.user);
    };

    // Login with email and password
    const login = async (email: string, password: string) => {
        await signInWithEmailAndPassword(auth, email, password);
    };

    // Login with Google
    const loginWithGoogle = async () => {
        await signInWithPopup(auth, googleProvider);
    };

    // Logout
    const logout = async () => {
        await signOut(auth);
        setUserProfile(null);
    };

    // Auth state listener
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);
            if (user) {
                await loadUserProfile(user);
            } else {
                setUserProfile(null);
            }
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const value = {
        currentUser,
        userProfile,
        loading,
        signup,
        login,
        loginWithGoogle,
        logout,
        refreshProfile,
        updateLocalBalance
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
