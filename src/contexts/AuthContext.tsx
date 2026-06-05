import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { type User, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../services/firebase';

export interface UserPermissions {
    manageCategories?: boolean;
    manageRecordings?: boolean;
    manageUsers?: boolean;
    manageDashboard?: boolean;
    manageTasks?: boolean;
    manageComments?: boolean;
    managePolicies?: boolean;
}

export interface UserProfile {
    crmId: string;
    role: 'super_admin' | 'sd' | 'sm' | 'tl' | 'user';
    sd?: string;
    sm?: string;
    team?: string;
    position?: string;
    dep?: 'CC' | 'SS' | 'functional';
    permissions?: UserPermissions;
}

interface AuthContextType {
    user: User | null;
    profile: UserProfile | null;
    loading: boolean;
    logout: () => Promise<void>;
    isAdmin: boolean;
    isSuperAdmin: boolean;
    isLeader: boolean;
    hasAnyAdminPermission: boolean;
    hasPermission: (permission: keyof UserPermissions) => boolean;
    canAccessTasks: boolean;
    canAccessDashboard: boolean;
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
    
    // Permission checks
    const hasPermission = (permission: keyof UserPermissions) => {
        if (permission === 'manageUsers') {
            return isLeader || !!profile?.permissions?.[permission];
        }
        if (permission === 'manageRecordings') {
            return isLeader || !!profile?.permissions?.[permission];
        }
        if (permission === 'manageComments' && profile?.role === 'sd' && profile?.dep === 'SS') {
            return true;
        }
        if (permission === 'managePolicies') {
            return isSuperAdmin || !!profile?.permissions?.[permission];
        }
        return isSuperAdmin || !!profile?.permissions?.[permission];
    };
    const hasAnyAdminPermission = isSuperAdmin || isLeader || !!profile?.permissions?.manageCategories || !!profile?.permissions?.manageRecordings || !!profile?.permissions?.manageUsers || !!profile?.permissions?.manageDashboard || !!profile?.permissions?.manageTasks || !!profile?.permissions?.manageComments || !!profile?.permissions?.managePolicies || (profile?.role === 'sd' && profile?.dep === 'SS');

    const canAccessTasks = isLeader || hasPermission('manageTasks');
    const canAccessDashboard = isLeader || hasPermission('manageDashboard');

    useEffect(() => {
        // If auth is null (e.g. config not set or running mocked services), skip and clear loading immediately
        if (!auth) {
            console.warn("[AuthContext] Firebase Auth is null/uninitialized. Forcing loading to false.");
            setLoading(false);
            return;
        }

        // Set a fallback timeout (3.5 seconds) to prevent permanent loading state / black screen
        const timeoutId = setTimeout(() => {
            console.warn("[AuthContext] Auth listener initialization timed out. Forcing loading to false.");
            setLoading(false);
        }, 3500);

        let unsubscribe = () => {};

        try {
            unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
                setUser(currentUser);

                if (currentUser) {
                    // Hardcoded super admin or Mock SSO test account
                    if (currentUser.email === 'wuchuan@51talk.com') {
                        setProfile({
                            crmId: 'wuchuan',
                            role: 'super_admin'
                        });
                    } else if (currentUser.email === 'test-sso@mecc.com') {
                        const mockCrmId = localStorage.getItem('mock_sso_crm_id') || 'wuchuan';
                        if (mockCrmId.toLowerCase() === 'serdah') {
                            setProfile({
                                crmId: 'Serdah',
                                role: 'sm',
                                dep: 'CC',
                                sd: 'JOHN',
                                team: '',
                                realUid: 'hBhX4w7gqOQZEEiytqKe3FTDhAT2'
                            });
                        } else {
                            setProfile({
                                crmId: 'wuchuan',
                                role: 'super_admin'
                            });
                        }
                    } else if (currentUser.email === 'mohserdah@51talk.com') {
                        setProfile({
                            crmId: 'Serdah',
                            role: 'sm',
                            dep: 'CC',
                            sd: 'JOHN',
                            team: '',
                            realUid: 'hBhX4w7gqOQZEEiytqKe3FTDhAT2'
                        });
                    } else {
                        // Fetch user profile from Firestore
                        try {
                            const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                            if (userDoc.exists()) {
                                setProfile({
                                    ...(userDoc.data() as UserProfile),
                                    realUid: userDoc.id
                                });
                            } else {
                                // Try querying by crmId as a fallback to support different UIDs across auth/database in test environment
                                const emailPrefix = currentUser.email?.split('@')[0] || '';
                                let targetCrmId = emailPrefix;
                                
                                // Specific mappings
                                if (emailPrefix.toLowerCase() === 'mohserdah' || emailPrefix.toLowerCase() === 'serdah') {
                                    targetCrmId = 'Serdah';
                                }
                                
                                console.log(`[AuthContext] UID document not found. Attempting query by crmId: ${targetCrmId}`);
                                const { collection, query, where, getDocs } = await import('firebase/firestore');
                                const q = query(collection(db, 'users'), where('crmId', '==', targetCrmId));
                                const querySnapshot = await getDocs(q);
                                
                                if (!querySnapshot.empty) {
                                    const matchedDoc = querySnapshot.docs[0];
                                    console.log(`[AuthContext] Successfully resolved user profile via crmId query:`, matchedDoc.data());
                                    setProfile({
                                        ...(matchedDoc.data() as UserProfile),
                                        realUid: matchedDoc.id
                                    });
                                } else {
                                    // Try case-insensitive or partial match
                                    const allUsersSnap = await getDocs(collection(db, 'users'));
                                    let found = false;
                                    allUsersSnap.forEach((doc) => {
                                        const data = doc.data();
                                        const dbCrmId = String(data.crmId || '').toLowerCase();
                                        const searchPrefix = targetCrmId.toLowerCase();
                                        if (dbCrmId === searchPrefix || dbCrmId.includes(searchPrefix) || searchPrefix.includes(dbCrmId)) {
                                            console.log(`[AuthContext] Successfully resolved user profile via fallback scan:`, data);
                                            setProfile({
                                                ...(data as UserProfile),
                                                realUid: doc.id
                                            });
                                            found = true;
                                        }
                                    });
                                    
                                    if (!found) {
                                        console.warn("User has Auth account but no Firestore profile. Force logging out.");
                                        sessionStorage.setItem('auth_blocked_reason', 'deleted');
                                        setProfile({
                                            crmId: 'blocked',
                                            role: 'blocked'
                                        } as any);
                                        await firebaseSignOut(auth);
                                    }
                                }
                            }
                        } catch (error) {
                            console.error("Error fetching user profile:", error);
                            setProfile(null);
                        }
                    }
                } else {
                    setProfile(null);
                }

                clearTimeout(timeoutId);
                setLoading(false);
            });
        } catch (err) {
            console.error("[AuthContext] Failed to setup onAuthStateChanged:", err);
            clearTimeout(timeoutId);
            setLoading(false);
        }

        return () => {
            clearTimeout(timeoutId);
            unsubscribe();
        };
    }, []);

    // iOS/Android Native Push Notifications Registration Hook
    useEffect(() => {
        const registerPushNotifications = async () => {
            const { Capacitor } = await import('@capacitor/core');
            if (Capacitor.isNativePlatform() && user && profile && profile.role !== 'blocked') {
                try {
                    const { PushNotifications } = await import('@capacitor/push-notifications');
                    
                    // Request notification permission from iOS/Android OS
                    let permStatus = await PushNotifications.checkPermissions();
                    if (permStatus.receive === 'prompt') {
                        permStatus = await PushNotifications.requestPermissions();
                    }
                    
                    if (permStatus.receive === 'granted') {
                        // Register device with Apple APNs / Google FCM
                        await PushNotifications.register();
                        
                        // Listen for successful registration and token return
                        PushNotifications.addListener('registration', async (token) => {
                            console.log('[Native Push] Registration successful, token:', token.value);
                            
                            // Save deviceToken in user's profile under Firestore 'users' collection for targeted pushes
                            try {
                                const { doc, updateDoc, arrayUnion } = await import('firebase/firestore');
                                const userRef = doc(db, 'users', user.uid);
                                await updateDoc(userRef, {
                                    deviceTokens: arrayUnion(token.value),
                                    lastActiveDevice: 'ios'
                                });
                                console.log('[Native Push] Associated token in Firestore.');
                            } catch (e) {
                                console.error('[Native Push] Failed to save token in Firestore:', e);
                            }
                        });

                        // Listen for registration failures
                        PushNotifications.addListener('registrationError', (err) => {
                            console.error('[Native Push] Registration error:', err);
                        });
                    }
                } catch (error) {
                    console.error('[Native Push] Error during native push setup:', error);
                }
            }
        };
        registerPushNotifications();
    }, [user, profile]);

    const logout = () => firebaseSignOut(auth);

    const value = {
        user,
        profile,
        loading,
        logout,
        isAdmin,
        isSuperAdmin,
        isLeader,
        hasAnyAdminPermission,
        hasPermission,
        canAccessTasks,
        canAccessDashboard
    };

    return (
        <AuthContext.Provider value={value}>
            {loading ? (
                <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-[#1A2B3C] to-[#0A1520] p-4 text-center">
                    {/* Decorative background gradients */}
                    <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-48 h-48 bg-desert-gold/15 blur-[60px] rounded-full pointer-events-none"></div>
                    <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-64 h-64 bg-deep-teal/10 blur-[80px] rounded-full pointer-events-none"></div>
                    
                    {/* Premium Glassmorphic Container */}
                    <div className="relative glass-panel-dark max-w-sm w-full py-10 px-8 rounded-3xl flex flex-col items-center border border-white/5 shadow-2xl">
                        {/* Animated Outer Ring */}
                        <div className="relative w-20 h-20 mb-6 flex items-center justify-center">
                            <div className="absolute inset-0 rounded-full border border-desert-gold/30 animate-pulse-ring"></div>
                            <div className="absolute inset-2 rounded-full border border-deep-teal/20"></div>
                            
                            {/* Spinning Gold Loader */}
                            <svg className="w-12 h-12 text-desert-gold animate-spin" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        </div>

                        <img src="/logo.png" alt="MECC" className="h-8 mb-4 object-contain opacity-90 drop-shadow-md" />
                        
                        <h3 className="text-xl font-extrabold text-white tracking-wide mb-1.5">
                            ME-Elearning
                        </h3>
                        <p className="text-xs font-semibold text-desert-gold/80 uppercase tracking-widest animate-gold-pulse">
                            Loading Experience...
                        </p>
                    </div>
                </div>
            ) : (
                children
            )}
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
