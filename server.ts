import express from "express";
import path from "path";
import dotenv from "dotenv";
import {
  getStoreFromSheet,
  getEmployeesFromSheet,
  addEmployeeToSheet,
  updateEmployeeInSheet,
  deleteEmployeeInSheet,
  syncAllEmployeesToSheet,
  getSpreadsheetId,
} from "./server/googleSheetsService";

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

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

    // TASK 13 — Safe Logging (Without Token / Header / Full Allowlist)
    console.log(`[Auth Verified 200] User: ${email}, Route: ${req.method} ${req.path}`);
    return next();
  } catch (err: any) {
    console.error("[Google Identity Verification Error]:", err?.message || err);
    return res.status(401).json({
      error: "INVALID_TOKEN",
      message: "Google 授權已失效，請重新登入",
    });
  }
};

// ==========================================
// GOOGLE SHEETS API SERVER-SIDE SERVICE LAYER (PROTECTED)
// ==========================================

// 1. GET Store Info
app.get("/api/stores", requireAuthorizedGoogleUser, async (req, res) => {
  try {
    const storeId = (req.query.store_id as string) || "S001";
    const authHeader = req.headers.authorization;
    const store = await getStoreFromSheet(storeId, authHeader);
    return res.json({ success: true, store });
  } catch (error: any) {
    console.error("Error fetching store:", error);
    return handleRouteError(res, error);
  }
});

// 2. GET Employees
app.get("/api/employees", requireAuthorizedGoogleUser, async (req, res) => {
  try {
    const storeId = (req.query.store_id as string) || "S001";
    const authHeader = req.headers.authorization;
    const employees = await getEmployeesFromSheet(storeId, authHeader);
    return res.json({ success: true, employees });
  } catch (error: any) {
    console.error("Error fetching employees:", error);
    return handleRouteError(res, error);
  }
});

// 2b. POST Sync Employees Headers & Data
app.post("/api/employees/sync", requireAuthorizedGoogleUser, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const result = await syncAllEmployeesToSheet(authHeader);
    return res.json({ success: true, ...result });
  } catch (error: any) {
    console.error("Error syncing employees:", error);
    return handleRouteError(res, error);
  }
});

// 3. POST Add Employee
app.post("/api/employees", requireAuthorizedGoogleUser, async (req, res) => {
  try {
    const { name, role, hourly_rate, hire_date, note, store_id } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "請輸入員工姓名" });
    }
    const authHeader = req.headers.authorization;
    const newEmp = await addEmployeeToSheet({
      name,
      role,
      hourly_rate: hourly_rate !== undefined ? Number(hourly_rate) : undefined,
      hire_date,
      note,
      store_id: store_id || "S001"
    }, authHeader);
    return res.json({ success: true, employee: newEmp });
  } catch (error: any) {
    console.error("Error adding employee:", error);
    return handleRouteError(res, error);
  }
});

// 4. PUT Update Employee
app.put("/api/employees/:employee_id", requireAuthorizedGoogleUser, async (req, res) => {
  try {
    const { employee_id } = req.params;
    const { name, role, hourly_rate, status, hire_date, note } = req.body;
    const authHeader = req.headers.authorization;
    const updated = await updateEmployeeInSheet(
      employee_id,
      {
        name,
        role,
        hourly_rate: hourly_rate !== undefined ? Number(hourly_rate) : undefined,
        status,
        hire_date,
        note
      },
      authHeader
    );
    return res.json({ success: true, employee: updated });
  } catch (error: any) {
    console.error("Error updating employee:", error);
    return handleRouteError(res, error);
  }
});

// 5. DELETE Employee
app.delete("/api/employees/:employee_id", requireAuthorizedGoogleUser, async (req, res) => {
  try {
    const { employee_id } = req.params;
    const authHeader = req.headers.authorization;
    await deleteEmployeeInSheet(employee_id, authHeader);
    return res.json({ success: true });
  } catch (error: any) {
    return handleRouteError(res, error);
  }
});

// TASK 4 Protected Standard Endpoints for Schedule & Attendance
app.post("/api/schedules", requireAuthorizedGoogleUser, async (req, res) => {
  return res.json({ success: true, message: "Schedules endpoint protected" });
});
app.post("/api/clock-ins", requireAuthorizedGoogleUser, async (req, res) => {
  return res.json({ success: true, message: "Clock-ins endpoint protected" });
});
app.post("/api/leave-requests", requireAuthorizedGoogleUser, async (req, res) => {
  return res.json({ success: true, message: "Leave-requests endpoint protected" });
});
app.post("/api/swap-requests", requireAuthorizedGoogleUser, async (req, res) => {
  return res.json({ success: true, message: "Swap-requests endpoint protected" });
});

// TASK 12 — OCR Analyze Timecard (Protected by requireAuthorizedGoogleUser to protect Gemini Quota)
app.post("/api/analyze-timecard", requireAuthorizedGoogleUser, async (req, res) => {
  try {
    const { imageBase64, mimeType = "image/jpeg" } = req.body;

    // TASK 8 — Security & Input Validation
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return res.status(400).json({
        error: "INVALID_INPUT",
        message: "請提供有效的打卡卡圖片內容",
      });
    }

    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedMimeTypes.includes(mimeType.toLowerCase())) {
      return res.status(400).json({
        error: "UNSUPPORTED_FORMAT",
        message: "僅支援 JPEG、PNG、WebP 格式之圖片檔",
      });
    }

    // Size limit check (14MB Base64 limit ~ 10MB original image)
    if (imageBase64.length > 14 * 1024 * 1024) {
      return res.status(400).json({
        error: "FILE_TOO_LARGE",
        message: "圖片檔案大小過大，請選擇 10MB 以下之圖片",
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        error: "OCR_NOT_CONFIGURED",
        message: "AI 打卡辨識服務尚未設定，請稍後再試。",
      });
    }

    // Try real Gemini AI Vision recognition if Key is available
    try {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");

      const prompt = `你是專業的紙本考勤打卡卡 AI 辨識助手。請仔細分析這張打卡卡照片，提取「逐日打卡明細紀錄」，並僅以純 JSON 格式回應：
{
  "employee_name": "打卡卡上的員工姓名（若無法辨識請回傳空字串 \"\"）",
  "records": [
    {
      "date": "YYYY-MM-DD",
      "clock_in": "HH:MM",
      "clock_out": "HH:MM",
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

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
