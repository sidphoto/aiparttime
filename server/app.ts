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
} from "./googleSheetsService.js";

dotenv.config();

export const app = express();

app.use(express.json({ limit: "20mb" }));

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
      console.warn(`[Access Denied 403] Verified email ${email} is not in Friends Alpha allowlist`);
      return res.status(403).json({
        error: "ACCESS_DENIED",
        message: "此帳號尚未加入 Friends Alpha 測試名單",
      });
    }

    (req as any).googleUser = {
      email,
      name: profile.name || email,
      sub: profile.sub,
      token,
    };

    next();
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
// REAL OCR / TIMECARD ANALYSIS API (GEMINI VISION)
// ==========================================
app.post("/api/analyze-timecard", requireAuthorizedGoogleUser, async (req, res) => {
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

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || !apiKey.trim()) {
      return res.status(400).json({
        error: "OCR_NOT_CONFIGURED",
        message: "AI 辨識服務目前尚未設定或服務暫時不可用，請稍後再試。",
      });
    }

    try {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });

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

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: {
          parts: [
            { inlineData: { mimeType, data: cleanBase64 } },
            { text: prompt },
          ],
        },
      });

      const text = response.text || "";
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
      console.error("[Gemini Vision Error]:", aiErr?.message || aiErr);
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
