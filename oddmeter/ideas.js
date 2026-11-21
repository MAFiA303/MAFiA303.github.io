import { decodeSetupSnapshot, describeSetup, encodeSetupSnapshot, ideaIdPattern, ideasStorageKey, readSettings } from './settings.js?v=delete1';

export const firebaseConfig = {
  apiKey: 'AIzaSyChRd_f6wT3T8FOdItMbI5x78ErLDoi85A',
  authDomain: 'oddmeter-mafium.firebaseapp.com',
  projectId: 'oddmeter-mafium',
  storageBucket: 'oddmeter-mafium.firebasestorage.app',
  messagingSenderId: '784875736976',
  appId: '1:784875736976:web:d930478dcdace9dfc1ad15',
};

export const firestoreDatabaseId = 'oddmeter-db';
export const firebaseSdkVersion = '13.4.0';
export const defaultGuestName = 'Anon';
export const authorStorageKey = 'oddmeter-author-v2';
export const titleStorageKey = 'oddmeter-title-v1';
export const ideaLimits = { title: 60, authorName: 40, setup: 16384, list: 200 };

export function isDefaultIdeaTitle(title) {
  return typeof title === 'string' && /^Idea\s+\d+$/i.test(title.trim());
}

export function readSavedTitle(storage) {
  if (!storage) return '';
  try {
    const raw = storage.getItem(titleStorageKey);
    const clean = typeof raw === 'string' ? raw.trim().slice(0, ideaLimits.title) : '';
    return clean && !isDefaultIdeaTitle(clean) ? clean : '';
  } catch {
    return '';
  }
}

export function writeSavedTitle(storage, title) {
  if (!storage) return;
  try {
    const clean = typeof title === 'string' ? title.trim().slice(0, ideaLimits.title) : '';
    if (clean && !isDefaultIdeaTitle(clean)) {
      storage.setItem(titleStorageKey, clean);
    } else {
      storage.removeItem(titleStorageKey);
    }
  } catch { /* Storage is optional. */ }
}

export function readSavedAuthor(storage) {
  if (!storage) return '';
  try {
    const raw = storage.getItem(authorStorageKey);
    const clean = typeof raw === 'string' ? raw.trim().slice(0, ideaLimits.authorName) : '';
    return clean && clean.toLowerCase() !== defaultGuestName.toLowerCase() ? clean : '';
  } catch {
    return '';
  }
}

export function writeSavedAuthor(storage, name) {
  if (!storage) return;
  try {
    const clean = typeof name === 'string' ? name.trim().slice(0, ideaLimits.authorName) : '';
    if (clean && clean.toLowerCase() !== defaultGuestName.toLowerCase()) {
      storage.setItem(authorStorageKey, clean);
    } else {
      storage.removeItem(authorStorageKey);
    }
  } catch { /* Storage is optional. */ }
}

const idAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

export function makeIdeaId(length = 10) {
  const bytes = new Uint8Array(length);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let id = '';
  for (let i = 0; i < length; i++) id += idAlphabet[bytes[i] % idAlphabet.length];
  return id;
}

export function normalizeIdeaTitle(value, fallback = '') {
  const clean = typeof value === 'string' ? value.trim().slice(0, ideaLimits.title) : '';
  return clean || (typeof fallback === 'string' ? fallback.trim().slice(0, ideaLimits.title) : '');
}

export function authorNameFromUser(user) {
  if (!user || user.isAnonymous) return defaultGuestName;
  const display = typeof user.displayName === 'string' ? user.displayName.trim() : '';
  if (display) return display.slice(0, ideaLimits.authorName);
  const email = typeof user.email === 'string' ? user.email.trim() : '';
  const handle = email.includes('@') ? email.split('@')[0].trim() : email;
  if (handle) return handle.slice(0, ideaLimits.authorName);
  return defaultGuestName;
}

export function nextDefaultIdeaTitle(ideas = []) {
  let max = 0;
  for (const item of ideas) {
    const match = typeof item?.title === 'string' ? /^Idea\s+(\d+)$/i.exec(item.title.trim()) : null;
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `Idea ${max + 1}`;
}

function toEpochMs(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value && typeof value.toMillis === 'function') return value.toMillis();
  if (value && typeof value.seconds === 'number') return value.seconds * 1000;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
}

