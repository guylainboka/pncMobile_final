import { useEffect, useRef, useState } from 'react';
import { AppShell } from './components/AppShell';
import { LoginScreen, RegisterScreen } from './components/AuthScreens';
import { ComplaintsHistoryScreen, FileComplaintScreen } from './components/ComplaintsScreens';
import { DashboardScreen } from './components/DashboardScreen';
import { DocVerificationScreen } from './components/DocVerificationScreen';
import { IncidentMapScreen } from './components/IncidentMapScreen';
import { LiveTrackingScreen, MyAlertsScreen } from './components/MyAlertsAndTrackingScreens';
import { OfficialAlertsScreen } from './components/OfficialAlertsScreen';
import { PoliceStationsScreen } from './components/PoliceStationsScreen';
import {
  ReportStep1Screen,
  ReportStep2Screen,
  ReportStep3Screen,
} from './components/ReportFlowScreens';
import { OnboardingScreen, SplashScreen } from './components/SplashAndOnboarding';
import {
  DispatchChatScreen,
  EmergencyDirectoryScreen,
  NotificationsScreen,
  PreventionCenterScreen,
  ProfileScreen,
  SosAlertScreen,
} from './components/UtilityScreens';
import { EMPTY_USER } from './data/mockData';
import { getSupabaseClientSync, initSupabaseClient } from './lib/supabase';
import { pncApi } from './services/api';
import {
  AppNotification,
  ChatMessage,
  Complaint,
  IncidentReport,
  OfficialAlert,
  PoliceStation,
  PublicMapIncident,
  ReportDraft,
  ScreenId,
  UserProfile,
} from './types';

const PROTECTED_SCREENS: ScreenId[] = [
  'dashboard',
  'my-alerts',
  'live-tracking',
  'file-complaint',
  'complaints-history',
  'dispatch-chat',
  'notifications',
  'profile',
];

