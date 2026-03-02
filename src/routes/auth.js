const express = require("express");
const CommunityAuth = require("../services/communityAuth");
const { saveToken, getToken, getAllTokens } = require("../config/database");

const router = express.Router();

/**
 * POST /api/auth/login
 * 커뮤니티 서버 로그인 후 토큰을 DB에 저장
 * Body: { custNum?: string, hashedUserId?: string }
 * hashedUserId: 앱의 $secure.makeHashData로 생성된 해시값 (직접 전달 시)
 */
router.post("/login", async (req, res) => {
  try {
    const custNum = req.body.custNum || process.env.CUST_NUM || "101834560";
    const hashedUserId = req.body.hashedUserId || process.env.HASHED_USER_ID;

    console.log(`\n${"=".repeat(50)}`);
    console.log(`[POST /api/auth/login] custNum: ${custNum}, hashedUserId: ${hashedUserId ? "provided" : "not provided"}`);

    const auth = new CommunityAuth({ custNum, hashedUserId });
    const result = await auth.login();

    // DB에 토큰 저장
    saveToken({
      custNum,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken || "",
      loginResponse: JSON.stringify(result.body || ""),
    });

    res.json({
      success: true,
      data: {
        custNum,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        body: result.body,
      },
    });
  } catch (error) {
    console.error("[POST /api/auth/login] Error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/auth/token/:custNum
 * DB에서 저장된 토큰 조회
 */
router.get("/token/:custNum", (req, res) => {
  try {
    const token = getToken(req.params.custNum);
    if (!token) {
      return res.status(404).json({ success: false, error: "Token not found" });
    }
    res.json({ success: true, data: token });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/auth/tokens
 * 저장된 모든 토큰 조회
 */
router.get("/tokens", (req, res) => {
  try {
    const tokens = getAllTokens();
    res.json({ success: true, data: tokens });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