export function normalizeIdeaRecord(raw, { idFallback = '', source = 'local' } = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const id = typeof raw.id === 'string' && ideaIdPattern.test(raw.id) ? raw.id : idFallback;
  if (!id || !ideaIdPattern.test(id)) return null;
  const setup = typeof raw.setup === 'string' ? raw.setup : '';
  const decoded = decodeSetupSnapshot(setup);
  if (!decoded || setup.length > ideaLimits.setup) return null;
  const info = describeSetup(decoded);
  const title = normalizeIdeaTitle(raw.title, 'Idea 1');
  if (!title) return null;
  const rawAuthor = typeof raw.authorName === 'string' ? raw.authorName.trim().slice(0, ideaLimits.authorName) : '';
  const authorName = rawAuthor || (source === 'cloud' ? defaultGuestName : 'Local');
  return {
    id,
    ownerUid: typeof raw.ownerUid === 'string' ? raw.ownerUid : '',
    authorName,
    title,
    setup,
    bpm: info.bpm,
    beats: info.beats,
    unit: info.unit,
    createdAt: toEpochMs(raw.createdAt),
    updatedAt: toEpochMs(raw.updatedAt),
    source,
  };
}

export function readLocalIdeas(storage) {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(ideasStorageKey) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    const seen = new Set();
    const list = [];
    for (const item of parsed) {
      const normalized = normalizeIdeaRecord(item, { source: 'local' });
      if (!normalized || seen.has(normalized.id)) continue;
      seen.add(normalized.id);
      list.push(normalized);
    }
    return list.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, ideaLimits.list);
  } catch {
    return [];
  }
}

export function writeLocalIdeas(storage, ideas) {
  if (!storage) return;
  try {
    const payload = ideas.slice(0, ideaLimits.list).map(({ id, authorName, title, setup, bpm, beats, unit, createdAt, updatedAt }) => ({
      id, authorName, title, setup, bpm, beats, unit, createdAt, updatedAt,
    }));
    storage.setItem(ideasStorageKey, JSON.stringify(payload));
  } catch { /* Storage is optional. */ }
}

export function buildIdeaPayload({ title, fallbackTitle = 'Idea 1', authorName = 'Local', settings }) {
  const safe = readSettings(settings);
  const setup = encodeSetupSnapshot(safe);
  if (setup.length > ideaLimits.setup) {
    throw new Error('Pattern is too large to save.');
  }
  const info = describeSetup(safe);
  const cleanTitle = normalizeIdeaTitle(title, fallbackTitle) || 'Idea 1';
  const cleanAuthor = typeof authorName === 'string' && authorName.trim()
    ? authorName.trim().slice(0, ideaLimits.authorName)
    : defaultGuestName;
  return {
    title: cleanTitle,
    authorName: cleanAuthor,
    setup,
    bpm: info.bpm,
    beats: info.beats,
    unit: info.unit,
  };
}

function formatCloudError(error, fallback = 'Could not reach online ideas.') {
  const code = error?.code ?? '';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return '';
  if (code === 'auth/unauthorized-domain') return 'Domain not authorized for sign-in.';
  if (code === 'auth/network-request-failed' || code === 'unavailable') return 'Offline — unable to reach online ideas.';
  if (code === 'permission-denied') return 'Sign in to edit or delete your own ideas.';
  return error?.message || fallback;
}

