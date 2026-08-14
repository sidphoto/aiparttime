import express from "express";
import dotenv from "dotenv";
import {
  getStoreFromSheet,
  getEmployeesFromSheet,
  addEmployeeToSheet,
  updateEmployeeInSheet,
  deleteEmployeeInSheet,
  syncAllEmployeesToSheet,
  getWorkRecordsFromSheet,
  saveWorkRecordToSheet,
  getSpreadsheetId,
  ensureSpreadsheetStructure,
} from "./googleSheetsService.js";

dotenv.config();

export const app = express();

// ==========================================
// REQUEST BODY SIZE LIMITS
// ==========================================
// 一般 API 只傳結構化欄位，256KB 綽綽有餘；僅 OCR 端點需要容納 Base64 圖片。
// 全域維持 20MB 會讓每一條 API 都變成大流量攻擊面。
const OCR_ROUTE = "/api/analyze-timecard";
const ocrJsonParser = express.json({ limit: "8mb" });
const standardJsonParser = express.json({ limit: "256kb" });

app.use((req, res, next) => {
  if (req.path === OCR_ROUTE) return ocrJsonParser(req, res, next);
  return standardJsonParser(req, res, next);
});

// Body 超過上限時回傳 JSON 而非 Express 預設 HTML 錯誤頁
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err?.type === "entity.too.large" || err?.status === 413) {
    return res.status(413).json({
      error: "PAYLOAD_TOO_LARGE",
      message: "上傳內容過大，請縮小圖片後再試。",
    });
  }
  return next(err);
});

// ==========================================
// RATE LIMITING
// ==========================================
// 記憶體滑動視窗。注意：Vercel Serverless 每個執行個體各自持有這份狀態，
// 無法跨執行個體共用，因此屬於「盡力而為」的節流，不是硬性配額。
// 要做到硬性限制需改用共用儲存（Upstash Redis / Vercel KV）。
const rateBuckets = new Map<string, number[]>();
const RATE_BUCKET_SOFT_CAP = 5000;

const pruneRateBuckets = (now: number) => {
  if (rateBuckets.size < RATE_BUCKET_SOFT_CAP) return;
  for (const [key, hits] of rateBuckets) {
    if (hits.length === 0 || now - hits[hits.length - 1] > 600_000) {
      rateBuckets.delete(key);
    }
  }
};

const getClientIp = (req: express.Request): string => {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket?.remoteAddress || "unknown";
};

const createRateLimiter = (opts: {
  name: string;
  windowMs: number;
  max: number;
  keyOf: (req: express.Request) => string;
  message: string;
}) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const now = Date.now();
    const key = `${opts.name}:${opts.keyOf(req)}`;
    const hits = (rateBuckets.get(key) || []).filter((t) => now - t < opts.windowMs);

    if (hits.length >= opts.max) {
      rateBuckets.set(key, hits);
      const retryAfterSeconds = Math.max(1, Math.ceil((opts.windowMs - (now - hits[0])) / 1000));
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({
        error: "RATE_LIMITED",
        message: opts.message,
        retry_after_seconds: retryAfterSeconds,
      });
    }

    hits.push(now);
    rateBuckets.set(key, hits);
    pruneRateBuckets(now);
    return next();
  };
};

// 未驗證前以來源 IP 節流，保護 Google UserInfo 驗證本身不被灌爆
const ipRateLimiter = createRateLimiter({
  name: "ip",
  windowMs: 60_000,
  max: 120,
  keyOf: getClientIp,
  message: "請求過於頻繁，請稍後再試。",
});

// 節流身分一律使用 Google 驗證後的 profile.sub（穩定且不可變的帳號識別碼）。
// 不使用 email（可變、屬個資）、不使用 Access Token、不使用 Authorization Header。
// sub 不存在時才退回來源 IP。
const rateLimitIdentity = (req: express.Request): string =>
  (req as any).googleUser?.sub || getClientIp(req);

// 通過驗證後以帳號節流，防止合法帳號或外洩 Token 被自動化程式濫用
export const identityRateLimiter = createRateLimiter({
  name: "identity",
  windowMs: 300_000,
  max: 200,
  keyOf: rateLimitIdentity,
  message: "操作過於頻繁，請稍後再試。",
});

