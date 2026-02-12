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
import { doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { auth, db, googleProvider } from '../services/firebase';

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
    deductPoints: (amount: number, analysisId: string) => Promise<void>;
    addPoints: (amount: number, transactionId: string) => Promise<void>;
    refreshProfile: () => Promise<void>;
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
                // Create new user profile
                const newProfile: UserProfile = {
                    uid: user.uid,
                    email: user.email || '',
                    displayName: user.displayName || 'User',
                    photoURL: user.photoURL || undefined,
                    pointsBalance: 0, // Start with 0 points
                    createdAt: new Date().toISOString()
                };
                await setDoc(doc(db, 'users', user.uid), newProfile);
                setUserProfile(newProfile);
            }
        } catch (error) {
            console.error('Error loading user profile:', error);
        }
    };

    // Refresh profile data
    const refreshProfile = async () => {
        if (currentUser) {
            await loadUserProfile(currentUser);
        }
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

    // Deduct points (for analysis)
    const deductPoints = async (amount: number, analysisId: string) => {
        if (!currentUser) throw new Error('Not authenticated');

        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
            pointsBalance: increment(-amount)
        });

        // Record transaction
        await setDoc(doc(db, 'transactions', `${currentUser.uid}_${Date.now()}`), {
            userId: currentUser.uid,
            type: 'deduction',
            amount: -amount,
            description: `Analysis #${analysisId}`,
            analysisId,
            createdAt: new Date().toISOString()
        });

        await refreshProfile();
    };

    // Add points (after purchase)
    const addPoints = async (amount: number, transactionId: string) => {
        if (!currentUser) throw new Error('Not authenticated');

        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
            pointsBalance: increment(amount)
        });

        // Record transaction
        await setDoc(doc(db, 'transactions', transactionId), {
            userId: currentUser.uid,
            type: 'purchase',
            amount,
            description: `Purchased ${amount} points`,
            paymentIntentId: transactionId,
            createdAt: new Date().toISOString()
        });

        await refreshProfile();
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
        deductPoints,
        addPoints,
        refreshProfile
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