export function createFirebaseCloudAdapter({ sdkBase = `https://www.gstatic.com/firebasejs/${firebaseSdkVersion}` } = {}) {
  let readyPromise = null;

  async function ensureSdk() {
    if (readyPromise) return readyPromise;
    readyPromise = (async () => {
      const [appMod, authMod, fsMod] = await Promise.all([
        import(`${sdkBase}/firebase-app.js`),
        import(`${sdkBase}/firebase-auth.js`),
        import(`${sdkBase}/firebase-firestore.js`),
      ]);
      const existing = appMod.getApps().find((item) => item.name === 'oddmeter');
      const app = existing ?? appMod.initializeApp(firebaseConfig, 'oddmeter');
      const auth = authMod.getAuth(app);
      const db = fsMod.getFirestore(app, firestoreDatabaseId);
      authMod.getRedirectResult(auth).catch(() => {});
      return { app, auth, db, authMod, fsMod };
    })().catch((error) => {
      readyPromise = null;
      throw error;
    });
    return readyPromise;
  }

  return {
    async subscribeAuth(callback) {
      const { auth, authMod } = await ensureSdk();
      return authMod.onAuthStateChanged(auth, (user) => {
        const isAnonymous = Boolean(user && (user.isAnonymous || !user.providerData?.length));
        callback(user ? {
          uid: user.uid,
          displayName: isAnonymous ? '' : (user.displayName || ''),
          email: isAnonymous ? '' : (user.email || ''),
          isAnonymous,
        } : null);
      });
    },
    async signInAnonymously() {
      const { auth, authMod } = await ensureSdk();
      if (auth.currentUser) {
        const current = auth.currentUser;
        const isAnonymous = Boolean(current.isAnonymous || !current.providerData?.length);
        return {
          uid: current.uid,
          displayName: isAnonymous ? '' : (current.displayName || ''),
          email: isAnonymous ? '' : (current.email || ''),
          isAnonymous,
        };
      }
      const result = await authMod.signInAnonymously(auth);
      return { uid: result.user.uid, displayName: '', email: '', isAnonymous: true };
    },
    async signInWithGoogle() {
      const { auth, authMod } = await ensureSdk();
      const provider = new authMod.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      try {
        const result = await authMod.signInWithPopup(auth, provider);
        return {
          uid: result.user.uid,
          displayName: result.user.displayName || '',
          email: result.user.email || '',
          isAnonymous: false,
        };
      } catch (error) {
        if (error?.code === 'auth/popup-blocked' || error?.code === 'auth/operation-not-supported-in-this-environment') {
          await authMod.signInWithRedirect(auth, provider);
          return null;
        }
        throw error;
      }
    },
    async signOut() {
      const { auth, authMod } = await ensureSdk();
      await authMod.signOut(auth);
    },
    // Real-time public snapshot listener keeps the shared ideas table live across devices.
    async subscribeIdeas(onData, onError) {
      const { db, fsMod } = await ensureSdk();
      const q = fsMod.query(
        fsMod.collection(db, 'ideas'),
        fsMod.orderBy('updatedAt', 'desc'),
        fsMod.limit(ideaLimits.list),
      );
      return fsMod.onSnapshot(q, (snapshot) => {
        const list = [];
        snapshot.forEach((entry) => {
          const normalized = normalizeIdeaRecord({ id: entry.id, ...entry.data() }, { source: 'cloud' });
          if (normalized) list.push(normalized);
        });
        onData(list);
      }, (error) => {
        onError?.(error);
      });
    },
    async fetchIdea(id) {
      if (!ideaIdPattern.test(id)) return null;
      const { db, fsMod } = await ensureSdk();
      const snap = await fsMod.getDoc(fsMod.doc(db, 'ideas', id));
      if (!snap.exists()) return null;
      return normalizeIdeaRecord({ id: snap.id, ...snap.data() }, { source: 'cloud' });
    },
    async createIdea(uid, id, payload) {
      const { db, fsMod } = await ensureSdk();
      await fsMod.setDoc(fsMod.doc(db, 'ideas', id), {
        ownerUid: uid,
        authorName: payload.authorName,
        title: payload.title,
        setup: payload.setup,
        bpm: payload.bpm,
        beats: payload.beats,
        unit: payload.unit,
        createdAt: fsMod.serverTimestamp(),
        updatedAt: fsMod.serverTimestamp(),
      });
    },
    async updateIdea(id, fields) {
      const { db, fsMod } = await ensureSdk();
      await fsMod.updateDoc(fsMod.doc(db, 'ideas', id), {
        ...fields,
        updatedAt: fsMod.serverTimestamp(),
      });
    },
    async deleteIdea(id) {
      const { db, fsMod } = await ensureSdk();
      await fsMod.deleteDoc(fsMod.doc(db, 'ideas', id));
    },
  };
}

