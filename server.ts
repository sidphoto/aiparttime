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
// GOOGLE SHEETS API SERVER-SIDE SERVICE LAYER
// ==========================================

// 1. GET Store Info
app.get("/api/stores", async (req, res) => {
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
app.get("/api/employees", async (req, res) => {
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
app.post("/api/employees/sync", async (req, res) => {
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
app.post("/api/employees", async (req, res) => {
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
app.put("/api/employees/:employee_id", async (req, res) => {
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
app.delete("/api/employees/:employee_id", async (req, res) => {
  try {
    const { employee_id } = req.params;
    const authHeader = req.headers.authorization;
    await deleteEmployeeInSheet(employee_id, authHeader);
    return res.json({ success: true });
  } catch (error: any) {
    return handleRouteError(res, error);
  }
});

app.post("/api/analyze-timecard", async (req, res) => {
  return res.json({
    success: true,
    isMock: true,
    detectedName: null,
    detectedYear: "2026",
    detectedMonth: "08",
    days: 22,
    hours: 182,
    minutes: 30,
    note: "考勤卡解析完成",
  });
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
