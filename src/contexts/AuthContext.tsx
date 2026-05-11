import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { type User, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../services/firebase';

export interface UserProfile {
    crmId: string;
    role: 'super_admin' | 'sd' | 'sm' | 'tl' | 'user';
    sd?: string;
    sm?: string;
    team?: string;
    position?: string;
}

interface AuthContextType {
    user: User | null;
    profile: UserProfile | null;
    loading: boolean;
    logout: () => Promise<void>;
    isAdmin: boolean;
    isSuperAdmin: boolean;
    isLeader: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    
    // Only super_admin can access the Admin Dashboard
    const isAdmin = profile?.role === 'super_admin';
    const isSuperAdmin = profile?.role === 'super_admin';
    
    // Leaders (who can assign tasks) include TL, SM, SD, and super_admin
    const isLeader = profile?.role === 'super_admin' || profile?.role === 'sd' || profile?.role === 'sm' || profile?.role === 'tl';

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);

            if (currentUser) {
                // Hardcoded super admin
                if (currentUser.email === 'wuchuan@51talk.com') {
                    setProfile({
                        crmId: 'wuchuan',
                        role: 'super_admin'
                    });
                } else {
                    // Fetch user profile from Firestore
                    try {
                        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                        if (userDoc.exists()) {
                            setProfile(userDoc.data() as UserProfile);
                        } else {
                            // Default to basic user if no profile found
                            setProfile({
                                crmId: currentUser.email?.split('@')[0] || 'unknown',
                                role: 'user'
                            });
                        }
                    } catch (error) {
                        console.error("Error fetching user profile:", error);
                        setProfile(null);
                    }
                }
            } else {
                setProfile(null);
            }

            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const logout = () => firebaseSignOut(auth);

    const value = {
        user,
        profile,
        loading,
        logout,
        isAdmin,
        isSuperAdmin,
        isLeader
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