export function createIdeaStore({ storage = globalThis.localStorage, cloud = null } = {}) {
  const listeners = new Set();
  let localIdeas = readLocalIdeas(storage);
  let cloudIdeas = [];
  let user = null;
  let loading = Boolean(cloud);
  let cloudError = '';
  let unsubAuth = null;
  let unsubIdeas = null;
  let disposed = false;

  const state = () => ({
    user,
    account: user && !user.isAnonymous ? user : null,
    loading,
    cloudAvailable: Boolean(cloud),
    cloudError,
    ideas: cloud ? cloudIdeas : localIdeas,
    nextTitle: nextDefaultIdeaTitle(cloud ? cloudIdeas : localIdeas),
  });

  function emit() {
    if (disposed) return;
    const snapshot = state();
    listeners.forEach((fn) => fn(snapshot));
  }

  async function init() {
    emit();
    if (!cloud || disposed) return;
    loading = true;
    emit();
    try {
      const [authUnsub, ideasUnsub] = await Promise.all([
        cloud.subscribeAuth((nextUser) => {
          if (disposed) return;
          user = nextUser;
          cloudError = '';
          emit();
        }),
        cloud.subscribeIdeas((items) => {
          if (disposed) return;
          cloudIdeas = items;
          loading = false;
          cloudError = '';
          emit();
        }, (error) => {
          if (disposed) return;
          loading = false;
          cloudError = formatCloudError(error);
          emit();
        }),
      ]);
      unsubAuth = authUnsub;
      unsubIdeas = ideasUnsub;
    } catch (error) {
      loading = false;
      cloudError = formatCloudError(error);
      emit();
    }
  }

  async function signIn() {
    if (!cloud) throw new Error('Online sync is unavailable.');
    cloudError = '';
    emit();
    try {
      const signedInUser = await cloud.signInWithGoogle();
      if (signedInUser && !disposed) {
        user = {
          uid: signedInUser.uid,
          displayName: signedInUser.displayName || '',
          email: signedInUser.email || '',
          isAnonymous: Boolean(signedInUser.isAnonymous),
        };
        emit();
      }
      return user;
    } catch (error) {
      const message = formatCloudError(error, 'Sign-in failed.');
      cloudError = message;
      emit();
      if (message) throw new Error(message);
      return null;
    }
  }

  async function signOut() {
    if (!cloud) return;
    await cloud.signOut();
  }

  async function save({ id = '', title = '', authorName = '', settings }) {
    const currentList = cloud ? cloudIdeas : localIdeas;
    const existing = id ? currentList.find((item) => item.id === id) : null;
    const fallbackTitle = existing ? existing.title : nextDefaultIdeaTitle(currentList);
    const customAuthor = typeof authorName === 'string' ? authorName.trim().slice(0, ideaLimits.authorName) : '';
    const now = Date.now();

    if (cloud) {
      try {
        if (!user) {
          if (typeof cloud.signInAnonymously !== 'function') {
            throw new Error('Sign in to save ideas online.');
          }
          const guest = await cloud.signInAnonymously();
          if (guest && !disposed) {
            user = {
              uid: guest.uid,
              displayName: guest.displayName || '',
              email: guest.email || '',
              isAnonymous: guest.isAnonymous !== false,
            };
            emit();
          }
        }
        if (!user) throw new Error('Could not start a save session.');
        const resolvedAuthor = !user.isAnonymous
          ? authorNameFromUser(user)
          : (customAuthor || defaultGuestName);
        const payload = buildIdeaPayload({
          title,
          fallbackTitle,
          authorName: resolvedAuthor,
          settings,
        });
        if (existing && existing.ownerUid === user.uid) {
          await cloud.updateIdea(existing.id, payload);
          const updated = { ...existing, ...payload, updatedAt: now };
          cloudIdeas = [updated, ...cloudIdeas.filter((item) => item.id !== existing.id)];
          emit();
          return updated;
        }
        const targetId = makeIdeaId();
        await cloud.createIdea(user.uid, targetId, payload);
        const created = {
          id: targetId,
          ownerUid: user.uid,
          ...payload,
          createdAt: now,
          updatedAt: now,
          source: 'cloud',
        };
        cloudIdeas = [created, ...cloudIdeas.filter((item) => item.id !== targetId)];
        emit();
        return created;
      } catch (error) {
        const message = formatCloudError(error, 'Could not save idea.');
        throw new Error(message || 'Could not save idea.');
      }
    }

    const payload = buildIdeaPayload({
      title,
      fallbackTitle,
      authorName: customAuthor || 'Local',
      settings,
    });
    const targetId = existing ? existing.id : makeIdeaId();
    const record = {
      id: targetId,
      ownerUid: '',
      ...payload,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      source: 'local',
    };
    localIdeas = [record, ...localIdeas.filter((item) => item.id !== targetId)].slice(0, ideaLimits.list);
    writeLocalIdeas(storage, localIdeas);
    emit();
    return record;
  }

  async function remove(id) {
    if (cloud) {
      if (!user) throw new Error('Sign in to delete your ideas.');
      try {
        await cloud.deleteIdea(id);
        cloudIdeas = cloudIdeas.filter((item) => item.id !== id);
        emit();
        return;
      } catch (error) {
        const message = formatCloudError(error, 'Could not delete idea.');
        throw new Error(message || 'Could not delete idea.');
      }
    }
    localIdeas = localIdeas.filter((item) => item.id !== id);
    writeLocalIdeas(storage, localIdeas);
    emit();
  }

  async function fetchById(id) {
    if (!ideaIdPattern.test(id)) return null;
    const loaded = (cloud ? cloudIdeas : localIdeas).find((item) => item.id === id);
    if (loaded) return loaded;
    if (cloud) return cloud.fetchIdea(id);
    return null;
  }

  function dispose() {
    disposed = true;
    if (typeof unsubIdeas === 'function') {
      try { unsubIdeas(); } catch { /* Ignore */ }
    }
    if (typeof unsubAuth === 'function') {
      try { unsubAuth(); } catch { /* Ignore */ }
    }
    unsubIdeas = null;
    unsubAuth = null;
    listeners.clear();
  }

  return {
    get state() { return state(); },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    init,
    signIn,
    signOut,
    save,
    remove,
    fetchById,
    dispose,
  };
}
