require("dotenv").config();

const express = require("express");
const authRoutes = require("./src/routes/auth");
const postsRoutes = require("./src/routes/posts");
const scheduler = require("./src/services/scheduler");
const { close } = require("./src/config/database");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// 라우트
app.use("/api/auth", authRoutes);
app.use("/v2/lounge", postsRoutes);

// 헬스체크
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

const server = app.listen(PORT, () => {
  console.log(`\n[Server] 중계서버 시작 - http://localhost:${PORT}`);
  console.log(`[Server] 환경: ${process.env.NODE_ENV || "production"}`);
  console.log(`[Server] 기본 고객번호: ${process.env.CUST_NUM || "101834560"}`);
  console.log(`[Server] 엔드포인트:`);
  console.log(`  POST /api/auth/login      - 커뮤니티 로그인 및 토큰 저장`);
  console.log(`  GET  /api/auth/token/:id   - 저장된 토큰 조회`);
  console.log(`  GET  /api/auth/tokens      - 전체 토큰 목록`);
  console.log(`  GET  /v2/lounge/postList    - 게시글 조회 (토큰 불필요)`);
  console.log(`  GET  /health               - 헬스체크\n`);

  // 스케줄러 시작 (10분 간격 게시글 수집)
  scheduler.start();
});

// 종료 처리
process.on("SIGINT", () => {
  console.log("\n[Server] Shutting down...");
  scheduler.stop();
  close();
  server.close(() => process.exit(0));
});

process.on("SIGTERM", () => {
  scheduler.stop();
  close();
  server.close(() => process.exit(0));
});
