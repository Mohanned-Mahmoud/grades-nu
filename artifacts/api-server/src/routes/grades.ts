import { Router } from "express";
import { randomBytes } from "crypto";
import { logger } from "../lib/logger";

const router = Router();

const PORTAL_BASE = "https://register.nu.edu.eg/PowerCampusSelfService";

interface CookieStore {
  cookies: Map<string, string>;
}

interface Session {
  jar: CookieStore;
  displayName: string;
  username: string;
  password: string;
}

const sessions = new Map<string, Session>();

function createJar(): CookieStore {
  return { cookies: new Map() };
}

function parseSetCookies(jar: CookieStore, headers: string[]): void {
  for (const header of headers) {
    const parts = header.split(";");
    const nameValue = parts[0];
    const idx = nameValue.indexOf("=");
    if (idx !== -1) {
      const name = nameValue.substring(0, idx).trim();
      const value = nameValue.substring(idx + 1).trim();
      jar.cookies.set(name, value);
    }
  }
}

function cookieHeader(jar: CookieStore): string {
  return Array.from(jar.cookies.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

async function portalFetch(
  jar: CookieStore,
  url: string,
  options: RequestInit & { headers?: Record<string, string> } = {},
): Promise<Response> {
  const cookie = cookieHeader(jar);
  const headers: Record<string, string> = {
    Accept: "application/json, text/html, */*",
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "X-Requested-With": "XMLHttpRequest",
    Referer: PORTAL_BASE + "/",
    Origin: "https://register.nu.edu.eg",
    ...(cookie ? { Cookie: cookie } : {}),
    ...((options.headers ?? {}) as Record<string, string>),
  };

  const resp = await fetch(url, {
    ...options,
    headers,
    redirect: "manual",
  });

  try {
    const getSetCookie = (resp.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie;
    const setCookies: string[] = typeof getSetCookie === "function" ? getSetCookie.call(resp.headers) : [];
    if (setCookies.length > 0) {
      parseSetCookies(jar, setCookies);
    } else {
      const raw = resp.headers.get("set-cookie");
      if (raw) parseSetCookies(jar, [raw]);
    }
  } catch {
    const raw = resp.headers.get("set-cookie");
    if (raw) parseSetCookies(jar, [raw]);
  }

  return resp;
}

function extractToken(req: { headers: { authorization?: string } }): string | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return null;
  return auth.substring(7);
}

interface GradeItem {
  courseCode: string;
  courseName: string;
  credits: string;
  grade: string;
  midtermGrade: string;
  points: string;
  section: string;
  subType: string;
}

function parsePortalJson(raw: string): Record<string, unknown> | null {
  try {
    let p: unknown = JSON.parse(raw);
    if (typeof p === "string") p = JSON.parse(p);
    if (p && typeof p === "object" && !Array.isArray(p)) return p as Record<string, unknown>;
    return null;
  } catch {
    return null;
  }
}

interface GradesFetchResult {
  grades: GradeItem[];
  sessionValid: boolean;
}

interface PortalCourse {
  eventId?: string;
  name?: string;
  section?: string;
  sectionId?: number;
  credits?: string;
  finalGrade?: string;
  midtermGrade?: string;
  qualityPoints?: string;
  subType?: string;
}

interface PortalSession {
  courses?: PortalCourse[];
}

interface PortalTranscriptSequence {
  sessions?: PortalSession[];
}

interface PortalGradesData {
  transcriptSequences?: PortalTranscriptSequence[];
}

function extractCoursesFromGradesData(data: PortalGradesData): GradeItem[] {
  const sequences = data.transcriptSequences ?? [];
  // Collect all courses across all sequences and sessions
  const allCourses: PortalCourse[] = [];
  for (const seq of sequences) {
    for (const session of seq.sessions ?? []) {
      for (const course of session.courses ?? []) {
        allCourses.push(course);
      }
    }
  }

  // Deduplicate by eventId — keep the entry with the highest numeric credits
  // (the main lecture section, which carries real credit hours)
  const byEventId = new Map<string, PortalCourse>();
  for (const course of allCourses) {
    const key = course.eventId ?? String(course.sectionId ?? "");
    if (!key) continue;
    const existing = byEventId.get(key);
    if (!existing) {
      byEventId.set(key, course);
    } else {
      const existingCredits = parseFloat(existing.credits ?? "0");
      const newCredits = parseFloat(course.credits ?? "0");
      if (newCredits > existingCredits) {
        byEventId.set(key, course);
      }
    }
  }

  return Array.from(byEventId.values()).map((c) => ({
    courseCode: c.eventId ?? "",
    courseName: c.name ?? "",
    credits: c.credits ?? "",
    grade: c.finalGrade ?? "",
    midtermGrade: c.midtermGrade ?? "",
    points: c.qualityPoints ?? "",
    section: c.section ?? "",
    subType: c.subType ?? "",
  }));
}

async function fetchGradesApi(jar: CookieStore): Promise<GradesFetchResult> {
  // Step 1: Check session via periods endpoint — redirects on 401
  const periodsResp = await portalFetch(jar, `${PORTAL_BASE}/Periods/GradeReport/`, {
    method: "GET",
    headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
  });

  if (periodsResp.status >= 300) {
    logger.warn({ status: periodsResp.status }, "periods redirected — session expired");
    return { grades: [], sessionValid: false };
  }

  const periodsData = parsePortalJson(await periodsResp.text());
  if (!periodsData?.status || !Array.isArray(periodsData.data) || periodsData.data.length === 0) {
    logger.info("No term periods available");
    return { grades: [], sessionValid: true };
  }

  const first = periodsData.data[0] as Record<string, unknown>;
  const termPeriodId = first.value as number | string;
  logger.info({ termPeriodId }, "fetching grades for period");

  // Step 2: POST /Students/Grades — returns data.transcriptSequences[n].sessions[m].courses
  const gradesResp = await portalFetch(jar, `${PORTAL_BASE}/Students/Grades`, {
    method: "POST",
    body: JSON.stringify({ termPeriodId }),
    headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
  });

  const gradesData = parsePortalJson(await gradesResp.text());
  if (!gradesData?.status || !gradesData.data) {
    logger.warn({ gradesStatus: gradesResp.status }, "Students/Grades returned no data");
    return { grades: [], sessionValid: true };
  }

  const grades = extractCoursesFromGradesData(gradesData.data as PortalGradesData);
  logger.info({ gradesCount: grades.length, first: grades[0] }, "grades extracted");

  return { grades, sessionValid: true };
}


function extractAuthField(data: Record<string, unknown>, field: string): unknown {
  if (field in data) return data[field];
  const nested = data.data;
  if (nested && typeof nested === "object" && field in (nested as Record<string, unknown>)) {
    return (nested as Record<string, unknown>)[field];
  }
  return undefined;
}

async function doLogin(
  jar: CookieStore,
  username: string,
  password: string,
): Promise<{ success: boolean; displayName?: string; error?: string }> {
  // Step 1: GET the login page to establish initial session cookie
  await portalFetch(jar, `${PORTAL_BASE}/SignIn`, {
    method: "GET",
    headers: { Accept: "text/html,application/xhtml+xml,*/*" },
  });

  // Step 2: Get authentication mode — portal wraps response as { data: { userExists } }
  const modeResp = await portalFetch(jar, `${PORTAL_BASE}/SignIn/GetAuthenticationMode`, {
    method: "POST",
    body: JSON.stringify({ username }),
  });
  const modeRaw = await modeResp.text();
  logger.info({ step: "GetAuthenticationMode", status: modeResp.status, body: modeRaw.slice(0, 300) }, "login step");
  let modeData: Record<string, unknown> | null = null;
  try {
    let p: unknown = JSON.parse(modeRaw);
    if (typeof p === "string") p = JSON.parse(p);
    if (p && typeof p === "object" && !Array.isArray(p)) modeData = p as Record<string, unknown>;
  } catch { /* ignore */ }
  if (modeData !== null) {
    const userExists = extractAuthField(modeData, "userExists");
    if (userExists === false) {
      return { success: false, error: "Invalid username or password" };
    }
  }

  // Step 3: Authenticate
  const authResp = await portalFetch(jar, `${PORTAL_BASE}/SignIn/Authenticate`, {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  const authRaw = await authResp.text();
  logger.info({ step: "Authenticate", status: authResp.status, body: authRaw.slice(0, 300) }, "login step");

  // Step 4: Try to read auth status — portal may wrap as { data: { isAuthenticated, displayName } }
  let authData: Record<string, unknown> | null = null;
  try {
    let p: unknown = JSON.parse(authRaw);
    if (typeof p === "string") p = JSON.parse(p);
    if (p && typeof p === "object" && !Array.isArray(p)) authData = p as Record<string, unknown>;
  } catch { /* ignore */ }
  if (authData !== null) {
    const isAuthenticated = extractAuthField(authData, "isAuthenticated");
    const successFlag = extractAuthField(authData, "success");
    const displayName = extractAuthField(authData, "displayName");
    // Portal returns either isAuthenticated or success to indicate auth result
    if (isAuthenticated === true || successFlag === true) {
      return {
        success: true,
        displayName: (displayName as string | undefined) ?? "",
      };
    }
    if (isAuthenticated === false || successFlag === false) {
      return { success: false, error: "Invalid username or password" };
    }
  }

  // Step 5: Fallback — verify via InitialLoadData
  const verifyResp = await portalFetch(jar, `${PORTAL_BASE}/Layout/InitialLoadData`, {
    method: "POST",
    body: JSON.stringify({}),
    headers: { Accept: "application/json" },
  });
  const verifyRaw = await verifyResp.text();
  logger.info({ step: "InitialLoadData", status: verifyResp.status, body: verifyRaw.slice(0, 300) }, "login step");

  let verifyData: Record<string, unknown> | null = null;
  try {
    let p: unknown = JSON.parse(verifyRaw);
    if (typeof p === "string") p = JSON.parse(p);
    if (p && typeof p === "object" && !Array.isArray(p)) verifyData = p as Record<string, unknown>;
  } catch { /* ignore */ }
  if (verifyData !== null) {
    const isAuthenticated = extractAuthField(verifyData, "isAuthenticated");
    const displayName = extractAuthField(verifyData, "displayName");
    if (isAuthenticated === true) {
      return {
        success: true,
        displayName: (displayName as string | undefined) ?? "",
      };
    }
    if (isAuthenticated === false) {
      return { success: false, error: "Invalid username or password" };
    }
  }

  // Last resort: check if the home page is accessible (means we're logged in)
  const homeResp = await portalFetch(jar, `${PORTAL_BASE}/Home/Index`, {
    method: "GET",
    headers: { Accept: "text/html,*/*" },
  });
  const homeHtml = await homeResp.text();
  logger.info({ step: "Home/Index", status: homeResp.status, htmlLen: homeHtml.length, snippet: homeHtml.slice(0, 200) }, "login step");
  const isLoggedIn =
    homeResp.status === 200 &&
    !homeHtml.toLowerCase().includes("signin") &&
    !homeHtml.toLowerCase().includes("username") &&
    homeHtml.length > 1000;
  if (isLoggedIn) {
    return { success: true, displayName: "" };
  }
  return { success: false, error: "Invalid username or password" };
}

router.post("/login", async (req, res) => {
  const { username, password } = (req.body ?? {}) as { username?: string; password?: string };

  if (!username || !password) {
    res.status(400).json({ success: false, error: "Username and password required" });
    return;
  }

  const jar = createJar();

  try {
    const result = await doLogin(jar, username, password);

    if (!result.success) {
      res.json({ success: false, error: result.error });
      return;
    }

    const sessionToken = randomBytes(32).toString("hex");
    sessions.set(sessionToken, {
      jar,
      displayName: result.displayName ?? "",
      username,
      password,
    });

    res.json({
      success: true,
      displayName: result.displayName,
      sessionToken,
    });
  } catch (err: unknown) {
    req.log.error({ err }, "Login error");
    const message = err instanceof Error ? err.message : "Network error";
    res.json({ success: false, error: message });
  }
});

router.get("/report", async (req, res) => {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: "Missing session token", needsReAuth: true });
    return;
  }

  const session = sessions.get(token);
  if (!session) {
    res.status(401).json({ error: "Session expired or not found", needsReAuth: true });
    return;
  }

  async function reAuth(): Promise<boolean> {
    const newJar = createJar();
    const result = await doLogin(newJar, session!.username, session!.password);
    if (result.success) {
      session!.jar = newJar;
      return true;
    }
    return false;
  }

  try {
    let result = await fetchGradesApi(session.jar);

    // Only re-auth when the portal signaled an invalid session (redirect)
    if (!result.sessionValid) {
      req.log.info("Session expired, attempting re-auth");
      const ok = await reAuth();
      if (!ok) {
        sessions.delete(token);
        res.status(401).json({ error: "Session expired", needsReAuth: true });
        return;
      }
      result = await fetchGradesApi(session.jar);
    }

    req.log.info({ gradesCount: result.grades.length, first: result.grades[0] }, "grades fetched");
    res.json({ grades: result.grades, fetchedAt: new Date().toISOString(), displayName: session.displayName });
  } catch (err: unknown) {
    req.log.error({ err }, "Grades fetch error");
    const message = err instanceof Error ? err.message : "Failed to fetch grades";
    res.status(500).json({ error: message });
  }
});

router.post("/logout", (req, res) => {
  const token = extractToken(req);
  if (token) {
    sessions.delete(token);
  }
  res.json({ success: true });
});

export default router;