export default function App() {
  const [screen, setScreen] = useState<ScreenId>('splash');
  const [user, setUser] = useState<UserProfile>(EMPTY_USER);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);

  const [officialAlerts, setOfficialAlerts] = useState<OfficialAlert[]>([]);
  const [stations, setStations] = useState<PoliceStation[]>([]);
  const [mapIncidents, setMapIncidents] = useState<PublicMapIncident[]>([]);

  const [reports, setReports] = useState<IncidentReport[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string>('');
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [mapFocusDistrict, setMapFocusDistrict] = useState<string | undefined>(undefined);

  const [reportDraft, setReportDraft] = useState<ReportDraft>({
    category: 'Braquage',
    description: '',
    location: '',
    attachments: [],
    anonymous: false,
    contactName: '',
    contactPhone: '',
  });

  const wsRef = useRef<WebSocket | null>(null);
  const authTokenRef = useRef<string | null>(authToken);

  const [supabaseReady, setSupabaseReady] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    authTokenRef.current = authToken;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify(authToken ? { type: 'auth', token: authToken } : { type: 'logout' })
      );
    }
  }, [authToken]);

  // Initialize Supabase Auth session listener & OAuth redirect handling
  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    void initSupabaseClient().then((sb) => {
      if (!active || !sb) return;
      setSupabaseReady(true);

      void sb.auth.getSession().then(({ data }) => {
        if (!active) return;
        const token = data.session?.access_token;
        if (token) {
          setAuthToken(token);
          setScreen((prev) =>
            prev === 'splash' || prev === 'onboarding' || prev === 'login' || prev === 'register'
              ? 'dashboard'
              : prev
          );
        }
      });

      const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
        if (!active) return;
        const token = session?.access_token || null;
        setAuthToken(token);
        if (token) {
          setScreen((prev) =>
            prev === 'splash' || prev === 'onboarding' || prev === 'login' || prev === 'register'
              ? 'dashboard'
              : prev
          );
        }
      });
      unsubscribe = () => sub.subscription.unsubscribe();
    });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  const refreshPublicFeed = (token: string | null) => {
    pncApi
      .publicFeed(token)
      .then((feed) => {
        setOfficialAlerts(feed.officialAlerts);
        setStations(feed.stations);
        setMapIncidents(feed.mapIncidents);
      })
      .catch(() => {
        // Keep current state on transient network errors
      });
  };

  const refreshCitizenMe = (token: string) => {
    pncApi
      .citizenMe(token)
      .then((me) => {
        setUser(me.user);
        setReports(me.reports);
        if (me.reports.length > 0) {
          setSelectedReportId((prev) =>
            me.reports.some((r) => r.id === prev) ? prev : me.reports[0].id
          );
        }
        setComplaints(me.complaints);
        setNotifications(me.notifications);
        setChatMessages(me.chatMessages);
        setReportDraft((prev) => ({
          ...prev,
          location: prev.location || me.user.commune,
          anonymous: me.user.defaultAnonymous,
          contactName: me.user.fullName,
          contactPhone: me.user.phone ? `+243 ${me.user.phone}` : '',
        }));
      })
      .catch(() => {
        setAuthToken(null);
        setUser(EMPTY_USER);
      });
  };

  // Public feed sync (official alerts, stations, public map incidents)
  useEffect(() => {
    refreshPublicFeed(authToken);
  }, [authToken]);

  // Supabase Realtime subscription across shared Command Center <-> Citizen tables
  useEffect(() => {
    if (!supabaseReady) return;
    const sb = getSupabaseClientSync();
    if (!sb) return;

    const channel = sb
      .channel('pnc-citizen-realtime-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pnc_official_alerts' }, () => {
        refreshPublicFeed(authTokenRef.current);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pnc_facilities' }, () => {
        refreshPublicFeed(authTokenRef.current);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pnc_reports' }, () => {
        refreshPublicFeed(authTokenRef.current);
        if (authTokenRef.current) refreshCitizenMe(authTokenRef.current);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pnc_complaints' }, () => {
        if (authTokenRef.current) refreshCitizenMe(authTokenRef.current);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pnc_chat_messages' }, () => {
        if (authTokenRef.current) refreshCitizenMe(authTokenRef.current);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pnc_notifications' }, () => {
        if (authTokenRef.current) refreshCitizenMe(authTokenRef.current);
      })
      .subscribe();

    return () => {
      void sb.removeChannel(channel);
    };
  }, [supabaseReady]);

  // Authenticated citizen personal state sync
  useEffect(() => {
    if (!authToken) {
      setReports([]);
      setComplaints([]);
      setNotifications([]);
      setChatMessages([]);
      setSelectedReportId('');
      return;
    }

    refreshCitizenMe(authToken);
  }, [authToken]);

  // Real-time WebSocket connection for Command Center -> Citizen updates
  useEffect(() => {
    let active = true;
    let reconnectTimer: number | undefined;

    const connectWs = () => {
      if (!active) return;
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (authTokenRef.current) {
          ws.send(JSON.stringify({ type: 'auth', token: authTokenRef.current }));
        }
      };

      ws.onmessage = (evt) => {
        try {
          const parsed = JSON.parse(evt.data as string) as { event: string; payload: unknown };
          if (parsed.event === 'report:created') {
            const incoming = parsed.payload as IncidentReport;
            setReports((prev) =>
              prev.some((r) => r.id === incoming.id) ? prev : [incoming, ...prev]
            );
          } else if (parsed.event === 'report:updated') {
            const updated = parsed.payload as IncidentReport;
            setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
          } else if (parsed.event === 'complaint:created') {
            const c = parsed.payload as Complaint;
            setComplaints((prev) => (prev.some((item) => item.id === c.id) ? prev : [c, ...prev]));
          } else if (parsed.event === 'complaint:updated') {
            const c = parsed.payload as Complaint;
            setComplaints((prev) => prev.map((item) => (item.id === c.id ? c : item)));
          } else if (parsed.event === 'alert:created') {
            const al = parsed.payload as OfficialAlert;
            setOfficialAlerts((prev) =>
              prev.some((a) => a.id === al.id) ? prev : [al, ...prev]
            );
          } else if (parsed.event === 'alert:deleted') {
            const { id } = parsed.payload as { id: string };
            setOfficialAlerts((prev) => prev.filter((a) => a.id !== id));
          } else if (parsed.event === 'station:updated') {
            const list = parsed.payload as PoliceStation[];
            setStations((prev) =>
              list.map((s) => ({
                ...s,
                isFavorite: prev.find((p) => p.id === s.id)?.isFavorite ?? false,
              }))
            );
          } else if (parsed.event === 'map:incident') {
            const pin = parsed.payload as PublicMapIncident;
            setMapIncidents((prev) =>
              prev.some((p) => p.id === pin.id)
                ? prev.map((p) => (p.id === pin.id ? pin : p))
                : [pin, ...prev]
            );
          } else if (parsed.event === 'chat:message') {
            const msg = parsed.payload as ChatMessage;
            setChatMessages((prev) =>
              prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
            );
          } else if (parsed.event === 'notification:created') {
            const n = parsed.payload as AppNotification;
            setNotifications((prev) => (prev.some((x) => x.id === n.id) ? prev : [n, ...prev]));
          }
        } catch {
          // Ignore malformed frame
        }
      };

      ws.onclose = () => {
        if (active) {
          reconnectTimer = window.setTimeout(connectWs, 3000);
        }
      };
    };

    connectWs();
    return () => {
      active = false;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const navigate = (next: ScreenId) => {
    if (!authToken && PROTECTED_SCREENS.includes(next)) {
      setScreen('login');
      window.scrollTo({ top: 0, behavior: 'instant' });
      return;
    }
    if (next !== 'incident-map') {
      setMapFocusDistrict(undefined);
    }
    setScreen(next);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const resetReportDraft = () => {
    setReportDraft({
      category: 'Braquage',
      description: '',
      location: user.commune || '',
      attachments: [],
      anonymous: user.defaultAnonymous,
      contactName: user.fullName,
      contactPhone: user.phone ? `+243 ${user.phone}` : '',
    });
  };

  const handleSubmitReport = async () => {
    const created = await pncApi.createReport(
      {
        category: reportDraft.category || 'Incident',
        description: reportDraft.description.trim(),
        location: reportDraft.location.trim() || user.commune || 'Kinshasa',
        latitude: reportDraft.latitude,
        longitude: reportDraft.longitude,
        attachments: reportDraft.attachments,
        anonymous: reportDraft.anonymous,
        contactName: reportDraft.contactName,
        contactPhone: reportDraft.contactPhone,
      },
      authToken
    );
    setReports((prev) => (prev.some((r) => r.id === created.id) ? prev : [created, ...prev]));
    setSelectedReportId(created.id);
    resetReportDraft();
    setScreen('live-tracking');
  };

  const handleTriggerSosReport = async (coords?: {
    latitude: number;
    longitude: number;
    address?: string;
  }) => {
    const sosReport = await pncApi.createReport(
      {
        category: 'Urgence SOS',
        description:
          "Déclenchement d'alerte SOS d'urgence transmis au Centre de Commandement PNC.",
        location: coords?.address || user.commune || 'Position GPS',
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        anonymous: false,
        contactName: user.fullName || undefined,
        contactPhone: user.phone ? `+243 ${user.phone}` : undefined,
        attachments: [],
        isSos: true,
      },
      authToken
    );
    setReports((prev) => (prev.some((r) => r.id === sosReport.id) ? prev : [sosReport, ...prev]));
    setSelectedReportId(sosReport.id);
    setScreen('live-tracking');
  };

  const handleSubmitComplaint = async (
    data: Omit<Complaint, 'id' | 'reference' | 'date' | 'status' | 'assignedStation'>
  ) => {
    if (!authToken) {
      navigate('login');
      return;
    }
    const created = await pncApi.createComplaint(data, authToken);
    setComplaints((prev) => (prev.some((c) => c.id === created.id) ? prev : [created, ...prev]));
    navigate('complaints-history');
  };

  const handleToggleFavoriteStation = async (stationId: string) => {
    if (!authToken) {
      navigate('login');
      return;
    }
    try {
      const res = await pncApi.toggleFavoriteStation(stationId, authToken);
      setStations((prev) =>
        prev.map((s) => (s.id === stationId ? { ...s, isFavorite: res.isFavorite } : s))
      );
    } catch {
      // Ignore transient error
    }
  };

  const handleSendChat = async (text: string, reportId?: string) => {
    if (!authToken) {
      navigate('login');
      return;
    }
    const msg = await pncApi.sendChatMessage({ text, reportId }, authToken);
    setChatMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
  };

  /* -------------------- Pre-auth & Standalone Screens -------------------- */
  if (screen === 'splash') {
    return <SplashScreen onContinue={() => navigate('onboarding')} />;
  }

  if (screen === 'onboarding') {
    return <OnboardingScreen onFinish={() => navigate('login')} />;
  }

  if (screen === 'login') {
    return (
      <LoginScreen
        supabaseEnabled={supabaseReady}
        onAuthenticated={(token, loggedUser) => {
          setAuthToken(token);
          setUser(loggedUser);
          setScreen('dashboard');
          window.scrollTo({ top: 0, behavior: 'instant' });
        }}
        onGoToRegister={() => navigate('register')}
      />
    );
  }

  if (screen === 'register') {
    return (
      <RegisterScreen
        supabaseEnabled={supabaseReady}
        onAuthenticated={(token, registeredUser) => {
          setAuthToken(token);
          setUser(registeredUser);
          setScreen('dashboard');
          window.scrollTo({ top: 0, behavior: 'instant' });
        }}
        onGoToLogin={() => navigate('login')}
      />
    );
  }

  if (screen === 'sos-alert') {
    return (
      <SosAlertScreen
        user={user}
        onCancel={() => navigate(authToken ? 'dashboard' : 'login')}
        onTriggerEmergencyReport={handleTriggerSosReport}
      />
    );
  }

  const activeReport = reports.find((r) => r.id === selectedReportId) || reports[0];

  const screensWithBottomNav: ScreenId[] = [
    'dashboard',
    'my-alerts',
    'official-alerts',
    'complaints-history',
    'prevention-center',
    'emergency-directory',
    'profile',
    'notifications',
  ];

  return (
    <AppShell
      currentScreen={screen}
      onNavigate={navigate}
      showBottomNav={screensWithBottomNav.includes(screen)}
      unreadNotifications={unreadCount}
    >
      {screen === 'dashboard' && (
        <DashboardScreen
          user={user}
          officialAlerts={officialAlerts}
          userReports={reports}
          unreadNotifications={unreadCount}
          onNavigate={navigate}
          onSelectReport={(reportId) => {
            setSelectedReportId(reportId);
            navigate('live-tracking');
          }}
        />
      )}

      {screen === 'official-alerts' && (
        <OfficialAlertsScreen
          alerts={officialAlerts}
          onBack={() => navigate('dashboard')}
          onNavigate={navigate}
        />
      )}

      {screen === 'incident-map' && (
        <IncidentMapScreen
          incidents={mapIncidents}
          stations={stations}
          onBack={() => navigate('dashboard')}
          initialFocusDistrict={mapFocusDistrict}
        />
      )}

      {screen === 'police-stations' && (
        <PoliceStationsScreen
          stations={stations}
          onToggleFavorite={(id) => {
            void handleToggleFavoriteStation(id);
          }}
          onBack={() => navigate('dashboard')}
          onViewMap={(commune) => {
            setMapFocusDistrict(commune);
            navigate('incident-map');
          }}
        />
      )}

      {screen === 'report-step1' && (
        <ReportStep1Screen
          draft={reportDraft}
          onUpdate={(patch) => setReportDraft((prev) => ({ ...prev, ...patch }))}
          onBack={() => navigate('dashboard')}
          onNext={() => navigate('report-step2')}
        />
      )}

      {screen === 'report-step2' && (
        <ReportStep2Screen
          draft={reportDraft}
          onUpdate={(patch) => setReportDraft((prev) => ({ ...prev, ...patch }))}
          onBack={() => navigate('report-step1')}
          onNext={() => navigate('report-step3')}
        />
      )}

      {screen === 'report-step3' && (
        <ReportStep3Screen
          draft={reportDraft}
          onUpdate={(patch) => setReportDraft((prev) => ({ ...prev, ...patch }))}
          onBack={() => navigate('report-step2')}
          onSubmit={handleSubmitReport}
        />
      )}

      {screen === 'my-alerts' && (
        <MyAlertsScreen
          reports={reports}
          onBack={() => navigate('dashboard')}
          onSelectReport={(id) => {
            setSelectedReportId(id);
            navigate('live-tracking');
          }}
          onNewReport={() => {
            resetReportDraft();
            navigate('report-step1');
          }}
        />
      )}

      {screen === 'live-tracking' && activeReport && (
        <LiveTrackingScreen
          report={activeReport}
          onBack={() => navigate('my-alerts')}
          onContactDispatch={() => navigate('dispatch-chat')}
        />
      )}

      {screen === 'file-complaint' && (
        <FileComplaintScreen
          onBack={() => navigate('dashboard')}
          onSubmitComplaint={(data) => {
            void handleSubmitComplaint(data);
          }}
        />
      )}

      {screen === 'complaints-history' && (
        <ComplaintsHistoryScreen
          complaints={complaints}
          onBack={() => navigate('dashboard')}
          onNewComplaint={() => navigate('file-complaint')}
        />
      )}

      {screen === 'doc-verification' && (
        <DocVerificationScreen onBack={() => navigate('dashboard')} />
      )}

      {screen === 'prevention-center' && (
        <PreventionCenterScreen onBack={() => navigate('dashboard')} />
      )}

      {screen === 'emergency-directory' && (
        <EmergencyDirectoryScreen onBack={() => navigate('dashboard')} />
      )}

      {screen === 'dispatch-chat' && (
        <DispatchChatScreen
          messages={chatMessages}
          onSendMessage={(text) => handleSendChat(text, activeReport?.id)}
          onBack={() => navigate(activeReport ? 'live-tracking' : 'dashboard')}
        />
      )}

      {screen === 'notifications' && (
        <NotificationsScreen
          notifications={notifications}
          onMarkAllRead={() => {
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
            if (authToken) void pncApi.markAllNotificationsRead(authToken);
          }}
          onSelectNotification={(n) => {
            setNotifications((prev) =>
              prev.map((item) => (item.id === n.id ? { ...item, read: true } : item))
            );
            if (authToken) void pncApi.markNotificationRead(n.id, authToken);
            if (n.targetScreen) {
              navigate(n.targetScreen);
            }
          }}
          onBack={() => navigate('dashboard')}
        />
      )}

      {screen === 'profile' && (
        <ProfileScreen
          user={user}
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode((d) => !d)}
          onSaveProfile={async (patch) => {
            if (!authToken) return;
            const res = await pncApi.updateProfile(patch, authToken);
            setUser(res.user);
          }}
          onNavigate={navigate}
          onLogout={() => {
            const sb = getSupabaseClientSync();
            if (sb) {
              void sb.auth.signOut();
            }
            setAuthToken(null);
            setUser(EMPTY_USER);
            setScreen('login');
          }}
          onBack={() => navigate('dashboard')}
        />
      )}
    </AppShell>
  );
}