// OCR 會呼叫 OpenAI Vision，成本最高，額度另外從嚴
export const ocrRateLimiter = createRateLimiter({
  name: "ocr",
  windowMs: 300_000,
  max: 10,
  keyOf: rateLimitIdentity,
  message: "辨識次數已達上限，請稍後再試。",
});

app.use("/api", ipRateLimiter);

/** 遮蔽 Email 供日誌使用：chiateng@example.com -> c******g@example.com */
const maskEmail = (email: string): string => {
  const [local, domain] = String(email).split("@");
  if (!local || !domain) return "***";
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}${"*".repeat(Math.min(local.length - 2, 6))}${local[local.length - 1]}@${domain}`;
};

// Helper to format error responses
const handleRouteError = (res: express.Response, error: any) => {
  if (error?.errorCode === 'CONFIG_MISSING' || error?.message?.includes('CONFIG_MISSING') || error?.message?.includes('GOOGLE_SHEETS_SPREADSHEET_ID')) {
    return res.status(500).json({
      error: "CONFIG_MISSING",
      errorCode: "CONFIG_MISSING",
      message: "尚未設定 GOOGLE_SHEETS_SPREADSHEET_ID 環境變數",
    });
  }
  const status = error.statusCode || (error.message?.includes('授權') ? 401 : 500);
  const errorCode = error.errorCode || (status === 401 ? 'UNAUTHORIZED' : (status === 403 ? 'FORBIDDEN' : 'SERVER_ERROR'));
  return res.status(status).json({
    error: error.message || "伺服器處理請求失敗",
    errorCode,
  });
};

// ==========================================
// PUBLIC HEALTH CHECK ENDPOINT (TASK 5)
// ==========================================
app.get("/api/health", (req, res) => {
  return res.json({ status: "ok" });
});

// ==========================================
// SERVER-SIDE GOOGLE AUTHORIZATION & ALLOWLIST MIDDLEWARE
// ==========================================
const requireAuthorizedGoogleUser = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  // TASK 9 — Fail Closed if ALLOWED_GOOGLE_EMAILS environment variable is not configured
  const allowedEnv = process.env.ALLOWED_GOOGLE_EMAILS;
  if (!allowedEnv || !allowedEnv.trim()) {
    return res.status(503).json({
      error: "AUTH_CONFIG_MISSING",
      message: "Friends Alpha 存取控制尚未設定",
    });
  }

  const allowlist = allowedEnv
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (allowlist.length === 0) {
    return res.status(503).json({
      error: "AUTH_CONFIG_MISSING",
      message: "Friends Alpha 存取控制尚未設定",
    });
  }

  // TASK 6 — Check Authorization Header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "AUTH_REQUIRED",
      message: "請先使用 Google 帳號登入",
    });
  }

  const token = authHeader.replace(/^Bearer\s+/, "").trim();
  if (!token) {
    return res.status(401).json({
      error: "AUTH_REQUIRED",
      message: "請先使用 Google 帳號登入",
    });
  }

  // TASK 2 & 3 & 7 — Server-side identity verification with Google UserInfo API
  try {
    const userinfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!userinfoRes.ok) {
      return res.status(401).json({
        error: "INVALID_TOKEN",
        message: "Google 授權已失效，請重新登入",
      });
    }

    const profile = await userinfoRes.json();
    const email = profile.email ? String(profile.email).trim().toLowerCase() : "";
    const emailVerified = profile.email_verified === true || profile.email_verified === "true";

    if (!email || !emailVerified) {
      return res.status(401).json({
        error: "INVALID_TOKEN",
        message: "Google 授權已失效，請重新登入",
      });
    }

    // TASK 8 — Allowlist Authorization Check
    if (!allowlist.includes(email)) {
      // 記錄遮蔽後的 Email，避免完整帳號留在 Vercel Log
      console.warn(`[Access Denied 403] ${maskEmail(email)} is not in Friends Alpha allowlist`);
      return res.status(403).json({
        error: "ACCESS_DENIED",
        message: "此帳號尚未加入 Friends Alpha 測試名單",
      });
    }

    // 不保留 Access Token 副本：各路由一律直接讀 req.headers.authorization，
    // 多存一份等於無謂擴大敏感憑證的暴露面
    (req as any).googleUser = {
      email,
      name: profile.name || email,
      sub: profile.sub,
    };

    // 通過身分驗證後才做帳號層級節流（此時才知道是誰）
    return identityRateLimiter(req, res, next);
  } catch (err: any) {
    console.error("[Auth Verification Error]:", err?.message || err);
    return res.status(401).json({
      error: "INVALID_TOKEN",
      message: "Google 驗證過程發生錯誤，請重新登入",
    });
  }
};

// ==========================================
// STORE API ENDPOINTS
// ==========================================
// 連線時整備唯一正式試算表：補檔名 + 補齊所有分頁與表頭
app.post("/api/sheet/bootstrap", requireAuthorizedGoogleUser, async (req, res) => {
  try {
    const result = await ensureSpreadsheetStructure(req.headers.authorization);
    return res.json(result);
  } catch (error: any) {
    return handleRouteError(res, error);
  }
});

app.get("/api/stores/:id", requireAuthorizedGoogleUser, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const store = await getStoreFromSheet(req.params.id, authHeader);
    return res.json(store);
  } catch (error: any) {
    return handleRouteError(res, error);
  }
});

// ==========================================
// EMPLOYEES API ENDPOINTS
// ==========================================
app.get("/api/employees", requireAuthorizedGoogleUser, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const storeId = (req.query.store_id as string) || "S001";
    const employees = await getEmployeesFromSheet(storeId, authHeader);
    return res.json(employees);
  } catch (error: any) {
    return handleRouteError(res, error);
  }
});

app.post("/api/employees", requireAuthorizedGoogleUser, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const { name, hire_date, note, store_id, role, hourly_rate } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "員工姓名為必填項目" });
    }
    const newEmp = await addEmployeeToSheet(
      { name: name.trim(), hire_date, note, store_id, role, hourly_rate },
      authHeader
    );
    return res.status(201).json(newEmp);
  } catch (error: any) {
    return handleRouteError(res, error);
  }
});

app.put("/api/employees/:id", requireAuthorizedGoogleUser, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const updated = await updateEmployeeInSheet(req.params.id, req.body, authHeader);
    return res.json(updated);
  } catch (error: any) {
    return handleRouteError(res, error);
  }
});

app.delete("/api/employees/:id", requireAuthorizedGoogleUser, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const result = await deleteEmployeeInSheet(req.params.id, authHeader);
    return res.json(result);
  } catch (error: any) {
    return handleRouteError(res, error);
  }
});

app.post("/api/employees/sync", requireAuthorizedGoogleUser, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const { employees } = req.body;
    if (!Array.isArray(employees)) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "employees 必須為陣列" });
    }
    const result = await syncAllEmployeesToSheet(authHeader);
    return res.json(result);
  } catch (error: any) {
    return handleRouteError(res, error);
  }
});

// ==========================================
// WORK RECORDS API ENDPOINTS
// ==========================================
app.get("/api/work-records", requireAuthorizedGoogleUser, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const records = await getWorkRecordsFromSheet(authHeader);
    return res.json(records);
  } catch (error: any) {
    return handleRouteError(res, error);
  }
});

app.post("/api/work-records", requireAuthorizedGoogleUser, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const recordData = req.body;
    const result = await saveWorkRecordToSheet(recordData, authHeader);
    return res.status(201).json(result);
  } catch (error: any) {
    return handleRouteError(res, error);
  }
});

// ==========================================
// REAL OCR / TIMECARD ANALYSIS API (OpenAI Vision via Cloudflare AI Gateway)
// ==========================================
app.post(OCR_ROUTE, requireAuthorizedGoogleUser, ocrRateLimiter, async (req, res) => {
  try {
    const { imageBase64, mimeType = "image/jpeg" } = req.body;

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return res.status(400).json({
        error: "INVALID_IMAGE",
        message: "未提供有效的圖片資料，請重新拍照或上傳圖片。",
      });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "").trim();
    if (!cleanBase64) {
      return res.status(400).json({
        error: "INVALID_IMAGE",
        message: "圖片 Base64 編碼無效。",
      });
    }

    // 一律去除前後空白：環境變數以互動貼上設定時很容易夾帶換行或空格，
    // 帶進 Authorization 標頭或 model 欄位會直接造成 401 / 400
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    const model = process.env.OPENAI_MODEL?.trim();
    if (!apiKey || !model) {
      return res.status(400).json({
        error: "OCR_NOT_CONFIGURED",
        message: "AI 辨識服務目前尚未設定或服務暫時不可用，請稍後再試。",
      });
    }

    // 預設直連 OpenAI；設定 OPENAI_BASE_URL 後改走 Cloudflare AI Gateway
    // 例：https://gateway.ai.cloudflare.com/v1/<account_id>/<gateway>/openai
    const baseUrl = (process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(
      /\/+$/,
      ""
    );

    try {
      const prompt = `您是一位專業的紙本打卡鐘考勤卡 (Timecard) AI 辨識助手。
請仔細辨識這張考勤卡圖片中的打卡時間，並輸出結構化 JSON。
範例 JSON 格式：
{
  "employee_name": "陳志豪",
  "records": [
    {
      "date": "2026-08-01",
      "clock_in": "09:00",
      "clock_out": "18:00",
      "confidence": 0.95,
      "needs_review": false
    }
  ]
}
規則：
1. 若某天的上班或下班時間看不清楚，請不要猜測，並標記 needs_review: true，且 confidence 給予 0.5 以下低分。
2. 僅回應標準 JSON，不要輸出額外的 Markdown 或說明。`;

      const headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      };
      // Cloudflare AI Gateway 若啟用 Authenticated Gateway 才需要這個標頭
      const gatewayToken = process.env.CF_AIG_TOKEN;
      if (gatewayToken && gatewayToken.trim()) {
        headers["cf-aig-authorization"] = `Bearer ${gatewayToken.trim()}`;
      }

      // 推理強度：未設定則採模型預設（medium）。可選 none / minimal / low / medium / high / xhigh / max
      const reasoningEffort = process.env.OPENAI_REASONING_EFFORT?.trim();

      const upstream = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          response_format: { type: "json_object" },
          ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                {
                  type: "image_url",
                  image_url: { url: `data:${mimeType};base64,${cleanBase64}` },
                },
              ],
            },
          ],
        }),
      });

      if (!upstream.ok) {
        // 只記錄狀態碼與訊息，絕不記錄金鑰或圖片內容
        const detail = await upstream.text().catch(() => "");
        console.error(`[OCR Upstream Error] HTTP ${upstream.status}: ${detail.slice(0, 200)}`);

        if (upstream.status === 429) {
          return res.status(429).json({
            error: "OCR_RATE_LIMITED",
            message: "AI 辨識服務暫時繁忙，請稍後再試。",
          });
        }
        return res.status(400).json({
          error: "OCR_NOT_CONFIGURED",
          message: "AI 辨識服務目前尚未設定或服務暫時不可用，請稍後再試。",
        });
      }

      const completion = (await upstream.json()) as any;
      const text: string = completion?.choices?.[0]?.message?.content || "";

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return res.json({
          success: true,
          isMock: false,
          employee_name: parsed.employee_name || "",
          records: Array.isArray(parsed.records) ? parsed.records : [],
        });
      }

      return res.status(500).json({
        error: "OCR_PARSE_ERROR",
        message: "辨識結果解析失敗，請重新拍攝清晰打卡卡圖片。",
      });
    } catch (aiErr: any) {
      console.error("[OCR Vision Error]:", aiErr?.message || aiErr);
      return res.status(400).json({
        error: "OCR_NOT_CONFIGURED",
        message: "AI 辨識服務目前尚未設定或服務暫時不可用，請稍後再試。",
      });
    }
  } catch (error: any) {
    console.error("Error analyzing timecard:", error);
    return res.status(500).json({
      error: "SERVER_ERROR",
      message: error.message || "處理打卡圖片時發生內部伺服器錯誤",
    });
  }
});
